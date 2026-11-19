// Deathloom fork (20 Nov 2026): Market tools — build shopping list, sell list,
// farming profit, divine ratio / wallet and crafting costs. Pure logic only
// (tested in tests/logic.test.mjs); the panels live in Market*.vue.
// Prices are poe.ninja's (what the app already downloads); nothing here talks
// to GGG.

import type { NinjaListing } from '@/web/background/Prices'
import { trendOf } from './market-trends'

// ---- prices -----------------------------------------------------------------

// Cheapest poe.ninja listing for a name in one namespace (ITEM, UNIQUE, GEM…).
// Gems: corrupted variants ("20/20c") are skipped unless nothing else is listed.
export function cheapestByName (items: NinjaListing[], ns: string, name: string): NinjaListing | null {
  const want = name.trim().toLowerCase()
  let best: NinjaListing | null = null
  let bestCorrupt: NinjaListing | null = null
  for (const it of items) {
    if (it.ns !== ns || it.name.toLowerCase() !== want) continue
    const corrupt = ns === 'GEM' && /c$/i.test(it.variant ?? '')
    if (corrupt) {
      if (!bestCorrupt || it.chaos < bestCorrupt.chaos) bestCorrupt = it
    } else if (!best || it.chaos < best.chaos) best = it
  }
  return best ?? bestCorrupt
}

// Text for a premium stash tab / item note: "~price 3 divine" or "~price 45 chaos"
export function priceNote (chaos: number, divine: number | undefined, kind: '~price' | '~b/o' = '~price'): string {
  if (divine && chaos >= divine) {
    const d = Math.round(chaos / divine * 10) / 10
    return `${kind} ${d} divine`
  }
  return `${kind} ${Math.max(1, Math.round(chaos))} chaos`
}

// Short hint from the 7-day trend: sell now, can wait, or steady
export type SellHint = { text: string, tone: 'sell' | 'wait' | 'flat' }
export function sellHint (item: NinjaListing | null): SellHint | null {
  if (!item) return null
  const t = trendOf(item)
  if (!t || t.days < 3) return null
  if (t.change <= -10 || t.recent <= -8) return { text: 'Falling: sell soon', tone: 'sell' }
  if (t.change >= 10 && t.fit >= 0.6 && t.recent >= 0) return { text: 'Rising: can wait', tone: 'wait' }
  return { text: 'Steady', tone: 'flat' }
}

// ---- build shopping list ----------------------------------------------------

export interface ShopGear { slot: string, name: string, unique: boolean, owned: boolean }
export interface ShopGem { name: string, level?: number, quality?: number, enabled: boolean }
export interface ShopRow {
  kind: 'unique' | 'gem' | 'rare'
  key: string
  label: string
  slots: string[]
  owned: boolean
  listing: NinjaListing | null
}
export interface ShopList { rows: ShopRow[], total: number, missing: number, rares: number }

// One row per unique (slots merged), one per gem name; rares are counted only
// (their price depends on the rolls: use the Build panel's Trade buttons).
export function shoppingList (gear: ShopGear[], gems: ShopGem[], items: NinjaListing[], ownedGems: Set<string> = new Set()): ShopList {
  const rows = new Map<string, ShopRow>()
  let rares = 0
  for (const g of gear) {
    if (!g.unique) {
      if (!g.owned) rares++
      continue
    }
    const key = `u|${g.name.toLowerCase()}`
    const row = rows.get(key)
    if (row) {
      row.slots.push(g.slot)
      row.owned = row.owned && g.owned
    } else {
      rows.set(key, { kind: 'unique', key, label: g.name, slots: [g.slot], owned: g.owned, listing: cheapestByName(items, 'UNIQUE', g.name) })
    }
  }
  for (const gem of gems) {
    if (!gem.enabled || !gem.name) continue
    const key = `g|${gem.name.toLowerCase()}`
    if (rows.has(key)) continue
    rows.set(key, { kind: 'gem', key, label: gem.name, slots: [], owned: ownedGems.has(gem.name.toLowerCase()), listing: cheapestByName(items, 'GEM', gem.name) })
  }
  const list = [...rows.values()].sort((a, b) => Number(a.owned) - Number(b.owned) || (b.listing?.chaos ?? -1) - (a.listing?.chaos ?? -1))
  let total = 0
  let missing = 0
  for (const r of list) {
    if (r.owned) continue
    if (r.listing) total += r.listing.chaos
    else missing++
  }
  return { rows: list, total, missing, rares }
}

// ---- sell list --------------------------------------------------------------

export interface SellEntry { ns: string, name: string, variant?: string, label: string, qty: number }
export const SELL_KEY = 'deathloom.sell-list.v1'

export function loadSellList (): SellEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(SELL_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter(e => e && typeof e.name === 'string' && typeof e.ns === 'string').slice(0, 200) : []
  } catch { return [] }
}
export function saveSellList (list: SellEntry[]) {
  try { localStorage.setItem(SELL_KEY, JSON.stringify(list)) } catch {}
}
export function sellTotal (list: SellEntry[], price: (e: SellEntry) => number | null): { chaos: number, missing: number } {
  let chaos = 0
  let missing = 0
  for (const e of list) {
    const p = price(e)
    if (p == null) missing++
    else chaos += p * Math.max(0, e.qty || 0)
  }
  return { chaos, missing }
}

// ---- farming profit ---------------------------------------------------------

export interface FarmRun {
  // seed|code|start: one map run
  id: string
  league?: string
  strategy: string
  mechanics: string[]
  loot: number
  cost: number
  ms: number
  at: number
}
export const FARM_RUNS_KEY = 'deathloom.farming-runs.v1'
export const FARM_STRATEGY_KEY = 'deathloom.farming-strategy.v1'
const MAX_RUNS = 2000

export function loadFarmRuns (): FarmRun[] {
  try {
    const v = JSON.parse(localStorage.getItem(FARM_RUNS_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter(r => r && typeof r.id === 'string') : []
  } catch { return [] }
}
export function loadStrategy (): string {
  try { return (localStorage.getItem(FARM_STRATEGY_KEY) ?? '').slice(0, 60) } catch { return '' }
}
export function saveStrategy (s: string) {
  try { localStorage.setItem(FARM_STRATEGY_KEY, s.trim().slice(0, 60)) } catch {}
}

// Map runs from a play session that count: finished (time spent) and loot typed in
export function runsFromSession (maps: Array<{ seed: string, code: string, start: number, ms: number, mechanics: string[], loot?: number, strategy?: string, league?: string }>,
  cost: number, league?: string): FarmRun[] {
  return maps
    .filter(m => m.ms > 0 && m.loot != null)
    .map(m => ({
      id: `${m.seed}|${m.code}|${m.start}`,
      league: m.league ?? league,
      strategy: m.strategy || 'No strategy set',
      mechanics: m.mechanics,
      loot: m.loot ?? 0,
      cost,
      ms: m.ms,
      at: m.start
    }))
}

// Keep runs (newest win on the same id), capped
export function mergeRuns (old: FarmRun[], add: FarmRun[]): FarmRun[] {
  const byId = new Map(old.map(r => [r.id, r]))
  for (const r of add) byId.set(r.id, r)
  return [...byId.values()].sort((a, b) => a.at - b.at).slice(-MAX_RUNS)
}
export function archiveRuns (add: FarmRun[]) {
  if (!add.length) return
  try { localStorage.setItem(FARM_RUNS_KEY, JSON.stringify(mergeRuns(loadFarmRuns(), add))) } catch {}
}

export interface FarmStat { name: string, maps: number, profit: number, perMap: number, perHour: number, minutesPerMap: number }

// Group by strategy (what the player typed) or by league mechanic seen in the map
export function farmingStats (runs: FarmRun[], by: 'strategy' | 'mechanic'): FarmStat[] {
  const groups = new Map<string, FarmRun[]>()
  for (const r of runs) {
    const keys = by === 'strategy' ? [r.strategy] : (r.mechanics.length ? r.mechanics : ['No mechanic seen'])
    for (const k of keys) {
      const g = groups.get(k) ?? []
      g.push(r)
      groups.set(k, g)
    }
  }
  return [...groups.entries()].map(([name, g]) => {
    const profit = g.reduce((a, r) => a + r.loot - r.cost, 0)
    const ms = g.reduce((a, r) => a + r.ms, 0)
    return {
      name,
      maps: g.length,
      profit,
      perMap: profit / g.length,
      perHour: ms > 0 ? profit / (ms / 3_600_000) : 0,
      minutesPerMap: ms / g.length / 60_000
    }
  }).sort((a, b) => b.perHour - a.perHour)
}

// ---- crafting costs ---------------------------------------------------------

// Common crafting currency (poe.ninja names, ITEM namespace)
export const CRAFT_CURRENCY = [
  'Orb of Transmutation', 'Orb of Augmentation', 'Orb of Alteration', 'Regal Orb', 'Orb of Alchemy',
  'Chaos Orb', 'Exalted Orb', 'Divine Orb', 'Orb of Annulment', 'Orb of Scouring', 'Blessed Orb',
  'Chromatic Orb', "Jeweller's Orb", 'Orb of Fusing', 'Vaal Orb', 'Veiled Chaos Orb', 'Orb of Dominance',
  "Awakener's Orb", 'Eldritch Chaos Orb', 'Eldritch Exalted Orb', 'Orb of Conflict', 'Fracturing Orb'
]
export interface CraftRow { name: string, count: number }
export const CRAFT_COST_KEY = 'deathloom.craft-cost.v1'

export function loadCraftRows (): CraftRow[] {
  try {
    const v = JSON.parse(localStorage.getItem(CRAFT_COST_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter(r => r && typeof r.name === 'string').slice(0, 40) : []
  } catch { return [] }
}
export function saveCraftRows (rows: CraftRow[]) {
  try { localStorage.setItem(CRAFT_COST_KEY, JSON.stringify(rows)) } catch {}
}
export function craftTotal (rows: CraftRow[], price: (name: string) => number | null): { chaos: number, missing: string[] } {
  let chaos = 0
  const missing: string[] = []
  for (const r of rows) {
    if (!r.count) continue
    const p = r.name === 'Chaos Orb' ? 1 : price(r.name)
    if (p == null) missing.push(r.name)
    else chaos += p * r.count
  }
  return { chaos, missing }
}

// ---- divine ratio -----------------------------------------------------------

// Chaos per divine over the week (oldest first) from poe.ninja's % sparkline
export function divineSeries (divine: NinjaListing | null): number[] {
  const t = divine ? trendOf(divine) : null
  return t?.series ?? []
}
export function convert (amount: number, from: 'chaos' | 'div', divine: number | undefined): number | null {
  if (!divine || !Number.isFinite(amount)) return null
  return from === 'chaos' ? amount / divine : amount * divine
}
