// Deathloom fork: reads a character's equipped gear from the public
// Characters tab, for the "vs equipped" comparison in the PoB panel.
//
// Rules this follows (see GGG's third-party policy):
// - read-only, public profile only: no cookies or session are sent
// - low rate: one character, cached, never more than once per MIN_INTERVAL
// - obeys X-Rate-Limit-* and Retry-After; backs off after errors so a wrong
//   name or private profile doesn't keep sending invalid requests

export const CACHE_TTL = 2 * 60_000 // reuse gear this long before refetching
export const MIN_INTERVAL = 30_000 // never fetch more often than this
export const ERROR_BACKOFF = 5 * 60_000 // wait after a 4xx (bad name, private profile)
const FETCH_TIMEOUT = 10_000

export interface LiveGearTarget {
  accountName: string
  character: string
}

export interface LiveGearData {
  items: unknown[]
  character: { name?: string, class?: string, level?: number, league?: string }
  fetchedAt: number
}

export type FetchFn = (url: string, init: { headers: Record<string, string>, signal: AbortSignal, credentials: 'omit' }) => Promise<{
  status: number
  headers: { get: (name: string) => string | null }
  json: () => Promise<any>
}>

export function getItemsUrl (target: LiveGearTarget) {
  const params = new URLSearchParams({
    accountName: target.accountName,
    character: target.character,
    realm: 'pc'
  })
  return `https://www.pathofexile.com/character-window/get-items?${params.toString()}`
}

// Returns how long (ms) to wait before the next request, based on GGG's
// rate-limit headers. Rules look like "45:60:60" (max hits : period s :
// penalty s) and state like "3:60:0" (hits : period s : restricted s).
export function rateLimitWait (headers: { get: (name: string) => string | null }): number {
  let wait = 0
  const retryAfter = Number(headers.get('retry-after'))
  if (retryAfter > 0) wait = retryAfter * 1000
  const rules = (headers.get('x-rate-limit-rules') ?? '').split(',').map(r => r.trim()).filter(Boolean)
  for (const rule of rules) {
    const limits = (headers.get(`x-rate-limit-${rule}`) ?? '').split(',')
    const states = (headers.get(`x-rate-limit-${rule}-state`) ?? '').split(',')
    for (let i = 0; i < limits.length; i++) {
      const [max, period] = limits[i].split(':').map(Number)
      const [hits, , restricted] = (states[i] ?? '').split(':').map(Number)
      if (restricted > 0) {
        wait = Math.max(wait, restricted * 1000)
      } else if (max > 0 && hits >= max - 1) {
        // One hit left in this window: wait for the window to pass
        wait = Math.max(wait, period * 1000)
      }
    }
  }
  return wait
}

export class LiveGear {
  private target: LiveGearTarget | null = null
  private cache: LiveGearData | null = null
  private lastError: { message: string, until: number } | null = null
  private lastFetchAt = 0
  private blockedUntil = 0
  private inflight: Promise<LiveGearData> | null = null

  constructor (
    private fetchFn: FetchFn,
    private userAgent: string,
    private log: (msg: string) => void,
    private now: () => number = Date.now
  ) {}

  setTarget (target: LiveGearTarget | null) {
    const same = JSON.stringify(target) === JSON.stringify(this.target)
    if (same) return
    this.target = target
    this.cache = null
    this.lastError = null
  }

  // Equipped gear, from cache when fresh enough. `force` skips the cache but
  // not the rate limits. Throws with a readable message when it can't fetch;
  // stale gear is returned instead of an error when we have it.
  async get (force = false): Promise<LiveGearData> {
    if (!this.target) throw new Error('Live gear: account name or character not set')
    const now = this.now()
    if (this.cache && !force && now - this.cache.fetchedAt < CACHE_TTL) {
      return this.cache
    }
    // A wrong name or private profile: don't keep sending invalid requests
    if (this.lastError && now < this.lastError.until) {
      throw new Error(this.lastError.message)
    }
    const waitUntil = Math.max(this.blockedUntil, this.lastFetchAt + MIN_INTERVAL)
    if (now < waitUntil) {
      if (this.cache) return this.cache
      throw new Error(`Live gear: waiting ${Math.ceil((waitUntil - now) / 1000)}s (rate limit)`)
    }
    if (!this.inflight) {
      this.inflight = this.fetch(this.target).finally(() => { this.inflight = null })
    }
    try {
      return await this.inflight
    } catch (err) {
      if (this.cache) {
        this.log(`warn [PoB] live gear refresh failed, using cached gear: ${(err as Error).message}`)
        return this.cache
      }
      throw err
    }
  }

  private async fetch (target: LiveGearTarget): Promise<LiveGearData> {
    this.lastFetchAt = this.now()
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, FETCH_TIMEOUT)
    let res
    try {
      res = await this.fetchFn(getItemsUrl(target), {
        headers: { 'user-agent': this.userAgent, accept: 'application/json' },
        signal: controller.signal,
        credentials: 'omit'
      })
    } catch (err) {
      throw new Error(`Live gear: can't reach pathofexile.com (${(err as Error).message})`)
    } finally {
      clearTimeout(timer)
    }

    const wait = rateLimitWait(res.headers)
    if (wait > 0) {
      this.blockedUntil = Math.max(this.blockedUntil, this.now() + wait)
      this.log(`warn [PoB] live gear: rate limit, pausing ${Math.ceil(wait / 1000)}s`)
    }

    if (res.status === 429) {
      if (wait === 0) this.blockedUntil = this.now() + 60_000
      throw new Error('Live gear: rate limited by pathofexile.com, try again later')
    }
    if (res.status >= 400) {
      const message = res.status === 403
        ? `Live gear: "${target.character}" isn't visible. Check the account name (with #1234) and that the Characters tab is public.`
        : res.status === 404
          ? `Live gear: account or character not found (${target.accountName} / ${target.character})`
          : `Live gear: pathofexile.com answered ${res.status}`
      if (res.status < 500) {
        // Cleared when the account/character setting changes
        this.lastError = { message, until: this.now() + ERROR_BACKOFF }
      }
      throw new Error(message)
    }

    let body: any
    try {
      body = await res.json()
    } catch {
      throw new Error('Live gear: unexpected answer from pathofexile.com')
    }
    if (!body || !Array.isArray(body.items)) {
      throw new Error(`Live gear: ${String(body?.error?.message ?? 'no items in the answer')}`)
    }
    const c = body.character ?? {}
    this.lastError = null
    this.cache = {
      items: body.items,
      character: { name: c.name, class: c.class, level: c.level, league: c.league },
      fetchedAt: this.now()
    }
    this.log(`info [PoB] live gear: ${body.items.length} items for ${String(c.name ?? target.character)}`)
    return this.cache
  }
}
