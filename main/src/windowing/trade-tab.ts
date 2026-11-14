// Deathloom fork: the official trade site inside the Loot Goblin window.
//
// GGG rules: this is just a browser tab on GGG's own site. You sign in on GGG's
// own page; Loot Goblin never reads, copies or sends the site's cookies or your
// password, and never clicks or types on the page for you. The tab keeps its
// own session (partition below), separate from the session the app uses for
// its own trade API calls, so nothing logged in ever reaches the app.

import { session, type WebContents, type WebPreferences } from 'electron'
import { openWebLink } from '../safe-open'

export const TRADE_PARTITION = 'persist:loot-goblin-trade-site'

// Where the tab may go: GGG's site plus the sign-in pages its "Sign in with"
// buttons lead to (Steam, Epic, Xbox/Microsoft, PlayStation). Anything else
// opens in your normal browser.
const ALLOWED_HOSTS = [
  'pathofexile.com',
  'steamcommunity.com', 'steampowered.com',
  'epicgames.com',
  'live.com', 'microsoftonline.com', 'xboxlive.com', 'xbox.com', 'microsoft.com',
  'playstation.com', 'sonyentertainmentnetwork.com',
  // GGG's site loads its sign-in captcha from these
  'hcaptcha.com', 'recaptcha.net', 'google.com', 'gstatic.com'
]

export function isTradeTabHost (url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

// A trade page the app itself may open in the tab (search results, a search query)
export function isTradePage (url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' &&
      (u.hostname === 'www.pathofexile.com' || u.hostname === 'pathofexile.com') &&
      u.pathname.startsWith('/trade')
  } catch {
    return false
  }
}

let sessionReady = false
function hardenSession () {
  if (sessionReady) return
  sessionReady = true
  const ses = session.fromPartition(TRADE_PARTITION)
  // no notifications, camera, location, clipboard reads … for the site
  ses.setPermissionRequestHandler((_wc, _perm, cb) => { cb(false) })
  ses.setPermissionCheckHandler(() => false)
  // nothing gets downloaded through the tab
  ses.on('will-download', (e) => { e.preventDefault() })
}

// call from the window's 'will-attach-webview'
export function prepareTradeWebview (webPreferences: WebPreferences, params: Record<string, string>): boolean {
  delete webPreferences.preload
  webPreferences.nodeIntegration = false
  webPreferences.nodeIntegrationInSubFrames = false
  webPreferences.contextIsolation = true
  webPreferences.sandbox = true
  webPreferences.webSecurity = true
  webPreferences.allowRunningInsecureContent = false
  if (params.partition !== TRADE_PARTITION) return false
  if (params.src && params.src !== 'about:blank' && !isTradeTabHost(params.src)) return false
  hardenSession()
  return true
}

// call from the window's 'did-attach-webview'
export function guardTradeWebview (contents: WebContents) {
  // pop-ups: sign-in pages stay in the tab, everything else opens in the browser
  contents.setWindowOpenHandler((details) => {
    if (isTradeTabHost(details.url)) {
      void contents.loadURL(details.url)
    } else {
      openWebLink(details.url)
    }
    return { action: 'deny' }
  })
  const guard = (e: Electron.Event, url: string) => {
    if (!isTradeTabHost(url)) {
      e.preventDefault()
      openWebLink(url)
    }
  }
  contents.on('will-navigate', guard)
  contents.on('will-redirect', guard)
}
