// Deathloom fork: Loot Goblin's desktop window.
// A normal window (title bar, resizable, any monitor) with all panels in one
// place, meant for a second screen next to the game. It shows the same pages
// as the overlay (index.html?desktop) and connects like the HUD windows, so it
// never becomes the "last active" overlay client (price check, hotkeys and
// replies meant for the overlay don't go to it). It never draws over the game
// and is not always on top. Its position and size are kept in
// apt-data/desktop-window.json (not in the overlay's settings).

import path from 'path'
import fs from 'fs'
import { app, BrowserWindow, screen, type Rectangle } from 'electron'
import { lockToAppPages } from '../safe-open'
import { guardTradeWebview, isTradePage, prepareTradeWebview } from './trade-tab'
import type { Logger } from '../RemoteLogger'

const DEFAULT_SIZE = { width: 1280, height: 860 }
const MIN_SIZE = { width: 720, height: 480 }

interface SavedBounds extends Rectangle {
  maximized?: boolean
}

export class DesktopWindow {
  private win?: BrowserWindow
  private port = 0
  private openWhenReady = false
  private readonly boundsFile = path.join(app.getPath('userData'), 'apt-data', 'desktop-window.json')

  constructor (private logger: Logger) {}

  setPort (port: number) {
    this.port = port
    if (this.openWhenReady) {
      this.openWhenReady = false
      this.open({ focus: false })
    }
  }

  // Settings: open the desktop window when the game starts (once per game
  // session; if it's closed while playing it stays closed until the next launch)
  private openWithGame = false
  private gameRunning = false
  configure (openWithGame: boolean) {
    const turnedOn = openWithGame && !this.openWithGame
    this.openWithGame = openWithGame
    // switched on while the game is already running: open now
    // (also when Loot Goblin starts while the game is already running)
    if (turnedOn && this.gameRunning) this.open({ focus: false })
  }

  gameStarted () {
    if (this.gameRunning) return
    this.gameRunning = true
    if (this.openWithGame) this.open({ focus: false })
  }

  gameClosed () {
    this.gameRunning = false
  }

  open (opts: { focus: boolean } = { focus: true }) {
    if (!this.port && !process.env.VITE_DEV_SERVER_URL) {
      this.openWhenReady = true
      return
    }
    if (this.win && !this.win.isDestroyed()) {
      if (this.win.isMinimized()) this.win.restore()
      this.win.show()
      if (opts.focus) this.win.focus()
      return
    }
    const saved = this.loadBounds()
    let win: BrowserWindow
    try {
      win = new BrowserWindow({
        title: 'Loot Goblin',
        icon: path.join(__dirname, process.env.STATIC!, 'icon.png'),
        ...(saved ? { x: saved.x, y: saved.y, width: saved.width, height: saved.height } : DEFAULT_SIZE),
        minWidth: MIN_SIZE.width,
        minHeight: MIN_SIZE.height,
        show: false,
        backgroundColor: '#111827',
        autoHideMenuBar: true,
        webPreferences: {
          allowRunningInsecureContent: false,
          // the Trade site tab (official trade site, its own session)
          webviewTag: true,
          spellcheck: false
        }
      })
    } catch (err) {
      this.logger.write(`error [desktop] Failed to create window: ${(err as Error).message}`)
      return
    }
    this.win = win
    win.setMenu(null)
    lockToAppPages(win.webContents)
    // Trade site tab: only GGG's trade site, in its own session, no Node, no preload
    win.webContents.on('will-attach-webview', (e, webPreferences, params) => {
      if (!prepareTradeWebview(webPreferences, params)) e.preventDefault()
    })
    win.webContents.on('did-attach-webview', (_e, contents) => { guardTradeWebview(contents) })
    // the page sets its own title per panel; keep "Loot Goblin" in it
    win.on('page-title-updated', (e, title) => {
      if (!title.startsWith('Loot Goblin')) e.preventDefault()
    })
    win.once('ready-to-show', () => {
      if (saved?.maximized) win.maximize()
      if (opts.focus) win.show()
      else win.showInactive()
    })
    win.on('close', () => { this.saveBounds(win) })
    win.on('closed', () => { if (this.win === win) this.win = undefined })

    const base = process.env.VITE_DEV_SERVER_URL || `http://localhost:${this.port}/index.html`
    const trade = this.pendingTrade
    const view = this.pendingView
    this.pendingTrade = undefined
    this.pendingView = undefined
    void win.loadURL(`${base}${base.includes('?') ? '&' : '?'}desktop=1` +
      (trade ? `&trade=${encodeURIComponent(trade)}` : '') +
      (view ? `&view=${encodeURIComponent(view)}` : ''))
  }

  // Opens a trade site page in the window's Trade site tab (from the overlay's
  // market search or a price check). Returns false for anything that isn't a
  // page on GGG's trade site.
  private pendingTrade?: string
  openTrade (url: string, broadcast: (url: string) => void): boolean {
    if (!isTradePage(url)) return false
    if (this.win && !this.win.isDestroyed()) {
      this.open({ focus: false })
      broadcast(url)
    } else {
      this.pendingTrade = url
      this.open({ focus: false })
    }
    return true
  }

  // A panel set to show only in this window: its hotkey opens the window on that tab
  private pendingView?: string
  openView (view: string, broadcast: (view: string) => void) {
    if (!/^[a-z]+$/.test(view)) return
    if (this.win && !this.win.isDestroyed()) {
      this.open({ focus: false })
      broadcast(view)
    } else {
      this.pendingView = view
      this.open({ focus: false })
    }
  }

  private loadBounds (): SavedBounds | null {
    try {
      const b = JSON.parse(fs.readFileSync(this.boundsFile, 'utf8')) as SavedBounds
      if (![b.x, b.y, b.width, b.height].every(n => typeof n === 'number' && Number.isFinite(n))) return null
      const width = Math.max(MIN_SIZE.width, Math.min(b.width, 10000))
      const height = Math.max(MIN_SIZE.height, Math.min(b.height, 10000))
      // only reuse the position if the title bar is still on a screen
      // (second monitor unplugged → open on the main one)
      const titleBar = { x: b.x + 40, y: b.y + 10, width: Math.max(1, width - 80), height: 20 }
      const visible = screen.getAllDisplays().some(d => intersects(d.workArea, titleBar))
      if (!visible) return { ...centred(width, height), maximized: b.maximized }
      return { x: b.x, y: b.y, width, height, maximized: b.maximized }
    } catch {
      return null
    }
  }

  private saveBounds (win: BrowserWindow) {
    try {
      const b = win.isMaximized() || win.isMinimized() ? win.getNormalBounds() : win.getBounds()
      fs.mkdirSync(path.dirname(this.boundsFile), { recursive: true })
      fs.writeFileSync(this.boundsFile, JSON.stringify({ ...b, maximized: win.isMaximized() }))
    } catch (err) {
      this.logger.write(`warn [desktop] Couldn't save the window position: ${(err as Error).message}`)
    }
  }
}

function intersects (a: Rectangle, b: Rectangle) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

function centred (width: number, height: number): Rectangle {
  const area = screen.getPrimaryDisplay().workArea
  return {
    x: Math.round(area.x + (area.width - Math.min(width, area.width)) / 2),
    y: Math.round(area.y + (area.height - Math.min(height, area.height)) / 2),
    width: Math.min(width, area.width),
    height: Math.min(height, area.height)
  }
}
