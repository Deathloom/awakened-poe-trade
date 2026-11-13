'use strict'

import { app, clipboard, net } from 'electron'
import { uIOhook } from 'uiohook-napi'
import os from 'node:os'
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
import { GameLogWatcher } from './host-files/GameLogWatcher'
import { HttpProxy } from './proxy'
import { PobImpact } from './pob/PobImpact'
import { StashTracker } from './pob/StashTracker'
import { PobSync } from './pob/PobSync'
import { PobImport } from './pob/PobImport'
import { PobInstaller, shouldAutoInstall } from './pob/PobInstaller'
import { ErrorReporter } from './ErrorReporter'
import { applyStartWithWindows } from './StartWithWindows'

if (!app.requestSingleInstanceLock()) {
  app.exit()
}

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
  const pobImport = new PobImport(async (url) => {
    const res = await net.fetch(url, { headers: { 'User-Agent': `Loot Goblin/${app.getVersion()}` } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
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
  const stashTracker = new StashTracker(eventPipe, logger)
  // Deathloom fork: Copy buttons (market search text). Only the clipboard; nothing is sent to the game.
  eventPipe.onEventAnyClient('CLIENT->MAIN::write-clipboard', ({ text }) => {
    clipboard.writeText(text)
  })

  setTimeout(
    async () => {
      const overlay = new OverlayWindow(eventPipe, logger, poeWindow)
      new OverlayVisibility(eventPipe, overlay, gameConfig)
      // Deathloom fork: panels that stay visible while playing
      const hud = new HudWindow(eventPipe, logger, poeWindow, overlay)
      const shortcuts = await Shortcuts.create(logger, overlay, poeWindow, gameConfig, eventPipe)
      shortcuts.hud = hud
      shortcuts.openPob = () => { tray.openPob() }
      gameLogWatcher.onLines = (lines, isHistory) => {
        hud.handleLogLines(lines)
        pobImpact.handleLogLines(lines, isHistory)
      }
      // Deathloom fork: find Client.txt next to the game once its window shows up
      poeWindow.onAttach(() => { void gameLogWatcher.findFromGameProcess() })
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
      eventPipe.onEventAnyClient('CLIENT->MAIN::pob-copy-builds', ({ requestId }) => {
        const send = eventPipe.replyTo()
        void pobImpact.copyExistingBuilds()
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
        stashTracker.configure(cfg.pob?.stash, cfg.pob?.accountName ?? '')
        hud.configure(cfg.pob?.hud)
        applyStartWithWindows(cfg.pob?.startWithWindows !== false)
      })
      uIOhook.start()
      const port = await startServer(appUpdater, logger)
      // TODO: move up (currently crashes)
      logger.write(`info ${os.type()} ${os.release} / v${app.getVersion()}`)
      overlay.loadAppPage(port)
      hud.setPort(port)
      tray.serverPort = port
    },
    // fixes(linux): window is black instead of transparent
    process.platform === 'linux' ? 1000 : 0
  )
})
