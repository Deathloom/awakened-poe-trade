// Deathloom fork: market history watchlist. poe.ninja only gives the last 7
// days in the overview the overlay already downloads, so the overlay records
// its own price points for watched items (about hourly while it runs) to show
// longer trends. Stored in the overlay's local storage.

import { ref } from 'vue'

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

const KEY = 'deathloom.market-history.v1'
const MAX_POINTS = 24 * 120 // ~4 months hourly

function load (): WatchedItem[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export const watchlist = ref<WatchedItem[]>(load())

// Deathloom fork: the overlay and the desktop window share this list; another
// window's change shows up here too
try {
  window.addEventListener('storage', (e) => { if (e.key === KEY) watchlist.value = load() })
} catch {}

function save () {
  try { localStorage.setItem(KEY, JSON.stringify(watchlist.value)) } catch {}
}

export function watchKey (q: { ns: string, name: string, variant?: string }, league: string) {
  return `${league}|${q.ns}|${q.name}|${q.variant ?? ''}`
}

export function isWatched (key: string) {
  return watchlist.value.some(w => w.key === key)
}

export function toggleWatch (item: Omit<WatchedItem, 'key' | 'addedAt' | 'points'>, chaos?: number) {
  const key = watchKey(item, item.league)
  if (isWatched(key)) {
    watchlist.value = watchlist.value.filter(w => w.key !== key)
  } else {
    const now = Date.now()
    watchlist.value = [...watchlist.value, { ...item, key, addedAt: now, points: chaos != null ? [[now, chaos]] : [] }]
  }
  save()
}

export function removeWatch (key: string) {
  watchlist.value = watchlist.value.filter(w => w.key !== key)
  save()
}

// Add a price point if the last one is older than minGap
export function record (key: string, chaos: number, minGap = 55 * 60_000) {
  // newest copy first: another window may have recorded a point already.
  // Only touch the shared list when a point is added: replacing it every time
  // re-ran the panel's watcher, which called record() again, endlessly (the
  // overlay froze after starring an item)
  const fresh = load()
  const w = fresh.find(x => x.key === key)
  if (!w) return
  const last = w.points[w.points.length - 1]
  const now = Date.now()
  if (last && now - last[0] < minGap) return
  w.points.push([now, chaos])
  if (w.points.length > MAX_POINTS) w.points.splice(0, w.points.length - MAX_POINTS)
  watchlist.value = fresh
  save()
}

// Deathloom fork (idea 4): price alerts on watched items
export const ALERT_STEPS = [0, 10, 20, 50]

export function setAlert (key: string, pct: number, chaos: number | undefined) {
  const fresh = load()
  const w = fresh.find(x => x.key === key)
  if (!w) return
  if (pct > 0 && chaos != null) w.alert = { pct, base: chaos }
  else delete w.alert
  watchlist.value = fresh
  save()
}

// the % move when it crossed the alert (and moves the base on), else null.
// Reads the newest copy, so only the first window that sees the move reports it.
export function checkAlert (key: string, chaos: number): number | null {
  const fresh = load()
  const w = fresh.find(x => x.key === key)
  if (!w?.alert || !(w.alert.base > 0)) return null
  const change = (chaos - w.alert.base) / w.alert.base * 100
  if (Math.abs(change) < w.alert.pct) return null
  w.alert = { ...w.alert, base: chaos }
  watchlist.value = fresh
  save()
  return change
}
