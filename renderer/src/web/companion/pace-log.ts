// Deathloom fork (Q8): deaths and pace log. Every character followed from
// level 2 (a fresh start, e.g. a league start) is kept as a "run": act splits,
// deaths per act and the campaign time each level was reached, all from
// Client.txt. Runs outlive the character list (20 names), so a new league
// start can be compared with earlier ones. Stored on this PC only (at most
// MAX_RUNS); nothing is sent anywhere.
//
// Client.txt has no experience numbers, so "pace" is levels per hour of
// campaign time (acts 1-10, gaps over 20 minutes not counted), not XP/h.

import type { CharLevels, CharProgress } from './char-level'

export interface PaceRun {
  // name@startAt (a character deleted and made again with the same name is a new run)
  id: string
  name: string
  cls: string
  // PC time of the first level-up (0: started before Orbhoarder kept it)
  startAt: number
  // last time anything in it changed
  updatedAt: number
  // campaign time (ms) when each act (1-10) was first entered
  splits: Record<string, number>
  // time spent in each act (ms)
  actMs: Record<string, number>
  deaths: number
  deathsByAct: Record<string, number>
  // campaign time (ms) when each level was reached
  levelAt: Record<string, number>
  level: number
  // campaign time so far (ms)
  campaignMs: number
  // reached maps
  endgame: boolean
}

export interface PaceStore {
  runs: PaceRun[]
  // runs the player removed (so the next log line doesn't bring them back)
  forgotten: string[]
}

export const PACE_KEY = 'deathloom.pace-runs.v1'
export const MAX_RUNS = 10
const MAX_FORGOTTEN = 30

const numMap = (o: unknown): Record<string, number> => {
  const out: Record<string, number> = {}
  if (!o || typeof o !== 'object') return out
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (/^\d{1,3}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v >= 0) out[k] = v
  }
  return out
}

function cleanRun (r: any): PaceRun | null {
  if (!r || typeof r !== 'object' || typeof r.name !== 'string' || typeof r.id !== 'string') return null
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0) ? v : 0
  return {
    id: r.id.slice(0, 80),
    name: r.name.slice(0, 40),
    cls: typeof r.cls === 'string' ? r.cls.slice(0, 30) : '',
    startAt: n(r.startAt),
    updatedAt: n(r.updatedAt),
    splits: numMap(r.splits),
    actMs: numMap(r.actMs),
    deaths: n(r.deaths),
    deathsByAct: numMap(r.deathsByAct),
    levelAt: numMap(r.levelAt),
    level: Math.min(100, n(r.level)),
    campaignMs: n(r.campaignMs),
    endgame: !!r.endgame
  }
}

export function parsePaceStore (text: string | null): PaceStore {
  try {
    const raw = JSON.parse(text ?? 'null')
    if (raw && Array.isArray(raw.runs)) {
      return {
        runs: raw.runs.map(cleanRun).filter((r: PaceRun | null): r is PaceRun => r != null).slice(0, MAX_RUNS),
        forgotten: Array.isArray(raw.forgotten) ? raw.forgotten.filter((s: unknown) => typeof s === 'string').slice(-MAX_FORGOTTEN) : []
      }
    }
  } catch {}
  return { runs: [], forgotten: [] }
}

export function loadPaceStore (): PaceStore {
  try { return parsePaceStore(localStorage.getItem(PACE_KEY)) } catch { return { runs: [], forgotten: [] } }
}
export function savePaceStore (v: PaceStore) {
  try { localStorage.setItem(PACE_KEY, JSON.stringify(v)) } catch {}
}

export function campaignTime (actMs: Record<string, number> | undefined): number {
  return Object.entries(actMs ?? {}).filter(([a]) => Number(a) >= 1 && Number(a) <= 10).reduce((n, [, ms]) => n + ms, 0)
}

export function runId (name: string, p: Pick<CharProgress, 'startAt'>) {
  return `${name}@${p.startAt ?? 0}`
}

// a character's progress -> its run (null: not a fresh start, or nothing to compare yet)
export function runFromProgress (name: string, cls: string, level: number, p: CharProgress, now: number): PaceRun | null {
  if (!name || p.firstLevel > 2 || !p.splits || !Object.keys(p.splits).length) return null
  const levelAt = numMap(p.levelAt)
  const top = Math.max(level, ...Object.keys(levelAt).map(Number))
  return {
    id: runId(name, p),
    name,
    cls,
    startAt: p.startAt ?? 0,
    updatedAt: now,
    splits: numMap(p.splits),
    actMs: numMap(p.actMs),
    deaths: p.deaths ?? 0,
    deathsByAct: numMap(p.deathsByAct),
    levelAt,
    level: Math.min(100, top),
    campaignMs: campaignTime(p.actMs),
    endgame: !!p.endgame
  }
}

const same = (a: PaceRun, b: PaceRun) => JSON.stringify({ ...a, updatedAt: 0 }) === JSON.stringify({ ...b, updatedAt: 0 })

// keep the newest runs, plus the best finished one if it would be dropped
export function capRuns (runs: PaceRun[]): PaceRun[] {
  const sorted = [...runs].sort((a, b) => (b.startAt || b.updatedAt) - (a.startAt || a.updatedAt))
  if (sorted.length <= MAX_RUNS) return sorted
  const best = bestRun(sorted)
  const kept = sorted.slice(0, MAX_RUNS)
  if (best && !kept.includes(best)) kept[MAX_RUNS - 1] = best
  return kept
}

function sameStart (old: PaceRun, run: PaceRun) {
  const acts = Object.keys(old.splits)
  return acts.length > 0 && acts.every(a => run.splits[a] === old.splits[a])
}

// Client.txt progress (the level recorder's store) -> saved runs.
// Returns the same object when nothing changed (no write needed).
export function syncRuns (store: PaceStore, levels: CharLevels, now = Date.now()): PaceStore {
  let runs = store.runs
  let changed = false
  for (const [name, p] of Object.entries(levels.progress)) {
    const ch = levels.chars.find(c => c.name === name)
    const run = runFromProgress(name, ch?.cls ?? '', ch?.level ?? 0, p, now)
    if (!run || store.forgotten.includes(run.id)) continue
    // a run saved before its start time was known (name@0) is the same run
    let i = runs.findIndex(r => r.id === run.id)
    // (same start = its splits are the start of the new run's; otherwise it's an
    // earlier character with the same name and is kept)
    if (i < 0 && run.startAt) i = runs.findIndex(r => r.name === name && !r.startAt && sameStart(r, run))
    if (i >= 0 && same(runs[i], run)) continue
    if (i >= 0 && !run.cls) run.cls = runs[i].cls
    runs = i >= 0 ? runs.map((r, j) => j === i ? run : r) : [...runs, run]
    changed = true
  }
  if (!changed) return store
  return { ...store, runs: capRuns(runs) }
}

export function forgetRun (store: PaceStore, id: string): PaceStore {
  return {
    runs: store.runs.filter(r => r.id !== id),
    forgotten: [...store.forgotten.filter(f => f !== id), id].slice(-MAX_FORGOTTEN)
  }
}

// furthest act wins, then the faster split into it
export function lastAct (r: PaceRun): number {
  return Math.max(0, ...Object.keys(r.splits).map(Number))
}
export function bestRun (runs: PaceRun[], exceptId?: string): PaceRun | null {
  let best: PaceRun | null = null
  for (const r of runs) {
    if (r.id === exceptId || !lastAct(r)) continue
    if (!best) { best = r; continue }
    const a = lastAct(r)
    const b = lastAct(best)
    if (a > b || (a === b && r.splits[a] < best.splits[b])) best = r
  }
  return best
}
export function latestRun (runs: PaceRun[], exceptId?: string): PaceRun | null {
  let out: PaceRun | null = null
  for (const r of runs) {
    if (r.id === exceptId || !lastAct(r)) continue
    if (!out || (r.startAt || r.updatedAt) > (out.startAt || out.updatedAt)) out = r
  }
  return out
}

// levels per hour of campaign time, from level 2 to the highest level seen
// (null: under 10 minutes or under 2 levels of data, too noisy)
export function levelsPerHour (r: Pick<PaceRun, 'levelAt'>, untilMs = Infinity): number | null {
  const pts = Object.entries(r.levelAt).map(([l, t]) => [Number(l), t] as const)
    .filter(([, t]) => t <= untilMs).sort((a, b) => a[0] - b[0])
  if (pts.length < 2) return null
  const [l0, t0] = pts[0]
  const [l1, t1] = pts[pts.length - 1]
  const ms = t1 - t0
  if (ms < 10 * 60 * 1000 || l1 - l0 < 2) return null
  return (l1 - l0) / (ms / 3600000)
}

// highest level reached by a campaign time (0: none known)
export function levelBy (r: Pick<PaceRun, 'levelAt'>, ms: number): number {
  let best = 0
  for (const [l, t] of Object.entries(r.levelAt)) if (t <= ms && Number(l) > best) best = Number(l)
  return best
}

export interface PaceRow {
  act: number
  at: number | null
  // the compared run's split; delta = at - refAt (negative = faster)
  refAt: number | null
  delta: number | null
  level: number
  refLevel: number
  deaths: number
  refDeaths: number
}

export function paceRows (run: PaceRun, ref: PaceRun | null): PaceRow[] {
  const rows: PaceRow[] = []
  for (let act = 1; act <= 10; act++) {
    const at = run.splits[act] ?? null
    const refAt = ref?.splits[act] ?? null
    if (at == null && refAt == null) continue
    rows.push({
      act,
      at,
      refAt,
      delta: at != null && refAt != null ? at - refAt : null,
      level: at != null ? levelBy(run, at) : 0,
      refLevel: ref && refAt != null ? levelBy(ref, refAt) : 0,
      deaths: run.deathsByAct[act] ?? 0,
      refDeaths: ref?.deathsByAct[act] ?? 0
    })
  }
  return rows
}

export function fmtClock (ms: number) {
  const s = Math.round(Math.abs(ms) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`
}
export function fmtDelta (ms: number) {
  return (ms === 0 ? '±' : ms < 0 ? '−' : '+') + fmtClock(ms)
}
