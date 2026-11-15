// Deathloom fork: friends' status through build sync (opt-in in Loot Goblin).
// Your own <buildsDir>/<you>/Loot Goblin/status.txt holds your character,
// level, league, campaign splits and (only if you share it) the area you're
// in; Push uploads it, Pull brings friends' files. Only your own file is ever
// written. Friends' files are someone else's text: size-capped, parsed
// defensively, every field checked; the page shows them as plain text.

import path from 'path'
import { promises as fs } from 'fs'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { PlayerStatusData, PlayerStatusEntry } from '../../../ipc/types'

const DIR = 'Loot Goblin'
const FILE = 'status.txt'
const MAX_BYTES = 8 * 1024
const MAX_PLAYERS = 50
const PLAYER_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/
const HEADER = '# Loot Goblin status shared with friends (written by Loot Goblin; turn it off in the Friends\' board)\n'

interface Paths { buildsDir: string, player: string }

// eslint-disable-next-line no-control-regex
const str = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : ''
const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined

export function cleanStatus (raw: unknown): PlayerStatusData | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const updated = num(r.updated, 0, 8.64e15)
  if (updated == null) return null
  const out: PlayerStatusData = { updated }
  const c = r.character as Record<string, unknown> | undefined
  if (c && typeof c === 'object') {
    const name = str(c.name, 40)
    const level = num(c.level, 1, 100)
    if (name && level != null) out.character = { name, cls: str(c.cls, 30), level: Math.round(level) }
  }
  const league = str(r.league, 60)
  if (league) out.league = league
  const zone = str(r.zone, 80)
  if (zone) out.zone = zone
  if (r.splits && typeof r.splits === 'object') {
    const splits: Record<string, number> = {}
    for (let act = 1; act <= 10; act++) {
      const v = num((r.splits as Record<string, unknown>)[act], 0, 1e9)
      if (v != null) splits[act] = Math.round(v)
    }
    if (Object.keys(splits).length) out.splits = splits
  }
  if (r.fromStart === true) out.fromStart = true
  return out
}

export function statusFromFile (text: string): PlayerStatusData | null {
  const json = text.split(/\r?\n/).filter(l => !l.startsWith('#')).join('\n').trim()
  try { return cleanStatus(JSON.parse(json)) } catch { return null }
}

export class PlayerStatus {
  private queue = Promise.resolve()

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private paths: () => Paths | null,
    private onChanged: () => void
  ) {
    this.server.onEventAnyClient('CLIENT->MAIN::player-status', (req) => {
      this.queue = this.queue.then(async () => { await this.handle(req.op, req.status) })
    })
  }

  private publish (payload: { available: boolean, entries: PlayerStatusEntry[], error?: string }) {
    this.server.sendEventTo('broadcast', { name: 'MAIN->CLIENT::player-status', payload })
  }

  private async handle (op: 'list' | 'write' | 'clear', status?: PlayerStatusData) {
    const p = this.paths()
    if (!p?.buildsDir || !p.player) {
      this.publish({ available: false, entries: [] })
      return
    }
    try {
      if (op === 'clear') {
        // sharing turned off: remove your file (the next Push removes it on GitHub too)
        const file = path.join(p.buildsDir, p.player, DIR, FILE)
        try { await fs.unlink(file); this.onChanged() } catch {}
      }
      if (op === 'write') {
        const clean = cleanStatus(status)
        if (!clean) throw new Error('Nothing to share')
        const file = path.join(p.buildsDir, p.player, DIR, FILE)
        await fs.mkdir(path.dirname(file), { recursive: true })
        const tmp = `${file}.lg-tmp`
        await fs.writeFile(tmp, HEADER + JSON.stringify(clean, null, 1) + '\n', 'utf8')
        await fs.rename(tmp, file)
        this.onChanged()
      }
      this.publish({ available: true, entries: await this.list(p) })
    } catch (e) {
      this.logger.write(`error [Friends status] ${op}: ${(e as Error).message}`)
      this.publish({ available: true, entries: [], error: (e as Error).message })
    }
  }

  private async list (p: Paths): Promise<PlayerStatusEntry[]> {
    let dirs: import('fs').Dirent[] = []
    try { dirs = await fs.readdir(p.buildsDir, { withFileTypes: true }) } catch {}
    const out: PlayerStatusEntry[] = []
    for (const d of dirs) {
      if (!d.isDirectory() || !PLAYER_RE.test(d.name)) continue
      const file = path.join(p.buildsDir, d.name, DIR, FILE)
      try {
        const st = await fs.stat(file)
        if (st.size > MAX_BYTES) continue
        const status = statusFromFile(await fs.readFile(file, 'utf8'))
        if (status) out.push({ player: d.name, own: d.name.toLowerCase() === p.player.toLowerCase(), status })
      } catch {}
      if (out.length >= MAX_PLAYERS) break
    }
    return out
  }
}
