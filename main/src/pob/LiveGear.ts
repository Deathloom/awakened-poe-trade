// Deathloom fork: reads a character's equipped gear from the public
// Characters tab, for the "vs equipped" comparison in the PoB panel.
//
// Rules this follows (see GGG's third-party policy):
// - read-only, public profile only: no cookies or session are sent
// - low rate: one character, cached, never more than once per MIN_INTERVAL
// - obeys X-Rate-Limit-* and Retry-After; backs off after errors so a wrong
//   name or private profile doesn't keep sending invalid requests

import { parseCharacters, type CharacterEntry } from './ActiveCharacter'

export const CACHE_TTL = 2 * 60_000 // reuse gear this long before refetching
export const MIN_INTERVAL = 30_000 // never fetch more often than this
export const ERROR_BACKOFF = 5 * 60_000 // wait after a 4xx (bad name, private profile)
const FETCH_TIMEOUT = 10_000

export interface LiveGearTarget {
  accountName: string
  character: string
  // Also read the passive tree (one more request per refresh)
  tree: boolean
}

export interface LiveGearData {
  items: unknown[]
  // get-passive-skills answer (tree + tree jewels), when the tree was read
  passives?: unknown
  // Why the tree is missing when it was asked for
  passivesError?: string
  character: { name?: string, class?: string, level?: number, league?: string }
  fetchedAt: number
}

export type FetchFn = (url: string, init: { headers: Record<string, string>, signal: AbortSignal, credentials: 'omit' }) => Promise<{
  status: number
  headers: { get: (name: string) => string | null }
  json: () => Promise<any>
}>

function characterUrl (endpoint: 'get-items' | 'get-passive-skills', target: { accountName: string, character: string }) {
  const params = new URLSearchParams({
    accountName: target.accountName,
    character: target.character,
    realm: 'pc'
  })
  return `https://www.pathofexile.com/character-window/${endpoint}?${params.toString()}`
}

export function getItemsUrl (target: { accountName: string, character: string }) {
  return characterUrl('get-items', target)
}

export function getPassivesUrl (target: { accountName: string, character: string }) {
  return characterUrl('get-passive-skills', target)
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

  // Which character was played last (public Characters tab). Doesn't count
  // towards the gear request interval, but obeys the shared rate limits.
  // null = skipped (rate limit). Newest login first.
  async characterList (accountName: string): Promise<CharacterEntry[] | null> {
    if (this.now() < this.blockedUntil) return null
    const params = new URLSearchParams({ accountName, realm: 'pc' })
    const url = `https://www.pathofexile.com/character-window/get-characters?${params.toString()}`
    const list = await this.request(url, { accountName, character: '(character list)', tree: false }, false)
    return parseCharacters(list)
  }

  // One GET with rate-limit bookkeeping. Throws readable errors.
  private async request (url: string, target: LiveGearTarget, countsForInterval = true): Promise<any> {
    if (countsForInterval) this.lastFetchAt = this.now()
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort() }, FETCH_TIMEOUT)
    let res
    try {
      res = await this.fetchFn(url, {
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
      throw new HttpError(429, 'Live gear: rate limited by pathofexile.com, try again later')
    }
    if (res.status >= 400) {
      const message = res.status === 403
        ? `Live gear: "${target.character}" isn't visible. Check the account name (with #1234) and that the Characters tab is public.`
        : res.status === 404
          ? `Live gear: account or character not found (${target.accountName} / ${target.character})`
          : `Live gear: pathofexile.com answered ${res.status}`
      throw new HttpError(res.status, message)
    }
    try {
      return await res.json()
    } catch {
      throw new Error('Live gear: unexpected answer from pathofexile.com')
    }
  }

  private async fetch (target: LiveGearTarget): Promise<LiveGearData> {
    let body: any
    try {
      body = await this.request(getItemsUrl(target), target)
    } catch (err) {
      if (err instanceof HttpError && err.status >= 400 && err.status < 500 && err.status !== 429) {
        // Cleared when the account/character setting changes
        this.lastError = { message: err.message, until: this.now() + ERROR_BACKOFF }
      }
      throw err
    }
    if (!body || !Array.isArray(body.items)) {
      throw new Error(`Live gear: ${String(body?.error?.message ?? 'no items in the answer')}`)
    }
    const c = body.character ?? {}
    const data: LiveGearData = {
      items: body.items,
      character: { name: c.name, class: c.class, level: c.level, league: c.league },
      fetchedAt: 0
    }
    if (target.tree) {
      // Second request only if the first didn't use up the rate limit
      if (this.now() < this.blockedUntil) {
        data.passivesError = 'Passive tree skipped this time (rate limit)'
      } else {
        try {
          const passives = await this.request(getPassivesUrl(target), target)
          if (passives && Array.isArray(passives.hashes)) {
            data.passives = passives
          } else {
            data.passivesError = 'Passive tree: unexpected answer from pathofexile.com'
          }
        } catch (err) {
          data.passivesError = (err as Error).message.replace(/^Live gear: /, 'Passive tree: ')
        }
      }
    }
    this.lastError = null
    data.fetchedAt = this.now()
    this.cache = data
    this.log(`info [PoB] live gear: ${body.items.length} items${data.passives ? ' + tree' : ''} for ${String(c.name ?? target.character)}`)
    return data
  }
}

class HttpError extends Error {
  constructor (public status: number, message: string) {
    super(message)
  }
}
