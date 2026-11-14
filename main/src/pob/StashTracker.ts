// Deathloom fork: stash tracker (personal, opt-in).
//
// GGG's official stash API needs a registered OAuth app, and registration is
// closed. Until that changes this reads stash tabs the way the website's own
// stash viewer does: character-window/get-stash-items with the user's
// POESESSID cookie. That endpoint isn't in GGG's API reference, so this stays
// a personal grey-area tool:
// - off by default, the user turns it on and pastes their own POESESSID
// - the POESESSID is encrypted with Windows DPAPI (Electron safeStorage) and
//   only ever sent to www.pathofexile.com
// - read-only, manual refresh only (no timers), a few selected tabs, requests
//   spaced out and X-Rate-Limit / Retry-After obeyed
// When an official OAuth client is available, replace `StashSource` and keep
// the rest.

import { app, net, safeStorage } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { PobStashConfig, StashItem, StashTabInfo } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import { rateLimitWait } from './LiveGear'

const MIN_GAP = 2_500 // between two requests
const MIN_REFRESH = 30_000 // between two manual refreshes
const MAX_TABS = 12
const FETCH_TIMEOUT = 15_000
const MAX_WAIT_INLINE = 20_000 // wait for a rate limit inside one refresh up to this long

export interface StashResponse {
  status: number
  headers: { get: (name: string) => string | null }
  body: any
}

export type StashFetch = (url: string, headers: Record<string, string>) => Promise<StashResponse>

export function stashUrl (accountName: string, league: string, tabIndex: number, withTabs: boolean) {
  const params = new URLSearchParams({
    accountName,
    realm: 'pc',
    league,
    tabs: withTabs ? '1' : '0',
    tabIndex: String(tabIndex)
  })
  return `https://www.pathofexile.com/character-window/get-stash-items?${params.toString()}`
}

function colourOf (c: any): string | undefined {
  if (!c || typeof c.r !== 'number') return undefined
  return `rgb(${c.r}, ${c.g}, ${c.b})`
}

export function toTabs (body: any): StashTabInfo[] {
  if (!Array.isArray(body?.tabs)) return []
  return body.tabs
    .filter((t: any) => !t.hidden)
    .map((t: any) => ({
      index: Number(t.i),
      name: String(t.n ?? ''),
      type: String(t.type ?? ''),
      colour: colourOf(t.colour)
    }))
}

function largestLinkGroup (sockets: any): number | undefined {
  if (!Array.isArray(sockets) || !sockets.length) return undefined
  const counts = new Map<number, number>()
  for (const s of sockets) counts.set(s.group, (counts.get(s.group) ?? 0) + 1)
  return Math.max(...counts.values())
}

function gemLevel (item: any): number | undefined {
  for (const prop of item.properties ?? []) {
    if (prop.name === 'Level' && Array.isArray(prop.values?.[0])) {
      const n = parseInt(String(prop.values[0][0]), 10)
      if (n > 0) return n
    }
  }
  return undefined
}

export function toItems (body: any, tab: number): StashItem[] {
  if (!Array.isArray(body?.items)) return []
  return body.items.map((it: any) => ({
    id: String(it.id),
    tab,
    name: String(it.name ?? '').replace(/<<.*?>>/g, ''),
    typeLine: String(it.typeLine ?? '').replace(/<<.*?>>/g, ''),
    baseType: String(it.baseType ?? it.typeLine ?? ''),
    frameType: Number(it.frameType ?? 0),
    stackSize: typeof it.stackSize === 'number' ? it.stackSize : undefined,
    ilvl: typeof it.ilvl === 'number' ? it.ilvl : undefined,
    icon: typeof it.icon === 'string' ? it.icon : undefined,
    x: Number(it.x ?? 0),
    y: Number(it.y ?? 0),
    gemLevel: it.frameType === 4 ? gemLevel(it) : undefined,
    links: largestLinkGroup(it.sockets),
    corrupted: it.corrupted === true || undefined
  }))
}

// Rate-limited requests to the website's stash endpoint
export class StashSource {
  private lastRequestAt = 0
  private blockedUntil = 0

  constructor (
    private fetchFn: StashFetch,
    private userAgent: string,
    private log: (msg: string) => void,
    private now: () => number = Date.now,
    private sleep: (ms: number) => Promise<void> = async (ms) => await new Promise(resolve => setTimeout(resolve, ms))
  ) {}

  async get (sessionId: string, accountName: string, league: string, tabIndex: number, withTabs: boolean): Promise<any> {
    const waitFor = Math.max(this.blockedUntil, this.lastRequestAt + MIN_GAP) - this.now()
    if (waitFor > MAX_WAIT_INLINE) {
      throw new Error(`Stash: rate limited, try again in ${Math.ceil(waitFor / 1000)}s`)
    }
    if (waitFor > 0) await this.sleep(waitFor)
    this.lastRequestAt = this.now()
    let res: StashResponse
    try {
      res = await this.fetchFn(stashUrl(accountName, league, tabIndex, withTabs), {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
        Cookie: `POESESSID=${sessionId}`
      })
    } catch (err) {
      throw new Error(`Stash: can't reach pathofexile.com (${(err as Error).message})`)
    }
    const wait = rateLimitWait(res.headers)
    if (wait > 0) {
      this.blockedUntil = Math.max(this.blockedUntil, this.now() + wait)
      this.log(`warn [Stash] rate limit, pausing ${Math.ceil(wait / 1000)}s`)
    }
    if (res.status === 429) {
      if (wait === 0) this.blockedUntil = this.now() + 60_000
      throw new Error('Stash: rate limited by pathofexile.com, try again later')
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('Stash: pathofexile.com refused the session. Your POESESSID has probably expired (log in again and paste the new one), or the account name is wrong.')
    }
    if (res.status === 404) {
      throw new Error(`Stash: not found. Check the account name and the league "${league}".`)
    }
    if (res.status >= 400) {
      throw new Error(`Stash: pathofexile.com answered ${res.status}`)
    }
    if (res.body?.error) {
      throw new Error(`Stash: ${String(res.body.error.message ?? 'error')}`)
    }
    return res.body
  }
}

function netFetch (url: string, headers: Record<string, string>): Promise<StashResponse> {
  return new Promise((resolve, reject) => {
    // useSessionCookies false: only the POESESSID we set is sent
    const req = net.request({ url, method: 'GET', useSessionCookies: false, redirect: 'error' })
    for (const [k, v] of Object.entries(headers)) req.setHeader(k, v)
    const timer = setTimeout(() => { req.abort(); reject(new Error('timeout')) }, FETCH_TIMEOUT)
    req.on('response', (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        clearTimeout(timer)
        const text = Buffer.concat(chunks).toString('utf8')
        let body: any = null
        try { body = JSON.parse(text) } catch {}
        const get = (name: string) => {
          const v = res.headers[name.toLowerCase()]
          return v == null ? null : Array.isArray(v) ? v.join(',') : String(v)
        }
        resolve({ status: res.statusCode, headers: { get }, body })
      })
      res.on('error', (e: Error) => { clearTimeout(timer); reject(e) })
    })
    req.on('error', (e) => { clearTimeout(timer); reject(e) })
    req.end()
  })
}

export class StashTracker {
  private cfg: PobStashConfig | undefined
  private accountName = ''
  private source: StashSource
  private lastRefreshAt = 0
  private tabs: StashTabInfo[] = []
  private busy = false

  constructor (
    private server: ServerEvents,
    private logger: Logger
  ) {
    this.source = new StashSource(netFetch, app.userAgentFallback, (m) => { this.logger.write(m) })

    this.server.onEventAnyClient('CLIENT->MAIN::stash-session', ({ sessionId }) => {
      void this.saveSession(sessionId)
    })
    this.server.onEventAnyClient('CLIENT->MAIN::stash', ({ requestId, action }) => {
      // answer the window that asked (overlay or desktop window)
      const send = this.server.replyTo()
      void this.handle(action).then(
        async (res) => {
          send({
            name: 'MAIN->CLIENT::stash',
            payload: { requestId, ok: true, hasSession: await this.hasSession(), ...res }
          })
        },
        async (err: Error) => {
          send({
            name: 'MAIN->CLIENT::stash',
            payload: { requestId, ok: false, error: err.message, hasSession: await this.hasSession() }
          })
        })
    })
  }

  configure (cfg: PobStashConfig | undefined, accountName: string) {
    this.cfg = cfg
    this.accountName = accountName
  }

  private get sessionFile () { return path.join(app.getPath('userData'), 'apt-data', 'stash-session.bin') }
  private get snapshotFile () { return path.join(app.getPath('userData'), 'apt-data', 'stash-snapshot.json') }

  private async saveSession (sessionId: string | null) {
    try {
      if (!sessionId) {
        await fs.rm(this.sessionFile, { force: true })
        this.logger.write('info [Stash] POESESSID removed')
        return
      }
      if (!safeStorage.isEncryptionAvailable()) {
        this.logger.write('error [Stash] encryption not available, POESESSID not saved')
        return
      }
      await fs.mkdir(path.dirname(this.sessionFile), { recursive: true })
      await fs.writeFile(this.sessionFile, safeStorage.encryptString(sessionId.trim()))
      this.logger.write('info [Stash] POESESSID saved (encrypted)')
    } catch (e) {
      this.logger.write(`error [Stash] saving POESESSID: ${(e as Error).message}`)
    }
  }

  private async readSession (): Promise<string | null> {
    try {
      const data = await fs.readFile(this.sessionFile)
      return safeStorage.decryptString(data)
    } catch {
      return null
    }
  }

  private async hasSession () {
    return (await this.readSession()) != null
  }

  private async handle (action: 'tabs' | 'refresh') {
    const cfg = this.cfg
    if (!cfg?.enabled) throw new Error('Stash tracker is off (Settings → Path of Building)')
    const missing = [!this.accountName && 'Account name', !cfg.league && 'League'].filter(Boolean)
    if (missing.length) throw new Error(`Missing in settings: ${missing.join(', ')}`)
    const session = await this.readSession()
    if (!session) throw new Error('No POESESSID saved (Settings → Path of Building → Stash tracker)')
    if (this.busy) throw new Error('Stash: already refreshing')
    this.busy = true
    try {
      if (action === 'tabs') {
        const body = await this.source.get(session, this.accountName, cfg.league, 0, true)
        this.tabs = toTabs(body)
        return { tabs: this.tabs }
      }
      const wait = this.lastRefreshAt + MIN_REFRESH - Date.now()
      if (wait > 0) throw new Error(`Stash: wait ${Math.ceil(wait / 1000)}s before refreshing again`)
      this.lastRefreshAt = Date.now()
      const tabIdx = [...new Set(cfg.tabs)].slice(0, MAX_TABS)
      if (!tabIdx.length) throw new Error('Pick the tabs to track first')
      const items: StashItem[] = []
      for (const [n, idx] of tabIdx.entries()) {
        // The first request also refreshes the tab list
        const body = await this.source.get(session, this.accountName, cfg.league, idx, n === 0)
        if (n === 0) this.tabs = toTabs(body)
        items.push(...toItems(body, idx))
      }
      const newIds = await this.diff(items, tabIdx)
      this.logger.write(`info [Stash] ${items.length} items in ${tabIdx.length} tabs, ${newIds.length} new`)
      return { tabs: this.tabs, items, newIds, fetchedAt: this.lastRefreshAt }
    } finally {
      this.busy = false
    }
  }

  // Items not seen at the previous refresh of the same tab (kept on disk, ids only)
  private async diff (items: StashItem[], tabs: number[]): Promise<string[]> {
    let prev: { league: string, tabs: Record<string, string[]> } = { league: '', tabs: {} }
    try {
      prev = JSON.parse(await fs.readFile(this.snapshotFile, 'utf8'))
    } catch {}
    if (prev.league !== this.cfg!.league) prev = { league: this.cfg!.league, tabs: {} }
    const newIds: string[] = []
    for (const tab of tabs) {
      const before = prev.tabs[tab]
      const now = items.filter(i => i.tab === tab).map(i => i.id)
      if (before) {
        const seen = new Set(before)
        newIds.push(...now.filter(id => !seen.has(id)))
      }
      prev.tabs[tab] = now
    }
    try {
      await fs.mkdir(path.dirname(this.snapshotFile), { recursive: true })
      await fs.writeFile(this.snapshotFile, JSON.stringify(prev))
    } catch {}
    return newIds
  }
}
