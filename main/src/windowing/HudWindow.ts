import { lockToAppPages } from '../safe-open'
// Deathloom fork: "show while playing" HUD.
// Pinned panels (campaign guide, trade companion, build gear) each get a small
// window of their own that stays on top of the game while it has focus. Unlike
// the full-screen overlay these are only as big as the panel, never take focus
// (clicks don't pull focus away from the game), can be click-through or opaque,
// and each has its own position. Nothing here reads game memory or sends input
// to the game.

import path from 'path'
import { BrowserWindow, screen } from 'electron'
import { uIOhook } from 'uiohook-napi'
import { OverlayController, type MoveresizeEvent } from 'electron-overlay-window'
import type { PobHudConfig, HudPanel } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { GameWindow } from './GameWindow'
import type { OverlayWindow } from './OverlayWindow'

export type { HudPanel }
const PANELS: HudPanel[] = ['guide', 'trades', 'gear', 'tree', 'atlas', 'session', 'market', 'overview', 'cheats', 'money', 'board', 'search', 'progress']
const DEFAULT_POS: Record<HudPanel, { x: number, y: number }> = {
  guide: { x: 10, y: 90 },
  trades: { x: 10, y: 420 },
  gear: { x: 440, y: 90 },
  tree: { x: 880, y: 90 },
  atlas: { x: 880, y: 90 },
  session: { x: 880, y: 440 },
  market: { x: 440, y: 440 },
  overview: { x: 440, y: 440 },
  cheats: { x: 880, y: 90 },
  money: { x: 880, y: 440 },
  board: { x: 440, y: 90 },
  search: { x: 440, y: 90 },
  progress: { x: 880, y: 90 }
}

// Not in a zone: the game just started ("***** LOG FILE OPENING *****" is the
// first line of every session) or is connecting to the login server
// ("Async connecting to lon.login.pathofexile.com:20487": login, or back to
// character select)
const LOGIN_SERVER = /\*{5} LOG FILE OPENING \*{5}|Async connecting to \S+\.login\./
// 'Generating level 1 area "1_1_1"' (any client language) or ": You have entered The Coast."
const ZONE = /Generating level \d+ area "|\] : You have entered /

// Deathloom fork (idea 16, step 1): a pinned panel's window is only made when the
// panel is first shown, and is closed again a while after you close the panel
// with its hotkey (less memory and CPU with many pinned panels). These keep
// their page while closed because they work in the background: whispers
// (trades), price alerts (market), the play session timer (session).
const KEEP_ALIVE: ReadonlySet<HudPanel> = new Set<HudPanel>(['trades', 'market', 'session'])
const UNLOAD_AFTER_MS = 2 * 60_000

// Deathloom fork (idea 16, step 2, opt-in "sharedWindow"): all pinned panels in
// one see-through window the size of the game window. It ignores the mouse
// (clicks go to the game, or to the overlay under it) except while the pointer
// is over a panel that takes clicks; the page reports which panel it is over
// (forwarded mouse moves). One page instead of one per panel.
interface SharedWindow {
  win?: BrowserWindow
  unloadTimer?: NodeJS.Timeout
  shown?: boolean
  // panel under the pointer, from the page
  hover: HudPanel | null
}

interface PanelWindow {
  win?: BrowserWindow
  // closes the window of a panel closed with its hotkey
  unloadTimer?: NodeJS.Timeout
  // last state set by update(): on screen, or invisible + click-through
  shown?: boolean
  builtOpaque?: boolean
  size: { width: number, height: number }
}

export class HudWindow {
  private cfg?: PobHudConfig
  private port = 0
  private windows: Record<HudPanel, PanelWindow> = {
    guide: { size: { width: 320, height: 200 } },
    trades: { size: { width: 384, height: 60 } },
    gear: { size: { width: 416, height: 300 } },
    tree: { size: { width: 480, height: 400 } },
    atlas: { size: { width: 544, height: 430 } },
    session: { size: { width: 352, height: 400 } },
    market: { size: { width: 416, height: 400 } },
    overview: { size: { width: 480, height: 430 } },
    cheats: { size: { width: 384, height: 420 } },
    money: { size: { width: 416, height: 430 } },
    board: { size: { width: 416, height: 450 } },
    search: { size: { width: 416, height: 420 } },
    progress: { size: { width: 384, height: 420 } }
  }

  private shared: SharedWindow = { hover: null }
  private lastPlaying = true

  private resize?: { panel: HudPanel, cursorX: number, cursorY: number, w: number, h: number, lastW: number, lastH: number, timer: NodeJS.Timeout, started: number }
  private drag?: { panel: HudPanel, cursorX: number, cursorY: number, x: number, y: number, timer: NodeJS.Timeout, started: number }
  // Pinned panels start closed each time the app starts; their hotkey opens and
  // closes them (a trade whisper opens the trade companion). Not saved.
  private hidden: Record<HudPanel, boolean> = { guide: true, trades: true, gear: true, tree: true, atlas: true, session: true, market: true, overview: true, cheats: true, money: true, board: true, search: true, progress: true }
  // Only show once a character is in a zone, not on the login / character select screens
  private inWorld = false
  // no Client.txt being read: can't tell, so behave as before (show with the game)
  private readingLog = false
  // left/any mouse button held (from the global mouse hook)
  private mouseDown = false
  // panel that has the keyboard right now (import box in the build panel)
  private typing: HudPanel | null = null

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
      // shared window: the page lays the panels out; the size is only for clamping
      if (!this.isShared()) this.place(e.panel)
      else this.applySharedMouse()
    })
    this.server.onEventAnyClient('CLIENT->MAIN::hud-hover', (e) => {
      this.shared.hover = e.panel
      this.applySharedMouse()
    })
    this.server.onEventAnyClient('CLIENT->MAIN::hud-drag', (e) => {
      this.logger.write(`debug [HUD] drag ${e.phase} ${e.panel}${this.drag ? ' (drag active: ' + this.drag.panel + ')' : ''}`)
      if (e.phase === 'start') this.startDrag(e.panel)
      else if (e.phase === 'end') this.endDrag()
    })
    this.server.onEventAnyClient('CLIENT->MAIN::hud-resize', (e) => {
      if (e.phase === 'start') this.startResize(e.panel, e.w, e.h)
      else this.endResize()
    })
    this.server.onEventAnyClient('CLIENT->MAIN::hud-typing', (e) => {
      this.setTyping(e.panel, e.on)
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
    uIOhook.on('mousedown', () => { this.mouseDown = true })
    uIOhook.on('mouseup', () => { this.mouseDown = false; this.endDrag(); this.endResize() })
  }

  // HUD windows never take focus (the game keeps it), except while a panel needs typing:
  // then that window may be focused; the game gets focus back when typing ends
  private setTyping (panel: HudPanel, on: boolean) {
    const win = this.isShared() ? this.shared.win : this.windows[panel]?.win
    if (on) {
      if (!win || win.isDestroyed()) return
      this.typing = panel
      win.setFocusable(true)
      win.setIgnoreMouseEvents(false)
      win.focus()
      this.logger.write(`debug [HUD] ${panel} typing on`)
    } else {
      if (this.typing !== panel) return
      this.typing = null
      if (win && !win.isDestroyed()) {
        win.setFocusable(false)
        if (win.isFocused()) OverlayController.focusTarget()
      }
      this.logger.write(`debug [HUD] ${panel} typing off`)
    }
    this.update()
  }

  private isShared () {
    return Boolean(this.cfg?.sharedWindow)
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
    const shared = this.isShared()
    for (const panel of PANELS) {
      const pw = this.windows[panel]
      // unpinned, switched to the shared window, or see-through <-> solid changed (needs a new window)
      if (shared || !this.isPinned(panel) || (pw.win && pw.builtOpaque !== Boolean(cfg?.opaque))) {
        this.destroy(panel)
      }
    }
    if (!shared || !PANELS.some(p => this.isPinned(p))) this.destroyShared()
    this.update()
  }

  private position (panel: HudPanel) {
    return this.cfg?.pos?.[panel] ?? DEFAULT_POS[panel]
  }

  // Called when the game or the overlay gains/loses focus, and on any HUD change
  update = () => {
    if (!this.cfg || !this.port) return
    // typing into a HUD panel takes focus from the game, but you're still playing
    const playing = this.poeWindow.isActive || this.typing !== null
    const onScreen = (playing || this.overlay.isInteractable) && (this.inWorld || !this.readingLog)
    this.lastPlaying = playing

    if (this.isShared()) {
      this.updateShared(onScreen)
    } else for (const panel of PANELS) {
      if (!this.isPinned(panel)) continue
      const show = onScreen && !this.hidden[panel]
      const pw = this.windows[panel]
      this.scheduleUnload(panel)
      // background panels keep their page while hidden (the companion keeps reading
      // whispers); the others get a window when first shown
      if (!show && !KEEP_ALIVE.has(panel) && !(pw.win && !pw.win.isDestroyed())) continue
      const win = this.ensureWindow(panel)
      if (!win) continue
      if (!show) {
        // Not hide(): after hide() + showInactive() (alt-tab away and back) Windows
        // stopped sending clicks to some panels. Invisible and click-through instead.
        if (pw.shown !== false) {
          win.setOpacity(0)
          win.setIgnoreMouseEvents(true)
          pw.shown = false
        }
        continue
      }
      // Click-through only while playing; with the overlay active (Shift+Space) you can always click and drag.
      // Always set twice: Electron skips the call when it thinks nothing changed.
      const ignore = Boolean(this.cfg.clickThroughPanels?.[panel] && playing && this.typing !== panel)
      win.setIgnoreMouseEvents(!ignore)
      win.setIgnoreMouseEvents(ignore)
      win.setOpacity(Math.max(30, Math.min(100, this.cfg.opacity || 100)) / 100)
      this.place(panel)
      if (!win.isVisible()) win.showInactive()
      pw.shown = true
      // keep it above the full-screen overlay window too (also after the overlay was activated)
      win.setAlwaysOnTop(true, 'screen-saver')
      win.moveTop()
    }
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::hud-state',
      payload: { playing, hidden: { ...this.hidden } }
    })
  }

  private updateShared (onScreen: boolean) {
    const sw = this.shared
    const pinned = PANELS.filter(p => this.isPinned(p))
    const show = onScreen && pinned.some(p => !this.hidden[p])
    // every pinned panel closed with its hotkey and none works in the background: free the window after a while
    const closed = pinned.every(p => this.hidden[p] && !KEEP_ALIVE.has(p)) && this.typing === null
    if (!closed || !sw.win) {
      if (sw.unloadTimer) { clearTimeout(sw.unloadTimer); sw.unloadTimer = undefined }
    } else if (!sw.unloadTimer) {
      sw.unloadTimer = setTimeout(() => {
        sw.unloadTimer = undefined
        if (PANELS.every(p => !this.isPinned(p) || (this.hidden[p] && !KEEP_ALIVE.has(p))) && !this.drag && !this.resize) {
          this.destroyShared()
          this.logger.write(`info [HUD] shared window closed (panels closed for ${UNLOAD_AFTER_MS / 60_000} min)`)
        }
      }, UNLOAD_AFTER_MS)
    }
    if (!pinned.length) return
    if (!show && !pinned.some(p => KEEP_ALIVE.has(p)) && !(sw.win && !sw.win.isDestroyed())) return
    const win = this.ensureShared()
    if (!win) return
    if (!show) {
      if (sw.shown !== false) {
        win.setOpacity(0)
        win.setIgnoreMouseEvents(true)
        sw.shown = false
      }
      return
    }
    // the page sets each panel's opacity; transparent space must stay fully see-through
    win.setOpacity(1)
    this.placeShared()
    if (!win.isVisible()) win.showInactive()
    sw.shown = true
    this.applySharedMouse()
    win.setAlwaysOnTop(true, 'screen-saver')
    win.moveTop()
  }

  // Clickable only while the pointer is over a shown panel that takes clicks
  // (and the cursor really is inside it: a missed pointer-leave must not block
  // the game). Everywhere else: ignore the mouse but forward moves to the page.
  private applySharedMouse () {
    const sw = this.shared
    const win = sw.win
    if (!win || win.isDestroyed() || !this.cfg) return
    const p = sw.hover
    const clickable = sw.shown === true && (this.typing !== null || (p !== null &&
      this.isPinned(p) && !this.hidden[p] &&
      !(this.cfg.clickThroughPanels?.[p] && this.lastPlaying) &&
      this.cursorOver(p)))
    // set twice: Electron skips the call when it thinks nothing changed
    if (clickable) {
      win.setIgnoreMouseEvents(true, { forward: true })
      win.setIgnoreMouseEvents(false)
    } else if (sw.shown === true) {
      win.setIgnoreMouseEvents(false)
      win.setIgnoreMouseEvents(true, { forward: true })
    }
  }

  // panel's top-left corner on screen
  private panelOrigin (panel: HudPanel) {
    const pos = this.position(panel)
    const game = OverlayController.targetBounds
    const { width, height } = this.windows[panel].size
    if (!(game.width > 0 && game.height > 0)) return { x: Math.round(pos.x), y: Math.round(pos.y) }
    return {
      x: game.x + Math.max(0, Math.min(game.width - width, Math.round(pos.x))),
      y: game.y + Math.max(0, Math.min(game.height - height, Math.round(pos.y)))
    }
  }

  private cursorOver (panel: HudPanel) {
    const c = screen.getCursorScreenPoint()
    const o = this.panelOrigin(panel)
    const { width, height } = this.windows[panel].size
    // a few pixels of slack: the reported size is rounded
    return c.x >= o.x - 4 && c.y >= o.y - 4 && c.x <= o.x + width + 4 && c.y <= o.y + height + 4
  }

  private ensureShared (): BrowserWindow | undefined {
    const sw = this.shared
    if (sw.win && !sw.win.isDestroyed()) return sw.win
    let win: BrowserWindow
    try {
      win = new BrowserWindow({
        icon: path.join(__dirname, process.env.STATIC!, 'icon.png'),
        width: 800,
        height: 600,
        show: false,
        frame: false,
        // always see-through: it covers the whole game ("Solid background" applies to one-window-each)
        transparent: true,
        backgroundColor: '#00000000',
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
          // Deathloom fork: Electron's secure defaults, stated explicitly
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          allowRunningInsecureContent: false,
          spellcheck: false,
          backgroundThrottling: false
        }
      })
    } catch (err) {
      this.logger.write(`error [HUD] Failed to create shared window: ${(err as Error).message}`)
      return undefined
    }
    sw.win = win
    sw.shown = undefined
    sw.hover = null
    win.setMenu(null)
    win.setIgnoreMouseEvents(true, { forward: true })
    lockToAppPages(win.webContents)
    win.on('closed', () => { if (sw.win === win) sw.win = undefined })
    win.webContents.on('did-finish-load', () => { this.update() })
    win.on('blur', () => { if (this.typing !== null) this.setTyping(this.typing, false) })

    const base = process.env.VITE_DEV_SERVER_URL || `http://localhost:${this.port}/index.html`
    win.loadURL(`${base}${base.includes('?') ? '&' : '?'}hud=all`)
    this.logger.write('info [HUD] shared window created')
    return win
  }

  private placeShared () {
    const win = this.shared.win
    if (!win || win.isDestroyed()) return
    const game = OverlayController.targetBounds
    if (game.width > 0 && game.height > 0) {
      win.setBounds({ x: game.x, y: game.y, width: game.width, height: game.height })
    } else {
      win.setBounds(screen.getPrimaryDisplay().bounds)
    }
  }

  private destroyShared () {
    const sw = this.shared
    if (sw.unloadTimer) { clearTimeout(sw.unloadTimer); sw.unloadTimer = undefined }
    if (sw.win && !sw.win.isDestroyed()) sw.win.destroy()
    sw.win = undefined
    sw.hover = null
  }

  // closed with its hotkey (not just alt-tabbed away): free the window after a while
  private scheduleUnload (panel: HudPanel) {
    const pw = this.windows[panel]
    const closed = this.hidden[panel] && !KEEP_ALIVE.has(panel) && this.typing !== panel
    if (!closed || !pw.win) {
      if (pw.unloadTimer) { clearTimeout(pw.unloadTimer); pw.unloadTimer = undefined }
      return
    }
    if (pw.unloadTimer) return
    pw.unloadTimer = setTimeout(() => {
      pw.unloadTimer = undefined
      if (this.hidden[panel] && this.drag?.panel !== panel && this.resize?.panel !== panel) {
        this.destroy(panel)
        this.logger.write(`info [HUD] ${panel} window closed (panel closed for ${UNLOAD_AFTER_MS / 60_000} min)`)
      }
    }, UNLOAD_AFTER_MS)
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
          // Deathloom fork: Electron's secure defaults, stated explicitly
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
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
    pw.shown = undefined
    win.setMenu(null)
    lockToAppPages(win.webContents)
    win.on('closed', () => { if (pw.win === win) pw.win = undefined })
    // a page made after the last hud-state missed it (it starts with every panel hidden)
    win.webContents.on('did-finish-load', () => { this.update() })
    // clicked back into the game while typing: the panel asks again on its next click
    win.on('blur', () => { if (this.typing === panel) this.setTyping(panel, false) })

    const base = process.env.VITE_DEV_SERVER_URL || `http://localhost:${this.port}/index.html`
    win.loadURL(`${base}${base.includes('?') ? '&' : '?'}hud=${panel}`)
    this.logger.write(`info [HUD] ${panel} window created (${opaque ? 'opaque' : 'see-through'})`)
    return win
  }

  private placeAll () {
    if (this.isShared()) { this.placeShared(); return }
    for (const panel of PANELS) this.place(panel)
  }

  private place (panel: HudPanel) {
    const pw = this.windows[panel]
    const win = pw.win
    if (!win || win.isDestroyed() || !this.cfg) return
    if (this.isShared()) return
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
    if (!this.cfg || !this.windows[panel]) return
    // a drag that somehow never ended must not block new ones
    if (this.drag) { clearInterval(this.drag.timer); this.drag = undefined }
    // the button may already be up again (a quick click): nothing to drag
    if (!this.mouseDown) return
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
    // safety nets in case the mouse-up was missed
    if (!this.mouseDown || Date.now() - drag.started > 60_000) { this.endDrag(); return }
    const cursor = screen.getCursorScreenPoint()
    const x = Math.round(drag.x + cursor.x - drag.cursorX)
    const y = Math.round(drag.y + cursor.y - drag.cursorY)
    this.setPosition(drag.panel, x, y)
    if (this.isShared()) {
      this.server.sendEventTo('broadcast', { name: 'MAIN->CLIENT::hud-pos', payload: { panel: drag.panel, x, y } })
    } else {
      this.place(drag.panel)
    }
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
    if (this.isShared()) {
      this.server.sendEventTo('broadcast', { name: 'MAIN->CLIENT::hud-pos', payload: { panel: drag.panel, x, y } })
      this.applySharedMouse()
    }
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::hud-moved',
      payload: { panel: drag.panel, x, y }
    })
  }

  // Corner resize: like dragging, main follows the real cursor (the page can't
  // capture the mouse). The page applies the size; its window then fits the panel.
  private startResize (panel: HudPanel, w: number, h: number) {
    if (!this.cfg || !this.windows[panel]) return
    if (this.resize) { clearInterval(this.resize.timer); this.resize = undefined }
    if (!this.mouseDown) return
    const cursor = screen.getCursorScreenPoint()
    this.resize = {
      panel,
      cursorX: cursor.x,
      cursorY: cursor.y,
      w,
      h,
      lastW: w,
      lastH: h,
      started: Date.now(),
      timer: setInterval(() => { this.followResize(false) }, 33)
    }
  }

  private followResize (done: boolean) {
    const r = this.resize
    if (!r) return
    if (!done && (!this.mouseDown || Date.now() - r.started > 60_000)) { this.endResize(); return }
    const cursor = screen.getCursorScreenPoint()
    // keep the bottom-right corner inside the game window (else it can't be grabbed again)
    const game = OverlayController.targetBounds
    const b = this.isShared() ? this.panelOrigin(r.panel) : this.windows[r.panel].win?.getBounds()
    const area = (game.width > 0 && game.height > 0) ? game : screen.getDisplayNearestPoint(cursor).workArea
    const maxW = b ? Math.max(200, Math.min(1400, area.x + area.width - b.x - 8)) : 1400
    const maxH = b ? Math.max(80, Math.min(1400, area.y + area.height - b.y - 8)) : 1400
    const w = Math.round(Math.max(200, Math.min(maxW, r.w + cursor.x - r.cursorX)))
    const h = Math.round(Math.max(80, Math.min(maxH, r.h + cursor.y - r.cursorY)))
    if (!done && w === r.lastW && h === r.lastH) return
    r.lastW = w
    r.lastH = h
    if (done && this.cfg) this.cfg.dims = { ...this.cfg.dims, [r.panel]: { w, h } }
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::hud-dims',
      payload: { panel: r.panel, w, h, done }
    })
  }

  private endResize () {
    const r = this.resize
    if (!r) return
    clearInterval(r.timer)
    this.followResize(true)
    this.resize = undefined
  }

  private destroy (panel: HudPanel) {
    const pw = this.windows[panel]
    if (pw.unloadTimer) { clearTimeout(pw.unloadTimer); pw.unloadTimer = undefined }
    if (pw.win && !pw.win.isDestroyed()) pw.win.destroy()
    pw.win = undefined
  }
}
