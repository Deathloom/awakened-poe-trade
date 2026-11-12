// Deathloom fork: "show while playing" HUD.
// Pinned panels (campaign guide, trade companion, build gear) each get a small
// window of their own that stays on top of the game while it has focus. Unlike
// the full-screen overlay these are only as big as the panel, never take focus
// (clicks don't pull focus away from the game), can be click-through or opaque,
// and each has its own position. Nothing here reads game memory or sends input
// to the game.

import path from 'path'
import { BrowserWindow, screen, shell } from 'electron'
import { uIOhook } from 'uiohook-napi'
import { OverlayController, type MoveresizeEvent } from 'electron-overlay-window'
import type { PobHudConfig, HudPanel } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { GameWindow } from './GameWindow'
import type { OverlayWindow } from './OverlayWindow'

export type { HudPanel }
const PANELS: HudPanel[] = ['guide', 'trades', 'gear']
const DEFAULT_POS: Record<HudPanel, { x: number, y: number }> = {
  guide: { x: 10, y: 90 },
  trades: { x: 10, y: 420 },
  gear: { x: 440, y: 90 }
}

// Not in a zone: the game just started ("***** LOG FILE OPENING *****" is the
// first line of every session) or is connecting to the login server
// ("Async connecting to lon.login.pathofexile.com:20487": login, or back to
// character select)
const LOGIN_SERVER = /\*{5} LOG FILE OPENING \*{5}|Async connecting to \S+\.login\./
// 'Generating level 1 area "1_1_1"' (any client language) or ": You have entered The Coast."
const ZONE = /Generating level \d+ area "|\] : You have entered /

interface PanelWindow {
  win?: BrowserWindow
  builtOpaque?: boolean
  size: { width: number, height: number }
}

export class HudWindow {
  private cfg?: PobHudConfig
  private port = 0
  private windows: Record<HudPanel, PanelWindow> = {
    guide: { size: { width: 320, height: 200 } },
    trades: { size: { width: 384, height: 60 } },
    gear: { size: { width: 416, height: 300 } }
  }

  private drag?: { panel: HudPanel, cursorX: number, cursorY: number, x: number, y: number, timer: NodeJS.Timeout, started: number }
  // pinned panels hidden with their hotkey (not saved; they show again after a restart)
  private hidden: Record<HudPanel, boolean> = { guide: false, trades: false, gear: false }
  // Only show once a character is in a zone, not on the login / character select screens
  private inWorld = false
  // no Client.txt being read: can't tell, so behave as before (show with the game)
  private readingLog = false

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private poeWindow: GameWindow,
    private overlay: OverlayWindow
  ) {
    this.poeWindow.on('active-change', () => { this.update() })
    OverlayController.events.on('moveresize', (_e: MoveresizeEvent) => { this.placeAll() })
    OverlayController.events.on('attach', () => { this.placeAll(); this.update() })
    OverlayController.events.on('detach', () => { this.inWorld = false; this.update() })

    this.server.onEventAnyClient('CLIENT->MAIN::hud-size', (e) => {
      const pw = this.windows[e.panel]
      if (!pw) return
      pw.size = {
        width: Math.max(40, Math.min(1200, Math.ceil(e.width))),
        height: Math.max(20, Math.min(1400, Math.ceil(e.height)))
      }
      this.place(e.panel)
    })
    this.server.onEventAnyClient('CLIENT->MAIN::hud-drag', (e) => {
      if (e.phase === 'start') this.startDrag(e.panel)
      else if (e.phase === 'end') this.endDrag()
    })
    this.server.onEventAnyClient('CLIENT->MAIN::hud-panel', (e) => {
      this.setPanel(e.panel, e.visible)
    })
    // Build gear panel in the HUD: the overlay does Trade / price check / saving the loadout
    this.server.onEventAnyClient('CLIENT->MAIN::hud-gear-action', (e) => {
      this.server.sendEventTo('broadcast', { name: 'MAIN->CLIENT::hud-gear-action', payload: e })
      if (e.action === 'price-check') this.overlay.assertOverlayActive()
    })
    // a drag ends when the mouse button is released anywhere
    uIOhook.on('mouseup', () => { this.endDrag() })
  }

  isPinned (panel: HudPanel) {
    return Boolean(this.cfg?.[panel])
  }

  togglePanel (panel: HudPanel) {
    this.setPanel(panel, this.hidden[panel])
  }

  private setPanel (panel: HudPanel, visible: boolean) {
    if (this.hidden[panel] === !visible) return
    this.hidden[panel] = !visible
    this.update()
  }

  // From Client.txt: a zone being generated / entered means a character is in the
  // world; connecting to the login server means login or back to character select.
  handleLogLines (lines: string[]) {
    const wasReading = this.readingLog
    this.readingLog = true
    let inWorld = this.inWorld
    for (const line of lines) {
      if (LOGIN_SERVER.test(line)) inWorld = false
      else if (ZONE.test(line)) inWorld = true
    }
    if (inWorld !== this.inWorld || !wasReading) {
      this.inWorld = inWorld
      this.update()
    }
  }

  setPort (port: number) {
    this.port = port
    this.update()
  }

  configure (cfg: PobHudConfig | undefined) {
    this.cfg = cfg
    for (const panel of PANELS) {
      const pw = this.windows[panel]
      // unpinned, or see-through <-> solid changed (needs a new window)
      if (!this.isPinned(panel) || (pw.win && pw.builtOpaque !== Boolean(cfg?.opaque))) {
        this.destroy(panel)
      }
    }
    this.update()
  }

  private position (panel: HudPanel) {
    return this.cfg?.pos?.[panel] ?? DEFAULT_POS[panel]
  }

  // Called when the game or the overlay gains/loses focus, and on any HUD change
  update = () => {
    if (!this.cfg || !this.port) return
    const playing = this.poeWindow.isActive
    const onScreen = (playing || this.overlay.isInteractable) && (this.inWorld || !this.readingLog)

    for (const panel of PANELS) {
      if (!this.isPinned(panel)) continue
      const show = onScreen && !this.hidden[panel]
      // the page exists even while hidden, so the companion keeps reading whispers
      const win = this.ensureWindow(panel)
      if (!win) continue
      if (!show) {
        if (win.isVisible()) win.hide()
        continue
      }
      win.setOpacity(Math.max(30, Math.min(100, this.cfg.opacity || 100)) / 100)
      // Click-through only while playing; with the overlay active (Shift+Space) you can always click and drag
      win.setIgnoreMouseEvents(Boolean(this.cfg.clickThrough && playing))
      this.place(panel)
      if (!win.isVisible()) win.showInactive()
      // keep it above the full-screen overlay window too
      win.setAlwaysOnTop(true, 'screen-saver')
    }
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::hud-state',
      payload: { playing, hidden: { ...this.hidden } }
    })
  }

  private ensureWindow (panel: HudPanel): BrowserWindow | undefined {
    const pw = this.windows[panel]
    if (pw.win && !pw.win.isDestroyed()) return pw.win
    const opaque = Boolean(this.cfg?.opaque)
    pw.builtOpaque = opaque
    let win: BrowserWindow
    try {
      win = new BrowserWindow({
        icon: path.join(__dirname, process.env.STATIC!, 'icon.png'),
        width: pw.size.width,
        height: pw.size.height,
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
    pw.win = win
    win.setMenu(null)
    win.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })
    win.on('closed', () => { if (pw.win === win) pw.win = undefined })

    const base = process.env.VITE_DEV_SERVER_URL || `http://localhost:${this.port}/index.html`
    win.loadURL(`${base}${base.includes('?') ? '&' : '?'}hud=${panel}`)
    this.logger.write(`info [HUD] ${panel} window created (${opaque ? 'opaque' : 'see-through'})`)
    return win
  }

  private placeAll () {
    for (const panel of PANELS) this.place(panel)
  }

  private place (panel: HudPanel) {
    const pw = this.windows[panel]
    const win = pw.win
    if (!win || win.isDestroyed() || !this.cfg) return
    const pos = this.position(panel)
    const game = OverlayController.targetBounds
    const { width, height } = pw.size
    let x = Math.round(pos.x)
    let y = Math.round(pos.y)
    if (game.width > 0 && game.height > 0) {
      // keep it inside the game window
      x = Math.max(0, Math.min(game.width - width, x))
      y = Math.max(0, Math.min(game.height - height, y))
      x += game.x
      y += game.y
    }
    win.setBounds({ x, y, width, height })
  }

  // Dragging is done here, not in the page: Windows only lets the foreground
  // window capture the mouse, and the HUD never becomes the foreground window,
  // so the page loses the pointer as soon as it leaves the window.
  private startDrag (panel: HudPanel) {
    if (!this.cfg || this.drag || !this.windows[panel]) return
    const cursor = screen.getCursorScreenPoint()
    const pos = this.position(panel)
    this.drag = {
      panel,
      cursorX: cursor.x,
      cursorY: cursor.y,
      x: pos.x,
      y: pos.y,
      started: Date.now(),
      timer: setInterval(() => { this.followCursor() }, 16)
    }
  }

  private setPosition (panel: HudPanel, x: number, y: number) {
    if (!this.cfg) return
    this.cfg.pos = { ...DEFAULT_POS, ...this.cfg.pos, [panel]: { x, y } }
  }

  private followCursor () {
    const drag = this.drag
    if (!drag || !this.cfg) return
    // safety net in case the mouse-up was missed
    if (Date.now() - drag.started > 60_000) { this.endDrag(); return }
    const cursor = screen.getCursorScreenPoint()
    this.setPosition(drag.panel,
      Math.round(drag.x + cursor.x - drag.cursorX),
      Math.round(drag.y + cursor.y - drag.cursorY))
    this.place(drag.panel)
  }

  private endDrag () {
    const drag = this.drag
    if (!drag || !this.cfg) return
    const cursor = screen.getCursorScreenPoint()
    clearInterval(drag.timer)
    this.drag = undefined
    let x = Math.round(drag.x + cursor.x - drag.cursorX)
    let y = Math.round(drag.y + cursor.y - drag.cursorY)
    // store the clamped position (what you see), then let the overlay save it
    const game = OverlayController.targetBounds
    const size = this.windows[drag.panel].size
    if (game.width > 0 && game.height > 0) {
      x = Math.max(0, Math.min(game.width - size.width, x))
      y = Math.max(0, Math.min(game.height - size.height, y))
    }
    this.setPosition(drag.panel, x, y)
    this.place(drag.panel)
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::hud-moved',
      payload: { panel: drag.panel, x, y }
    })
  }

  private destroy (panel: HudPanel) {
    const pw = this.windows[panel]
    if (pw.win && !pw.win.isDestroyed()) pw.win.destroy()
    pw.win = undefined
  }
}
