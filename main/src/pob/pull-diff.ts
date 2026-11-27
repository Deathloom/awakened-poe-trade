// Deathloom fork (Q22): build diff on Pull. Before Orbhoarder pulls, the friends'
// build files in the builds folder are read into memory; after the Pull, every
// friend build whose file changed keeps its old copy in <userData>/pull-diff, so
// the build panel can show what changed since your copy (stats, gear, gems, tree).
// Only friends' folders: your own folder is never touched by a Pull of your builds.
// Nothing here talks to GitHub or the game; it reads and copies local files.

import path from 'path'
import { createHash } from 'crypto'
import { promises as fs } from 'fs'
import type { PullChange } from '../../../ipc/types'
export type { PullChange }

// a big group's first Pull can bring many builds; past these the diff is skipped
export const MAX_FILES = 400
export const MAX_BYTES = 64 * 1024 * 1024
const MAX_FILE = 8 * 1024 * 1024
export const KEEP = 30
const ID_RE = /^[a-f0-9]{16}$/

export type Snapshot = Map<string, Buffer>

function posix (rel: string) { return rel.split(path.sep).join('/') }

// .xml files in the friends' folders (every top folder except yours)
async function friendFiles (buildsDir: string, own: string): Promise<string[]> {
  const out: string[] = []
  let top
  try { top = await fs.readdir(buildsDir, { withFileTypes: true }) } catch { return out }
  const walk = async (dir: string, depth: number) => {
    let entries
    try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name.startsWith('.') || out.length > MAX_FILES) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory() && depth < 6) await walk(full, depth + 1)
      else if (e.isFile() && e.name.toLowerCase().endsWith('.xml')) out.push(path.relative(buildsDir, full))
    }
  }
  for (const e of top) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue
    if (own && e.name.toLowerCase() === own.toLowerCase()) continue
    await walk(path.join(buildsDir, e.name), 1)
  }
  return out
}

// null = too many / too big, skip the diff this time
export async function takeSnapshot (buildsDir: string, own: string): Promise<Snapshot | null> {
  const files = await friendFiles(buildsDir, own)
  if (files.length > MAX_FILES) return null
  const snap: Snapshot = new Map()
  let total = 0
  for (const rel of files) {
    const full = path.join(buildsDir, rel)
    const st = await fs.lstat(full).catch(() => null)
    if (!st?.isFile() || st.size > MAX_FILE) continue
    total += st.size
    if (total > MAX_BYTES) return null
    const buf = await fs.readFile(full).catch(() => null)
    if (buf) snap.set(posix(rel), buf)
  }
  return snap
}

export function changeId (rel: string, time: number): string {
  return createHash('sha1').update(`${rel}\n${time}`).digest('hex').slice(0, 16)
}

// Pure: what the Pull changed. Only files whose bytes differ, and new files of a
// player you already had builds from (a first Pull brings everything: not news).
export function findChanges (before: Snapshot, after: Snapshot, time: number): PullChange[] {
  const out: PullChange[] = []
  const known = new Set([...before.keys()].map(r => r.split('/')[0].toLowerCase()))
  for (const [rel, buf] of after) {
    const old = before.get(rel)
    if (old && old.equals(buf)) continue
    if (!old && !known.has(rel.split('/')[0].toLowerCase())) continue
    const parts = rel.split('/')
    out.push({
      id: changeId(rel, time),
      rel,
      player: parts[0],
      name: parts[parts.length - 1].replace(/\.xml$/i, ''),
      kind: old ? 'changed' : 'new',
      time
    })
  }
  return out.sort((a, b) => a.player.localeCompare(b.player) || a.name.localeCompare(b.name))
}

// Pure: newest first, one entry per build (a newer Pull replaces the older entry), capped
export function mergeChanges (prev: PullChange[], next: PullChange[]): { keep: PullChange[], drop: PullChange[] } {
  const all = [...next, ...prev].sort((a, b) => b.time - a.time)
  const keep: PullChange[] = []
  const drop: PullChange[] = []
  const seen = new Set<string>()
  for (const c of all) {
    if (seen.has(c.rel.toLowerCase()) || keep.length >= KEEP) drop.push(c)
    else { seen.add(c.rel.toLowerCase()); keep.push(c) }
  }
  return { keep, drop }
}

export function parseIndex (raw: string | null): PullChange[] {
  try {
    const v = JSON.parse(raw ?? '[]')
    if (!Array.isArray(v)) return []
    return v.filter((c): c is PullChange => c && typeof c === 'object' &&
      typeof c.id === 'string' && ID_RE.test(c.id) &&
      typeof c.rel === 'string' && c.rel.length < 400 && !c.rel.split('/').includes('..') &&
      typeof c.player === 'string' && typeof c.name === 'string' &&
      (c.kind === 'changed' || c.kind === 'new') && Number.isFinite(c.time)).slice(0, KEEP)
  } catch { return [] }
}

export class PullDiffStore {
  constructor (private dir: string) {}
  private indexFile () { return path.join(this.dir, 'index.json') }

  async list (): Promise<PullChange[]> {
    return parseIndex(await fs.readFile(this.indexFile(), 'utf8').catch(() => null))
  }

  // after a Pull: keep the old copies of the changed builds, return the new list
  async record (before: Snapshot, buildsDir: string, own: string): Promise<PullChange[]> {
    const after = await takeSnapshot(buildsDir, own)
    if (!after) return await this.list()
    const time = Date.now()
    const changes = findChanges(before, after, time)
    if (!changes.length) return await this.list()
    await fs.mkdir(this.dir, { recursive: true })
    for (const c of changes) {
      const old = before.get(c.rel)
      if (old) await fs.writeFile(path.join(this.dir, `${c.id}.xml`), old)
    }
    const { keep, drop } = mergeChanges(await this.list(), changes)
    for (const c of drop) await fs.rm(path.join(this.dir, `${c.id}.xml`), { force: true }).catch(() => {})
    await fs.writeFile(this.indexFile(), JSON.stringify(keep), 'utf8')
    return keep
  }

  async clear (): Promise<void> {
    for (const c of await this.list()) await fs.rm(path.join(this.dir, `${c.id}.xml`), { force: true }).catch(() => {})
    await fs.rm(this.indexFile(), { force: true }).catch(() => {})
  }

  // the old copy's text, or null for a new build
  async oldText (id: string): Promise<{ change: PullChange, text: string | null } | null> {
    if (!ID_RE.test(id)) return null
    const change = (await this.list()).find(c => c.id === id)
    if (!change) return null
    if (change.kind === 'new') return { change, text: null }
    const text = await fs.readFile(path.join(this.dir, `${id}.xml`), 'utf8').catch(() => null)
    return text == null ? null : { change, text }
  }
}
