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
  const w = watchlist.value.find(x => x.key === key)
  if (!w) return
  const last = w.points[w.points.length - 1]
  const now = Date.now()
  if (last && now - last[0] < minGap) return
  w.points.push([now, chaos])
  if (w.points.length > MAX_POINTS) w.points.splice(0, w.points.length - MAX_POINTS)
  watchlist.value = [...watchlist.value]
  save()
}
