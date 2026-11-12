// Deathloom fork: "show while playing" HUD.
// A small separate window for the panels that must stay visible while the game
// has focus (campaign guide, trade companion). Unlike the full-screen overlay it
// is only as big as the panels, never takes focus (clicks don't pull focus away
// from the game) and can be made click-through or opaque. Nothing here reads
// game memory or sends input to the game.

import path from 'path'
import { BrowserWindow, shell } from 'electron'
import { OverlayController, type MoveresizeEvent } from 'electron-overlay-window'
import type { PobHudConfig } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { GameWindow } from './GameWindow'
import type { OverlayWindow } from './OverlayWindow'

export class HudWindow {
  private window?: BrowserWindow
  private cfg?: PobHudConfig
  private port = 0
  private size = { width: 320, height: 200 }
  private drag?: { screenX: number, screenY: number, x: number, y: number }
  private builtOpaque?: boolean

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private poeWindow: GameWindow,
    private overlay: OverlayWindow
  ) {
    this.poeWindow.on('active-change', () => { this.update() })
    OverlayController.events.on('moveresize', (_e: MoveresizeEvent) => { this.place() })
    OverlayController.events.on('attach', () => { this.place(); this.update() })
    OverlayController.events.on('detach', () => { this.update() })

    this.server.onEventAnyClient('CLIENT->MAIN::hud-size', (e) => {
      this.size = {
        width: Math.max(40, Math.min(1200, Math.ceil(e.width))),
        height: Math.max(20, Math.min(1400, Math.ceil(e.height)))
      }
      this.place()
    })
    this.server.onEventAnyClient('CLIENT->MAIN::hud-drag', (e) => { this.handleDrag(e) })
  }

  get enabled () {
    return Boolean(this.cfg && (this.cfg.guide || this.cfg.trades))
  }

  setPort (port: number) {
    this.port = port
    this.update()
  }

  configure (cfg: PobHudConfig | undefined) {
    this.cfg = cfg
    if (!this.enabled) {
      this.destroy()
      return
    }
    // a window can't switch between see-through and solid, so rebuild it
    if (this.window && this.builtOpaque !== Boolean(cfg!.opaque)) this.destroy()
    this.update()
  }

  // Called by OverlayWindow when the overlay is activated or released
  update = () => {
    if (!this.enabled || !this.port) return
    const playing = this.poeWindow.isActive
    const visible = playing || this.overlay.isInteractable

    if (!visible) {
      this.window?.hide()
      this.sendState(false)
      return
    }
    const win = this.ensureWindow()
    if (!win) return
    win.setOpacity(Math.max(30, Math.min(100, this.cfg!.opacity || 100)) / 100)
    // Click-through only while playing; with the overlay active (Shift+Space) you can always click and drag
    win.setIgnoreMouseEvents(Boolean(this.cfg!.clickThrough && playing))
    this.place()
    if (!win.isVisible()) win.showInactive()
    // keep it above the full-screen overlay window too
    win.setAlwaysOnTop(true, 'screen-saver')
    this.sendState(playing)
  }

  private sendState (playing: boolean) {
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::hud-state',
      payload: { playing }
    })
  }

  private ensureWindow (): BrowserWindow | undefined {
    if (this.window && !this.window.isDestroyed()) return this.window
    const opaque = Boolean(this.cfg!.opaque)
    this.builtOpaque = opaque
    try {
      this.window = new BrowserWindow({
        icon: path.join(__dirname, process.env.STATIC!, 'icon.png'),
        width: this.size.width,
        height: this.size.height,
        show: false,
        frame: false,
        transparent: !opaque,
        backgroundColor: opaque ? '#111827' : '#00000000',
        hasShadow: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        focusable: false,
        alwaysOnTop: true,
        webPreferences: {
          allowRunningInsecureContent: false,
          spellcheck: false,
          backgroundThrottling: false
        }
      })
    } catch (err) {
      this.logger.write(`error [HUD] Failed to create window: ${(err as Error).message}`)
      return undefined
    }
    this.window.setMenu(null)
    this.window.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })
    this.window.on('closed', () => { this.window = undefined })

    const base = process.env.VITE_DEV_SERVER_URL || `http://localhost:${this.port}/index.html`
    this.window.loadURL(`${base}${base.includes('?') ? '&' : '?'}hud`)
    this.logger.write(`info [HUD] Window created (${opaque ? 'opaque' : 'see-through'})`)
    return this.window
  }

  private place () {
    const win = this.window
    if (!win || win.isDestroyed() || !this.cfg) return
    const game = OverlayController.targetBounds
    const { width, height } = this.size
    let x = Math.round(this.cfg.x)
    let y = Math.round(this.cfg.y)
    if (game.width > 0 && game.height > 0) {
      // keep it inside the game window
      x = Math.max(0, Math.min(game.width - width, x))
      y = Math.max(0, Math.min(game.height - height, y))
      x += game.x
      y += game.y
    }
    win.setBounds({ x, y, width, height })
  }

  private handleDrag (e: { phase: 'start' | 'move' | 'end', screenX: number, screenY: number }) {
    if (!this.cfg) return
    if (e.phase === 'start') {
      this.drag = { screenX: e.screenX, screenY: e.screenY, x: this.cfg.x, y: this.cfg.y }
      return
    }
    if (!this.drag) return
    this.cfg.x = Math.round(this.drag.x + e.screenX - this.drag.screenX)
    this.cfg.y = Math.round(this.drag.y + e.screenY - this.drag.screenY)
    this.place()
    if (e.phase === 'end') {
      this.drag = undefined
      // the overlay saves it to the settings file
      this.server.sendEventTo('broadcast', {
        name: 'MAIN->CLIENT::hud-moved',
        payload: { x: this.cfg.x, y: this.cfg.y }
      })
    }
  }

  private destroy () {
    if (this.window && !this.window.isDestroyed()) this.window.destroy()
    this.window = undefined
  }
}
