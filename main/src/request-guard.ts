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
// - file paths from URLs must stay inside their folder.

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
}

export function isAllowedRequest (
  headers: { host?: string, origin?: string },
  opts: GuardOptions = {}
): boolean {
  const host = (headers.host ?? '').toLowerCase()
  if (!host) return false
  const name = hostName(host)
  const listen = opts.listenHost?.toLowerCase()
  const listensWide = listen === '0.0.0.0' || listen === '::'
  if (!LOOPBACK.has(name) && !(listen && (listensWide || name === listen))) return false
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
