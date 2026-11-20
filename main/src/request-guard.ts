// Deathloom fork: who may talk to the overlay's local server.
//
// The server listens on 127.0.0.1 (random port), but any web page open in a
// browser can still try ws://127.0.0.1:<port>/events (browsers allow cross-site
// WebSockets), and a DNS-rebinding page can even look same-origin. Over that
// socket a page could send overlay commands (chat, build push, reports...).
// So:
// - the Host header must be the loopback address the server runs on (rebinding
//   pages carry their own host name), unless --listen asked for another host;
// - a browser request that says where it comes from (Origin) must come from
//   the overlay's own pages (same host:port as the request);
// - file paths from URLs must stay inside their folder;
// - with --listen, requests from other devices (not loopback) must carry the
//   remote key: ?key=… once (the server then sets a cookie) or that cookie.

import * as path from 'path'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function hostName (hostHeader: string): string {
  // "[::1]:8584" -> "[::1]", "localhost:8584" -> "localhost"
  if (hostHeader.startsWith('[')) return hostHeader.slice(0, hostHeader.indexOf(']') + 1)
  return hostHeader.split(':')[0]
}

export interface GuardOptions {
  // --listen host (other than loopback): that name / address is accepted too
  listenHost?: string
  // required from other devices (non-loopback Host) when set
  remoteKey?: string
}

export const REMOTE_KEY_COOKIE = 'orbhoarder_key'

// the key a request carries: ?key=… in the URL, else the cookie
export function requestKey (url: string | undefined, cookie: string | undefined): string | undefined {
  const m = /[?&]key=([A-Za-z0-9_-]{16,128})(?:&|$)/.exec(url ?? '')
  if (m) return m[1]
  for (const part of (cookie ?? '').split(';')) {
    const [k, v] = part.trim().split('=')
    if (k === REMOTE_KEY_COOKIE && v) return v
  }
  return undefined
}

// constant-time compare (no early exit on the first different character)
function sameKey (a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// Deathloom fork (F1 review, 20 Nov 2026): the connection's own address. The Host
// header is written by the sender, so another device could send "Host: 127.0.0.1"
// and skip the key; the socket address can't be faked that way.
export function isLoopbackAddress (address: string | undefined): boolean {
  if (!address) return false
  const a = address.toLowerCase().replace(/^::ffff:/, '')
  return a === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a)
}

export function isAllowedRequest (
  headers: { host?: string, origin?: string, secFetchSite?: string, key?: string, remoteAddress?: string },
  opts: GuardOptions = {}
): boolean {
  const host = (headers.host ?? '').toLowerCase()
  if (!host) return false
  const name = hostName(host)
  const listen = opts.listenHost?.toLowerCase()
  const listensWide = listen === '0.0.0.0' || listen === '::'
  // another device: by the Host it asked for, or by where the connection comes from
  const otherDevice = !LOOPBACK.has(name) ||
    (headers.remoteAddress !== undefined && !isLoopbackAddress(headers.remoteAddress))
  if (otherDevice) {
    if (!(listen && (listensWide || name === listen))) return false
    // another device: only with the remote key (no key configured = refused)
    if (!opts.remoteKey || !headers.key || !sameKey(headers.key, opts.remoteKey)) return false
  }
  // Deathloom fork: a page on another site (image tag, link, form) is never let in,
  // even when the browser sends no Origin (Sec-Fetch-Site still says cross-site)
  if (headers.secFetchSite?.toLowerCase() === 'cross-site') return false
  const origin = headers.origin
  // No Origin: not a cross-site browser request (Electron windows loading the
  // page, the overlay's own GETs, local tools)
  if (origin === undefined || origin === '') return true
  try {
    const u = new URL(origin)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    return u.host.toLowerCase() === host
  } catch {
    return false
  }
}

// path from a URL inside baseDir, or null if it would leave it
export function safeJoin (baseDir: string, urlPath: string): string | null {
  let rel: string
  try {
    rel = decodeURIComponent(urlPath)
  } catch {
    return null
  }
  if (rel.includes('\0')) return null
  const base = path.resolve(baseDir)
  const full = path.resolve(base, '.' + path.sep + rel.replace(/^[\\/]+/, ''))
  return (full === base || full.startsWith(base + path.sep)) ? full : null
}

// Deathloom fork (F1 review, Gerhard 20 Nov 2026): what a phone or other device
// (a connection that isn't this PC, with the key) may ask for. Panels work as on
// the PC; settings, folders, installs, sign-in and anything that sends input to
// the game stay on this PC.
const NOT_FROM_OTHER_DEVICES = new Set([
  'CLIENT->MAIN::save-config',
  'CLIENT->MAIN::update-host-config',
  'CLIENT->MAIN::tools',
  'CLIENT->MAIN::pob-pick-folder',
  'CLIENT->MAIN::pob-install',
  'CLIENT->MAIN::pob-copy-builds',
  'CLIENT->MAIN::pob-setup-probe',
  'CLIENT->MAIN::hud-size',
  'CLIENT->MAIN::hud-hover',
  'CLIENT->MAIN::hud-drag',
  'CLIENT->MAIN::hud-resize',
  'CLIENT->MAIN::hud-typing',
  'CLIENT->MAIN::hud-panel',
  'CLIENT->MAIN::hud-gear-action'
])
const USER_ACTIONS_FROM_OTHER_DEVICES = new Set(['open-trade-tab', 'open-window-view'])
const POB_SYNC_FROM_OTHER_DEVICES = new Set(['status', 'pull', 'push', 'syncNow'])

export function allowedFromOtherDevice (name: string, payload: unknown): boolean {
  if (NOT_FROM_OTHER_DEVICES.has(name)) return false
  const op = (key: string) => (payload != null && typeof payload === 'object') ? (payload as Record<string, unknown>)[key] : undefined
  if (name === 'CLIENT->MAIN::user-action') return USER_ACTIONS_FROM_OTHER_DEVICES.has(String(op('action')))
  if (name === 'CLIENT->MAIN::pob-sync') return POB_SYNC_FROM_OTHER_DEVICES.has(String(op('op')))
  return true
}
