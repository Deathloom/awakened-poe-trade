'use strict'

import { app, clipboard, net } from 'electron'
import { uIOhook } from 'uiohook-napi'
import os from 'node:os'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { startServer, eventPipe, server } from './server'
import { Logger } from './RemoteLogger'
import { GameWindow } from './windowing/GameWindow'
import { OverlayWindow } from './windowing/OverlayWindow'
import { GameConfig } from './host-files/GameConfig'
import { Shortcuts } from './shortcuts/Shortcuts'
import { AppUpdater } from './AppUpdater'
import { AppTray } from './AppTray'
import { OverlayVisibility } from './windowing/OverlayVisibility'
import { HudWindow } from './windowing/HudWindow'
import { DesktopWindow } from './windowing/DesktopWindow'
import { OverlayController } from 'electron-overlay-window'
import { GameLogWatcher } from './host-files/GameLogWatcher'
import { HttpProxy } from './proxy'
import { PobImpact } from './pob/PobImpact'
import { PobSync } from './pob/PobSync'
import { PobImport } from './pob/PobImport'
import { PobInstaller, shouldAutoInstall } from './pob/PobInstaller'
import { ErrorReporter } from './ErrorReporter'
import { isAllowedImportUrl, MAX_IMPORT_BYTES } from './pob/PobImport'
import { applyStartWithWindows } from './StartWithWindows'

if (!app.requestSingleInstanceLock()) {
  app.exit()
}

// Deathloom fork: starting Loot Goblin again (Start menu, desktop shortcut) while
// it's running opens its desktop window; --desktop opens it at start too
let openDesktopWindow: (() => void) | null = null
let desktopRequested = process.argv.includes('--desktop')
app.on('second-instance', () => {
  if (openDesktopWindow) openDesktopWindow()
  else desktopRequested = true
})

if (process.platform !== 'darwin') {
  app.disableHardwareAcceleration()
}
app.enableSandbox()

let tray: AppTray

app.on('ready', async () => {
  tray = new AppTray(eventPipe)
  const logger = new Logger(eventPipe)
  const gameLogWatcher = new GameLogWatcher(eventPipe, logger)
  const gameConfig = new GameConfig(eventPipe, logger)
  const poeWindow = new GameWindow()
  const appUpdater = new AppUpdater(eventPipe)
  const _httpProxy = new HttpProxy(server, logger)
  const pobImpact = new PobImpact(eventPipe, logger)
  tray.pobDir = () => pobImpact.pobDir()
  // Deathloom fork: tray "Restart to update" item
  tray.installUpdate = appUpdater.installNow
  appUpdater.onChange = (info) => {
    const ready = info.state === 'update-downloaded' ? info.version : null
    if (ready !== tray.updateReady) {
      tray.updateReady = ready
      tray.rebuildMenu()
    }
  }
  app.on('will-quit', () => { pobImpact.stop() })
  // Deathloom fork: update check even if the overlay page never connects (it normally
  // starts with the first settings from the page), so a broken release can still be replaced
  setTimeout(() => { appUpdater.checkAtStartup() }, 90_000)
  // Deathloom fork: build sync (sign in, Pull / Push) and PoB-code import from the overlay
  const pobSync = new PobSync(eventPipe, logger, pobImpact)
  pobImpact.onPlayerFilesChanged = () => { pobSync.schedulePush() }
  // Deathloom fork: automatic problem reports (GitHub issues in the builds repo, via the sign-in)
  const errorReporter = new ErrorReporter(logger, pobSync, eventPipe)
  errorReporter.enabled = () => pobImpact.resolved()?.errorReports !== false
  pobImpact.onCodeError = (message, detail) => { errorReporter.capture('pob', message, detail, 'ImpactServer') }
  pobSync.onCodeError = (message) => { errorReporter.capture('pob', message, undefined, 'SyncServer') }
  // Deathloom fork: Loot Goblin's own PoB (downloaded on first run, then kept current)
  const pobInstaller = new PobInstaller(eventPipe, logger)
  pobImpact.installStatus = () => pobImpact.pobDir() ? null : pobInstaller.statusText()
  tray.pobStatus = () => pobImpact.pobDir() ? null : pobInstaller.statusText()
  pobInstaller.beforeReplace = () => { pobImpact.stop() }
  pobInstaller.onChanged = () => {
    pobImpact.refreshPob()
    pobSync.configure()
  }
  let pobInstallStarted = false
  // Deathloom fork: downloads only from the build sites PobImport allows (also after
  // redirects), 15 s timeout, max 2 MB
  const pobImport = new PobImport(async (url) => {
    const res = await net.fetch(url, {
      headers: { 'User-Agent': `Loot Goblin/${app.getVersion()}` },
      signal: AbortSignal.timeout(15_000)
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!isAllowedImportUrl(res.url || url)) throw new Error('the link redirected to another site')
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > MAX_IMPORT_BYTES) throw new Error('the build is too large')
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_IMPORT_BYTES) throw new Error('the build is too large')
    return buf.toString('utf8')
  })
  eventPipe.onEventAnyClient('CLIENT->MAIN::pob-import', (req) => {
    const send = eventPipe.replyTo()
    const reply = (payload: Omit<Parameters<typeof send>[0] & { name: 'MAIN->CLIENT::pob-import' }, 'name'>['payload']) => {
      send({ name: 'MAIN->CLIENT::pob-import', payload })
    }
    void (async () => {
      try {
        const playerDir = pobImpact.playerDir()
        if (req.preview) {
          reply({ requestId: req.requestId, ok: true, preview: await pobImport.preview(req.input, playerDir) })
          return
        }
        const res = await pobImport.save(req.input, playerDir, req.name ?? '', req.folder ?? '', req.overwrite === true)
        if ('exists' in res) {
          reply({ requestId: req.requestId, ok: false, exists: true, error: `A build called "${res.exists}" already exists.` })
          return
        }
        logger.write(`info [PoB] imported build ${res.rel}`)
        if (req.setActive) {
          await pobImpact.setActiveBuild(res.rel)
        } else {
          pobSync.schedulePush()
        }
        reply({ requestId: req.requestId, ok: true, saved: res.rel })
      } catch (err) {
        reply({ requestId: req.requestId, ok: false, error: (err as Error).message })
      }
    })()
  })
  // Deathloom fork (2026-11-14): stash tracker removed (it needed the POESESSID login
  // cookie, not allowed for shared apps under GGG's rules). Delete what older versions saved.
  for (const f of ['stash-session.bin', 'stash-snapshot.json']) {
    fs.rm(path.join(app.getPath('userData'), 'apt-data', f), { force: true }).catch(() => {})
  }
  // Deathloom fork: Copy buttons (market search text). Only the clipboard; nothing is sent to the game.
  eventPipe.onEventAnyClient('CLIENT->MAIN::write-clipboard', ({ text }) => {
    // Deathloom fork: plain text only, capped (item text and searches are a few KB)
    if (typeof text !== 'string' || text.length > 100_000) return
    clipboard.writeText(text).catch(e => logger.write(`error [Clipboard] ${(e as Error).message}`))
  })

  setTimeout(
    async () => {
      const overlay = new OverlayWindow(eventPipe, logger, poeWindow)
      new OverlayVisibility(eventPipe, overlay, gameConfig)
      // Deathloom fork: panels that stay visible while playing
      const hud = new HudWindow(eventPipe, logger, poeWindow, overlay)
      // Deathloom fork: all panels in a normal window (second screen)
      const desktop = new DesktopWindow(logger)
      let firstRunChecked = false
      tray.openDesktop = () => { desktop.open() }
      openDesktopWindow = () => { desktop.open() }
      if (desktopRequested) desktop.open()
      // Trade site tab: open GGG trade pages from the overlay in the window
      eventPipe.onEventAnyClient('CLIENT->MAIN::user-action', (e) => {
        if (e.action === 'open-window-view') {
          shortcuts.openWindowView?.(e.view)
          return
        }
        if (e.action !== 'open-trade-tab') return
        const ok = desktop.openTrade(e.url, (url) => {
          eventPipe.sendEventTo('broadcast', { name: 'MAIN->CLIENT::open-trade-tab', payload: { url } })
        })
        if (!ok) logger.write('warn [desktop] open-trade-tab ignored: not a trade site page')
      })
      const shortcuts = await Shortcuts.create(logger, overlay, poeWindow, gameConfig, eventPipe)
      shortcuts.hud = hud
      shortcuts.openPob = () => { tray.openPob() }
      shortcuts.openWindowView = (view) => {
        desktop.openView(view, (v) => {
          eventPipe.sendEventTo('broadcast', { name: 'MAIN->CLIENT::desktop-view', payload: { view: v } })
        })
      }
      gameLogWatcher.onLines = (lines, isHistory) => {
        hud.handleLogLines(lines)
        pobImpact.handleLogLines(lines, isHistory)
      }
      // Deathloom fork: find Client.txt next to the game once its window shows up
      poeWindow.onAttach(() => { void gameLogWatcher.findFromGameProcess() })
      // Deathloom fork: "Open the Loot Goblin window when the game starts"
      OverlayController.events.on('attach', () => { desktop.gameStarted() })
      OverlayController.events.on('detach', () => { desktop.gameClosed() })
      // Deathloom fork: first-run setup guide asks what was found
      eventPipe.onEventAnyClient('CLIENT->MAIN::pob-setup-probe', ({ requestId, accountName }) => {
        const send = eventPipe.replyTo()
        void (async () => {
          if (!gameLogWatcher.actualPath) await gameLogWatcher.findFromGameProcess().catch(() => {})
          const probe = await pobImpact.setupProbe(accountName)
          send({
            name: 'MAIN->CLIENT::pob-setup-probe',
            payload: { requestId, clientLog: gameLogWatcher.actualPath, ...probe }
          })
        })()
      })
      eventPipe.onEventAnyClient('CLIENT->MAIN::read-game-log', ({ requestId }) => {
        const send = eventPipe.replyTo()
        gameLogWatcher.readHistory()
          .then((lines) => { send({ name: 'MAIN->CLIENT::read-game-log', payload: { requestId, ok: true, lines } }) })
          .catch((err: Error) => { send({ name: 'MAIN->CLIENT::read-game-log', payload: { requestId, ok: false, error: err.message } }) })
      })
      eventPipe.onEventAnyClient('CLIENT->MAIN::pob-copy-builds', ({ requestId, source }) => {
        const send = eventPipe.replyTo()
        void pobImpact.copyExistingBuilds(typeof source === 'string' && source ? source : undefined)
          .then((res) => {
            if (res.copied) pobSync.schedulePush()
            send({ name: 'MAIN->CLIENT::pob-copy-builds', payload: { requestId, ok: true, ...res } })
          })
          .catch((err: Error) => {
            send({ name: 'MAIN->CLIENT::pob-copy-builds', payload: { requestId, ok: false, error: err.message } })
          })
      })
      eventPipe.onEventAnyClient('CLIENT->MAIN::update-host-config', (cfg) => {
        overlay.updateOpts(cfg.overlayKey, cfg.windowTitle)
        shortcuts.updateActions(cfg.shortcuts, cfg.stashScroll, cfg.logKeys, cfg.restoreClipboard, cfg.language)
        gameLogWatcher.restart(cfg.clientLog ?? '')
        gameConfig.readConfig(cfg.gameConfig ?? '')
        appUpdater.checkAtStartup()
        tray.overlayKey = cfg.overlayKey
        pobImpact.configure(cfg.pob)
        pobSync.configure()
        // first settings of this run: get / update Loot Goblin's PoB (not when a PoB folder of your own is set)
        if (!pobInstallStarted && shouldAutoInstall() && !pobImpact.usesOwnPob()) {
          pobInstallStarted = true
          setTimeout(() => { void pobInstaller.ensure() }, 3000)
        }
        hud.configure(cfg.pob?.hud)
        shortcuts.panelOverlayOff = (panel) => (cfg.pob?.panels as Record<string, { overlay?: boolean } | undefined> | undefined)?.[panel]?.overlay === false
        applyStartWithWindows(cfg.pob?.startWithWindows !== false)
        desktop.configure(cfg.pob?.desktopAtStart === true)
        // first run (setup guide not done yet): open the Loot Goblin window, which
        // shows the setup guide, so it can be done before playing
        if (!firstRunChecked) {
          firstRunChecked = true
          if (cfg.pob?.setupDone !== true) desktop.open()
        }
      })
      uIOhook.start()
      const port = await startServer(appUpdater, logger)
      // TODO: move up (currently crashes)
      logger.write(`info ${os.type()} ${os.release} / v${app.getVersion()}`)
      overlay.loadAppPage(port)
      hud.setPort(port)
      desktop.setPort(port)
      tray.serverPort = port
    },
    // fixes(linux): window is black instead of transparent
    process.platform === 'linux' ? 1000 : 0
  )
})
