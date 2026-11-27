// Deathloom fork (S3): pure parts of the market history watchlist (no Vue, no
// localStorage) so they're unit tested. Keeps the stored list well under the
// browser's ~5 MB localStorage limit: 50 items at full hourly history was ~6.5 MB
// and a failed save lost the history silently.

export interface WatchedItem {
  key: string
  ns: string
  name: string
  variant?: string
  label: string
  icon?: string
  league: string
  addedAt: number
  // [time ms, chaos]
  points: Array<[number, number]>
  // price alert: tell when the price moved this many % from base (then base = new price)
  alert?: { pct: number, base: number }
}

export const MAX_ITEMS = 50
export const MAX_POINTS = 24 * 120 // ~4 months hourly (a ceiling; thinning keeps it far lower)
export const HOURLY_DAYS = 14
const DAY = 24 * 60 * 60_000

// Points older than HOURLY_DAYS keep one per day (the last of that day);
// newer ones stay hourly. Returns the same array when nothing changed.
export function thinPoints (points: Array<[number, number]>, now: number): Array<[number, number]> {
  const cutoff = now - HOURLY_DAYS * DAY
  if (!points.length || points[0][0] >= cutoff) return points
  const out: Array<[number, number]> = []
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (p[0] >= cutoff) { out.push(p); continue }
    const next = points[i + 1]
    // last old point of its UTC day
    if (!next || next[0] >= cutoff || Math.floor(next[0] / DAY) !== Math.floor(p[0] / DAY)) out.push(p)
  }
  if (out.length > MAX_POINTS) out.splice(0, out.length - MAX_POINTS)
  return out.length === points.length ? points : out
}

export function canAdd (list: WatchedItem[]): boolean {
  return list.length < MAX_ITEMS
}

export interface PriceNow { key: string, chaos: number }
export interface AlertHit { key: string, change: number, chaos: number }

// One pass for every watched item with a price (was one load + save per item):
// adds a point when the last is older than minGap, thins old points, checks
// alerts (and moves their base on). Mutates `list`; `changed` says whether to save.
export function applyPrices (list: WatchedItem[], prices: PriceNow[], now: number, minGap = 55 * 60_000): { changed: boolean, alerts: AlertHit[] } {
  let changed = false
  const alerts: AlertHit[] = []
  for (const { key, chaos } of prices) {
    const w = list.find(x => x.key === key)
    if (!w) continue
    const last = w.points[w.points.length - 1]
    if (!last || now - last[0] >= minGap) {
      w.points.push([now, chaos])
      changed = true
    }
    const thinned = thinPoints(w.points, now)
    if (thinned !== w.points) { w.points = thinned; changed = true }
    if (w.alert && w.alert.base > 0) {
      const change = (chaos - w.alert.base) / w.alert.base * 100
      if (Math.abs(change) >= w.alert.pct) {
        w.alert = { ...w.alert, base: chaos }
        alerts.push({ key, change, chaos })
        changed = true
      }
    }
  }
  return { changed, alerts }
}
