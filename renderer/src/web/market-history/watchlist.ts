// Deathloom fork: market history watchlist. poe.ninja only gives the last 7
// days in the overview the overlay already downloads, so the overlay records
// its own price points for watched items (about hourly while it runs) to show
// longer trends. Stored in the overlay's local storage.

import { ref, computed } from 'vue'
import { type WatchedItem, type PriceNow, type AlertHit, MAX_ITEMS, canAdd, applyPrices } from './watchlist-store'
import { gameKey } from '../game-storage'

export type { WatchedItem }
export { MAX_ITEMS }

const KEY = 'deathloom.market-history.v1'

function load (): WatchedItem[] {
  try {
    const list = JSON.parse(localStorage.getItem(gameKey(KEY)) ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export const watchlist = ref<WatchedItem[]>(load())
export const watchFull = computed(() => !canAdd(watchlist.value))
// S3: shown in the Market history panel (save failed, list full)
export const watchNotice = ref('')

// Deathloom fork: the overlay and the desktop window share this list; another
// window's change shows up here too
try {
  window.addEventListener('storage', (e) => { if (e.key === gameKey(KEY)) watchlist.value = load() })
} catch {}

function save (): boolean {
  try {
    localStorage.setItem(gameKey(KEY), JSON.stringify(watchlist.value))
    if (watchNotice.value.startsWith('Couldn\'t save')) watchNotice.value = ''
    return true
  } catch (err) {
    // S3: used to be swallowed, so recorded history was lost without a word
    console.warn('[market history] save failed', err)
    watchNotice.value = 'Couldn\'t save the watchlist (storage full?). Remove a few watched items so new prices are kept.'
    return false
  }
}

export function watchKey (q: { ns: string, name: string, variant?: string }, league: string) {
  return `${league}|${q.ns}|${q.name}|${q.variant ?? ''}`
}

export function isWatched (key: string) {
  return watchlist.value.some(w => w.key === key)
}

// false when the list is full (MAX_ITEMS) and the item wasn't added
export function toggleWatch (item: Omit<WatchedItem, 'key' | 'addedAt' | 'points'>, chaos?: number): boolean {
  const key = watchKey(item, item.league)
  if (isWatched(key)) {
    watchlist.value = watchlist.value.filter(w => w.key !== key)
  } else {
    if (!canAdd(watchlist.value)) {
      watchNotice.value = `You can watch up to ${MAX_ITEMS} items. Remove one to add another.`
      return false
    }
    const now = Date.now()
    watchlist.value = [...watchlist.value, { ...item, key, addedAt: now, points: chaos != null ? [[now, chaos]] : [] }]
  }
  if (watchNotice.value.startsWith('You can watch')) watchNotice.value = ''
  save()
  return true
}

export function removeWatch (key: string) {
  watchlist.value = watchlist.value.filter(w => w.key !== key)
  if (watchNotice.value.startsWith('You can watch')) watchNotice.value = ''
  save()
}

// S3: one load + one save for all watched prices (was one per item, every 10 min,
// in every window). Adds a point if the last one is older than minGap, thins
// points older than 14 days to daily, and returns the price alerts that fired.
// Reads the newest copy first: another window may have recorded a point already,
// so only the first window that sees an alert move reports it. Only touches the
// shared list when something changed: replacing it every time re-ran the panel's
// watcher, endlessly (the overlay froze after starring an item).
export function recordPrices (prices: PriceNow[], minGap?: number): AlertHit[] {
  if (!prices.length) return []
  const fresh = load()
  const { changed, alerts } = applyPrices(fresh, prices, Date.now(), minGap)
  if (!changed) return []
  watchlist.value = fresh
  save()
  return alerts
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
