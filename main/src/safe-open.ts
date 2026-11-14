// Deathloom fork: links from pages (window.open, target=_blank) open in the
// browser only when they are web links. Other schemes (file:, ms-*, custom
// protocol handlers) could start programs, so they're dropped.
import { shell, type WebContents } from 'electron'

export function isWebLink (url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function openWebLink (url: string, onlyHost?: string): void {
  if (!isWebLink(url)) {
    console.warn(`[links] not opened (not a web link): ${url.slice(0, 80)}`)
    return
  }
  if (onlyHost && new URL(url).host !== onlyHost) {
    console.warn(`[links] not opened (expected ${onlyHost}): ${url.slice(0, 80)}`)
    return
  }
  void shell.openExternal(url)
}

// Windows that show the overlay's own pages: links open in the browser, and the
// window itself never navigates away from the overlay (a remote page would get
// the window's privileges and the local server's address)
export function lockToAppPages (contents: WebContents): void {
  contents.setWindowOpenHandler((details) => {
    openWebLink(details.url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (e, url) => {
    let same = false
    try { same = new URL(url).origin === new URL(contents.getURL()).origin } catch {}
    if (!same) {
      e.preventDefault()
      openWebLink(url)
    }
  })
}

// Deathloom fork: <webview> pages (wiki / trade site browser in the overlay)
// run sandboxed with web security on, and only load web links.
export function hardenWebview (webPreferences: Electron.WebPreferences, src?: string): boolean {
  delete webPreferences.preload
  webPreferences.nodeIntegration = false
  webPreferences.nodeIntegrationInSubFrames = false
  webPreferences.contextIsolation = true
  webPreferences.sandbox = true
  webPreferences.webSecurity = true
  webPreferences.allowRunningInsecureContent = false
  return !src || src === 'about:blank' || isWebLink(src)
}

// Deathloom fork: web pages shown inside the app (webviews) get no browser
// permissions (camera, mic, notifications, geolocation, …). The app's own
// windows keep Electron's defaults.
export function denyWebviewPermissions (ses: Electron.Session): void {
  ses.setPermissionRequestHandler((wc, _perm, cb) => {
    cb(wc.getType() !== 'webview')
  })
  ses.setPermissionCheckHandler((wc) => {
    return wc == null || wc.getType() !== 'webview'
  })
}
