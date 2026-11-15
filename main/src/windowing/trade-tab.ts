// Deathloom fork: the official trade site inside the Orbhoarder window.
//
// GGG rules: this is just a browser tab on GGG's own site. You sign in on GGG's
// own page; Orbhoarder never reads, copies or sends the site's cookies or your
// password, and never clicks or types on the page for you. The tab keeps its
// own session (partition below), separate from the session the app uses for
// its own trade API calls, so nothing logged in ever reaches the app.

import { session, type WebContents, type WebPreferences } from 'electron'
import { openWebLink } from '../safe-open'

export const TRADE_PARTITION = 'persist:loot-goblin-trade-site'
// Lab tab: poelab.com (today's labyrinth layouts), shown as-is, ads included.
// Nothing is read from or copied off the page.
export const LAB_PARTITION = 'persist:loot-goblin-poelab'
const LAB_HOSTS = ['poelab.com']

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

function hostIn (url: string, hosts: string[]): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return hosts.some(h => u.hostname === h || u.hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

export function isTradeTabHost (url: string): boolean {
  return hostIn(url, ALLOWED_HOSTS)
}

// Each in-app site tab: its own session and the only hosts it may navigate to
interface SiteTab { partition: string, hosts: string[], ready: boolean }
const SITE_TABS: SiteTab[] = [
  { partition: TRADE_PARTITION, hosts: ALLOWED_HOSTS, ready: false },
  { partition: LAB_PARTITION, hosts: LAB_HOSTS, ready: false }
]

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

function hardenSession (tab: SiteTab) {
  if (tab.ready) return
  tab.ready = true
  const ses = session.fromPartition(tab.partition)
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
  const tab = SITE_TABS.find(t => t.partition === params.partition)
  if (!tab) return false
  if (params.src && params.src !== 'about:blank' && !hostIn(params.src, tab.hosts)) return false
  hardenSession(tab)
  return true
}

// call from the window's 'did-attach-webview'
export function guardTradeWebview (contents: WebContents) {
  // which tab this is (by its session); unknown → allowed nowhere
  const tab = SITE_TABS.find(t => contents.session === session.fromPartition(t.partition))
  const hosts = tab?.hosts ?? []
  const isLab = tab?.partition === LAB_PARTITION
  let lastExternal = 0
  // pop-ups: sign-in pages stay in the tab, everything else opens in the browser
  contents.setWindowOpenHandler((details) => {
    if (hostIn(details.url, hosts)) {
      void contents.loadURL(details.url)
    } else if (isLab) {
      // poelab has ads: only links (new tab), at most one a second, so a
      // pop-up ad can't flood your browser
      const now = Date.now()
      const isLink = details.disposition === 'foreground-tab' || details.disposition === 'background-tab'
      if (isLink && now - lastExternal > 1000) {
        lastExternal = now
        openWebLink(details.url)
      }
    } else {
      openWebLink(details.url)
    }
    return { action: 'deny' }
  })
  const guard = (e: Electron.Event<{ isMainFrame?: boolean }>, url: string) => {
    // ads / captchas in frames inside the page may redirect; only the page itself is held to the hosts
    if (e.isMainFrame === false) return
    if (!hostIn(url, hosts)) {
      e.preventDefault()
      openWebLink(url)
    }
  }
  contents.on('will-navigate', guard)
  contents.on('will-redirect', guard)
}
