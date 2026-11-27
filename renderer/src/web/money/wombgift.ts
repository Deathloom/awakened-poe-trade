// Deathloom fork (Q14): Wombgift value: open it at the Genesis Tree or sell it?
// Sell price: the poe.ninja "wombgifts" overview the app already downloads.
// What opening gives is random and not published, so the open side comes from
// the player's own log of what each opening was worth (kept on this PC).

export const LOG_KEY = 'deathloom.wombgift-log.v1'
// last N openings per kind (older ones drop off: prices move during a league)
export const KEEP_PER_KIND = 30
// fewer openings than this: no verdict yet
export const MIN_OPENS = 3

// name -> chaos values of past openings (newest last)
export type OpenLog = Record<string, number[]>

export function loadLog (): OpenLog {
  const out: OpenLog = {}
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KEY) ?? 'null')
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [k, v] of Object.entries(raw)) {
        if (k === '__proto__' || k.length > 80 || !Array.isArray(v)) continue
        const vals = v.filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0).slice(-KEEP_PER_KIND)
        if (vals.length) out[k] = vals
      }
    }
  } catch {}
  return out
}

export function saveLog (log: OpenLog) {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)) } catch {}
}

export function addOpening (log: OpenLog, name: string, chaos: number): OpenLog {
  if (!Number.isFinite(chaos) || chaos < 0 || !name || name === '__proto__') return log
  return { ...log, [name]: [...(log[name] ?? []), chaos].slice(-KEEP_PER_KIND) }
}

export function undoOpening (log: OpenLog, name: string): OpenLog {
  const vals = (log[name] ?? []).slice(0, -1)
  const out = Object.fromEntries(Object.entries(log).filter(([k]) => k !== name))
  if (vals.length) out[name] = vals
  return out
}

export interface WombgiftRow {
  name: string
  // poe.ninja price (what you get for selling it), null = not listed
  sell: number | null
  url?: string
  opens: number
  // average worth of what came out (own log), null = never opened
  avgOpen: number | null
  // open: your openings beat selling; sell: they don't; log: too few openings to say
  verdict: 'open' | 'sell' | 'log'
}

export function valueWombgifts (listings: Array<{ category: string, name: string, chaos: number, url: string }>, log: OpenLog): WombgiftRow[] {
  const rows = new Map<string, WombgiftRow>()
  for (const l of listings) {
    if (l.category !== 'wombgifts' || !Number.isFinite(l.chaos)) continue
    const had = rows.get(l.name)
    if (had?.sell != null && had.sell <= l.chaos) continue
    rows.set(l.name, { name: l.name, sell: l.chaos, url: l.url, opens: 0, avgOpen: null, verdict: 'log' })
  }
  // kinds you've opened that poe.ninja doesn't list
  for (const name of Object.keys(log)) {
    if (!rows.has(name)) rows.set(name, { name, sell: null, opens: 0, avgOpen: null, verdict: 'log' })
  }
  for (const r of rows.values()) {
    const vals = log[r.name] ?? []
    r.opens = vals.length
    r.avgOpen = vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : null
    if (r.avgOpen == null || r.opens < MIN_OPENS) r.verdict = 'log'
    else if (r.sell == null || r.avgOpen > r.sell) r.verdict = 'open'
    else r.verdict = 'sell'
  }
  // dearest to sell first, then the rest by name
  return [...rows.values()].sort((a, b) =>
    (b.sell ?? -1) - (a.sell ?? -1) || a.name.localeCompare(b.name))
}
