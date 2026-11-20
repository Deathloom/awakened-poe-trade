// Deathloom fork (F4a, performance review): every window (overlay, Money tools,
// Market overview, Market history) downloads poe.ninja's full price list (several MB)
// on its own. Main keeps a successful download for a few minutes so the other
// windows get the same prices without downloading them again.
// Pure logic only (no Electron), tested in tests/logic.test.mjs.

export const NINJA_CACHE_TTL_MS = 10 * 60 * 1000
export const NINJA_CACHE_MAX_ENTRIES = 8
export const NINJA_CACHE_MAX_BODY_BYTES = 50 * 1024 * 1024

export interface CachedResponse {
  statusCode: number
  statusMessage: string
  headers: Record<string, string | string[]>
  body: Uint8Array
}

// `path` is the part after `/proxy/`, e.g.
// `poe.ninja/poe1/api/economy/current/dense/overviews?league=Keepers&language=en`
export function isCacheableProxyRequest (method: string | undefined, path: string): boolean {
  if (method !== 'GET') return false
  let url: URL
  try {
    url = new URL('https://' + path)
  } catch {
    return false
  }
  if (url.hostname !== 'poe.ninja' || url.port !== '' || url.username || url.password) return false
  return /^\/(poe1\/|poe2\/)?api\/economy\/current\/dense\/overviews$/.test(url.pathname)
}

export class ResponseCache {
  private entries = new Map<string, { at: number, value: CachedResponse }>()
  private inflight = new Map<string, Promise<CachedResponse>>()

  constructor (
    private ttlMs = NINJA_CACHE_TTL_MS,
    private maxEntries = NINJA_CACHE_MAX_ENTRIES,
    private now: () => number = Date.now
  ) {}

  get size () { return this.entries.size }

  get (key: string): CachedResponse | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (this.now() - entry.at >= this.ttlMs) {
      this.entries.delete(key)
      return undefined
    }
    return entry.value
  }

  set (key: string, value: CachedResponse) {
    // only successful responses are kept (errors and rate limits are retried)
    if (value.statusCode !== 200) return
    // something this big isn't the price list: pass it on, don't keep it
    if (value.body.byteLength > NINJA_CACHE_MAX_BODY_BYTES) return
    const now = this.now()
    for (const [k, entry] of this.entries) {
      if (now - entry.at >= this.ttlMs) this.entries.delete(k)
    }
    this.entries.delete(key)
    this.entries.set(key, { at: now, value })
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value as string
      this.entries.delete(oldest)
    }
  }

  // fresh copy, or one download shared by everyone asking for the same key meanwhile
  fetch (key: string, load: () => Promise<CachedResponse>): Promise<CachedResponse> {
    const hit = this.get(key)
    if (hit) return Promise.resolve(hit)
    const pending = this.inflight.get(key)
    if (pending) return pending
    const p = load().then(
      (res) => { this.set(key, res); return res },
    ).finally(() => { this.inflight.delete(key) })
    this.inflight.set(key, p)
    return p
  }
}
