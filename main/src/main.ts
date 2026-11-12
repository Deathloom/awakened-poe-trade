'use strict'

import { app, clipboard } from 'electron'
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
  app.on('will-quit', () => { pobImpact.stop() })
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
      gameLogWatcher.onLines = (lines, isHistory) => {
        hud.handleLogLines(lines)
        pobImpact.handleLogLines(lines, isHistory)
      }
      // Deathloom fork: find Client.txt next to the game once its window shows up
      poeWindow.onAttach(() => { void gameLogWatcher.findFromGameProcess() })
      eventPipe.onEventAnyClient('CLIENT->MAIN::update-host-config', (cfg) => {
        overlay.updateOpts(cfg.overlayKey, cfg.windowTitle)
        shortcuts.updateActions(cfg.shortcuts, cfg.stashScroll, cfg.logKeys, cfg.restoreClipboard, cfg.language)
        gameLogWatcher.restart(cfg.clientLog ?? '')
        gameConfig.readConfig(cfg.gameConfig ?? '')
        appUpdater.checkAtStartup()
        tray.overlayKey = cfg.overlayKey
        pobImpact.configure(cfg.pob)
        stashTracker.configure(cfg.pob?.stash, cfg.pob?.accountName ?? '')
        hud.configure(cfg.pob?.hud)
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
