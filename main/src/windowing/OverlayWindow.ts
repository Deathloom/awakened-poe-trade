import { lockToAppPages, hardenWebview, denyWebviewPermissions, openWebLink, isWebLink } from '../safe-open'
import path from 'path'
import { app, BrowserWindow, dialog, shell, Menu, WebContents, session } from 'electron'
import { OverlayController, OVERLAY_WINDOW_OPTS } from 'electron-overlay-window'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { GameWindow } from './GameWindow'

const OVERLAY_BROWSER_PARTITION = 'persist:overlay-browser'

export class OverlayWindow {
  public isInteractable = false
  public wasUsedRecently = true
  private window?: BrowserWindow
  private overlayKey: string = 'Shift + Space'
  private isOverlayKeyUsed = false

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private poeWindow: GameWindow,
  ) {
    this.server.onEventAnyClient('OVERLAY->MAIN::focus-game', this.assertGameActive)
    this.poeWindow.on('active-change', this.handlePoeWindowActiveChange)
    this.poeWindow.onAttach(this.handleOverlayAttached)

    this.server.onEventAnyClient('CLIENT->MAIN::used-recently', (e) => {
      this.wasUsedRecently = e.isOverlay
    })

    if (process.argv.includes('--no-overlay')) return

    this.window = new BrowserWindow({
      icon: path.join(__dirname, process.env.STATIC!, 'icon.png'),
      ...OVERLAY_WINDOW_OPTS,
      width: 800,
      height: 600,
      webPreferences: {
        // Deathloom fork: Electron's secure defaults, stated explicitly
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        allowRunningInsecureContent: false,
        webviewTag: true,
        spellcheck: false
      }
    })

    // Deathloom fork (F1 review): DevTools only in development, or when started
    // with --devtools (for support); installed builds keep Edit and Reload
    const devTools = !app.isPackaged || process.argv.includes('--devtools')
    this.window.setMenu(Menu.buildFromTemplate([
      { role: 'editMenu' },
      { role: 'reload' },
      ...(devTools ? [{ role: 'toggleDevTools' as const }] : [])
    ]))

    this.window.webContents.on('before-input-event', this.handleExtraCommands)
    this.window.webContents.on('did-attach-webview', (_, webviewWebContents) => {
      webviewWebContents.on('before-input-event', this.handleExtraCommands)
      // Deathloom fork: pop-ups open in the browser; the page itself only goes to web links
      webviewWebContents.setWindowOpenHandler((details) => {
        openWebLink(details.url)
        return { action: 'deny' }
      })
      webviewWebContents.on('will-navigate', (e, url) => { if (!isWebLink(url)) e.preventDefault() })
      // Deathloom fork (F1 review): redirects held to web links too
      webviewWebContents.on('will-redirect', (e, url) => { if (!isWebLink(url)) e.preventDefault() })
    })
    const browserSession = session.fromPartition(OVERLAY_BROWSER_PARTITION)
    denyWebviewPermissions(browserSession)
    // Deathloom fork (F1 review, Gerhard 20 Nov 2026): nothing is downloaded through
    // the overlay browser (same as the trade / lab tabs); open the page in your browser
    browserSession.on('will-download', (e, item) => {
      e.preventDefault()
      this.logger.write(`info [browser] download blocked: ${item.getFilename().slice(0, 80)}`)
    })

    // Deathloom fork: web links only, and the window stays on the overlay's pages
    lockToAppPages(this.window.webContents)
    // Deathloom fork: <webview> (wiki / trade site browser) gets no preload, no Node,
    // runs sandboxed and only loads web links
    this.window.webContents.on('will-attach-webview', (e, webPreferences, params) => {
      // its own session: sign-ins there never reach the app's requests (/proxy)
      if (params.partition !== OVERLAY_BROWSER_PARTITION) e.preventDefault()
      else if (!hardenWebview(webPreferences, params.src)) e.preventDefault()
    })
  }

  loadAppPage (port: number) {
    const url = process.env.VITE_DEV_SERVER_URL ||
      `http://localhost:${port}/index.html`

    if (!this.window) {
      shell.openExternal(url)
      return
    }

    if (process.env.VITE_DEV_SERVER_URL) {
      this.window.loadURL(url)
      this.window.webContents.openDevTools({ mode: 'detach', activate: false })
    } else {
      this.window.loadURL(url)
    }
  }

  assertOverlayActive = () => {
    if (!this.isInteractable) {
      this.isInteractable = true
      OverlayController.activateOverlay()
      this.poeWindow.isActive = false
    }
  }

  assertGameActive = () => {
    if (this.isInteractable) {
      this.isInteractable = false
      OverlayController.focusTarget()
      this.poeWindow.isActive = true
    }
  }

  toggleActiveState = () => {
    this.isOverlayKeyUsed = true
    if (this.isInteractable) {
      this.assertGameActive()
    } else {
      this.assertOverlayActive()
    }
  }

  updateOpts (overlayKey: string, windowTitle: string) {
    this.overlayKey = overlayKey
    this.poeWindow.attach(this.window, windowTitle)
  }

  private handleExtraCommands = (event: Electron.Event, input: Electron.Input) => {
    if (input.type !== 'keyDown') return

    let { code, control: ctrlKey, shift: shiftKey, alt: altKey } = input

    if (code.startsWith('Key')) {
      code = code.slice('Key'.length)
    } else if (code.startsWith('Digit')) {
      code = code.slice('Digit'.length)
    }

    if (shiftKey && altKey) code = `Shift + Alt + ${code}`
    else if (ctrlKey && shiftKey) code = `Ctrl + Shift + ${code}`
    else if (ctrlKey && altKey) code = `Ctrl + Alt + ${code}`
    else if (altKey) code = `Alt + ${code}`
    else if (ctrlKey) code = `Ctrl + ${code}`
    else if (shiftKey) code = `Shift + ${code}`

    switch (code) {
      case 'Escape':
      case 'Ctrl + W': {
        event.preventDefault()
        process.nextTick(this.assertGameActive)
        break
      }
      case this.overlayKey: {
        event.preventDefault()
        process.nextTick(this.toggleActiveState)
        break
      }
    }
  }

  private handleOverlayAttached = (hasAccess?: boolean) => {
    if (hasAccess === false) {
      this.logger.write('error [Overlay] PoE is running with administrator rights')

      dialog.showErrorBox(
        'PoE window - No access',
        // ----------------------
        'Path of Exile is running with administrator rights.\n' +
        '\n' +
        'You need to restart Orbhoarder with administrator rights.'
      )
    } else {
      this.server.sendEventTo('broadcast', {
        name: 'MAIN->OVERLAY::overlay-attached',
        payload: undefined
      })
    }
  }

  private handlePoeWindowActiveChange = (isActive: boolean) => {
    if (isActive && this.isInteractable) {
      this.isInteractable = false
    }
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->OVERLAY::focus-change',
      payload: {
        game: isActive,
        overlay: this.isInteractable,
        usingHotkey: this.isOverlayKeyUsed
      }
    })
    this.isOverlayKeyUsed = false
  }
}
