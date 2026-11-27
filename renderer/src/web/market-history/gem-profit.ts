// Deathloom fork (Q15, 27 Nov 2026): gem profit calculator. Buy a low-level gem,
// level it in a spare socket (and add quality with Gemcutter's Prisms), sell it
// at max level. Profit per slot-day = profit / days the socket is busy.
// Pure logic only (tested in tests/logic.test.mjs); the panel is MarketGems.vue.
// Prices are poe.ninja's (already downloaded); nothing here talks to GGG.

import type { NinjaListing } from '@/web/background/Prices'

export const PRISM = "Gemcutter's Prism"

export interface GemVariant { level: number, quality: number, corrupt: boolean }

// poe.ninja gem variants: "1", "1/20", "20", "20/20", "21/20c", "5" (Awakened)
export function parseGemVariant (v: string | undefined): GemVariant | null {
  const m = /^(\d{1,2})(?:\/(\d{1,2}))?(c)?$/i.exec((v ?? '').trim())
  if (!m) return null
  return { level: Number(m[1]), quality: m[2] ? Number(m[2]) : 0, corrupt: Boolean(m[3]) }
}

// Rough socket time: Awakened gems need far more experience, Enlighten /
// Empower / Enhance even more. A guess the player can change per gem.
export function defaultDays (name: string, base: number): number {
  const b = Number.isFinite(base) && base > 0 ? base : 3
  if (/^(Enlighten|Empower|Enhance) Support$/i.test(name)) return b * 5
  if (/^Awakened /i.test(name)) return b * 3
  return b
}

// 1 prism = 1% quality
export function prismsNeeded (buy: GemVariant, sell: GemVariant): number {
  return Math.max(0, sell.quality - buy.quality)
}

export interface GemPlan {
  name: string
  buy: NinjaListing
  sell: NinjaListing
  prisms: number
  prismCost: number
  // sell - buy - prisms (null when the prism price is unknown and prisms are needed)
  profit: number
  days: number
  perDay: number
}

export function gemPlan (buy: NinjaListing, sell: NinjaListing, prismPrice: number | null, days: number, paid?: number): GemPlan | null {
  const bv = parseGemVariant(buy.variant)
  const sv = parseGemVariant(sell.variant)
  if (!bv || !sv) return null
  const prisms = prismsNeeded(bv, sv)
  if (prisms > 0 && prismPrice == null) return null
  const prismCost = prisms * (prismPrice ?? 0)
  const cost = paid != null && Number.isFinite(paid) ? paid : buy.chaos
  const profit = sell.chaos - cost - prismCost
  const d = Number.isFinite(days) && days > 0 ? days : 1
  return { name: sell.name, buy, sell, prisms, prismCost, profit, days: d, perDay: profit / d }
}

// Best route per gem: buy the cheapest lowest-level copy (not corrupted), sell the
// max-level copy (not corrupted, quality at least what was bought) that pays most.
export function gemRoutes (items: NinjaListing[], prismPrice: number | null, baseDays: number): GemPlan[] {
  const byName = new Map<string, Array<{ it: NinjaListing, v: GemVariant }>>()
  for (const it of items) {
    if (it.ns !== 'GEM') continue
    const v = parseGemVariant(it.variant)
    if (!v || v.corrupt) continue
    const g = byName.get(it.name) ?? []
    g.push({ it, v })
    byName.set(it.name, g)
  }
  const out: GemPlan[] = []
  for (const [name, g] of byName) {
    const minLevel = Math.min(...g.map(x => x.v.level))
    const maxLevel = Math.max(...g.map(x => x.v.level))
    if (maxLevel <= minLevel) continue
    const days = defaultDays(name, baseDays)
    let best: GemPlan | null = null
    for (const b of g.filter(x => x.v.level === minLevel)) {
      for (const s of g.filter(x => x.v.level === maxLevel && x.v.quality >= b.v.quality)) {
        const p = gemPlan(b.it, s.it, prismPrice, days)
        if (p && (!best || p.profit > best.profit || (p.profit === best.profit && p.buy.chaos < best.buy.chaos))) best = p
      }
    }
    if (best) out.push(best)
  }
  return out.sort((a, b) => b.perDay - a.perDay)
}

// ---- gems the player is levelling now ----------------------------------------

export interface TrackedGem { name: string, buy: string, sell: string, paid: number, days: number, started: number }
export const GEM_TRACK_KEY = 'deathloom.gem-levelling.v1'
const MAX_TRACKED = 30

export function loadTracked (): TrackedGem[] {
  try {
    const v = JSON.parse(localStorage.getItem(GEM_TRACK_KEY) ?? '[]')
    return Array.isArray(v)
      ? v.filter(e => e && typeof e.name === 'string' && typeof e.buy === 'string' && typeof e.sell === 'string' &&
        Number.isFinite(e.paid) && Number.isFinite(e.days) && Number.isFinite(e.started)).slice(0, MAX_TRACKED)
      : []
  } catch { return [] }
}
export function saveTracked (list: TrackedGem[]) {
  try { localStorage.setItem(GEM_TRACK_KEY, JSON.stringify(list.slice(0, MAX_TRACKED))) } catch {}
}

// Days in the socket so far (day 1 on the day it was added)
export function dayOf (started: number, now: number): number {
  return Math.max(1, Math.floor((now - started) / 86_400_000) + 1)
}

// Today's numbers for a tracked gem (what was paid, today's sell price)
export function trackedPlan (t: TrackedGem, items: NinjaListing[], prismPrice: number | null): GemPlan | null {
  const find = (variant: string) => items.find(it => it.ns === 'GEM' && it.name === t.name && (it.variant ?? '') === variant)
  const sell = find(t.sell)
  if (!sell) return null
  const buy = find(t.buy) ?? { ...sell, variant: t.buy, chaos: t.paid }
  return gemPlan(buy, sell, prismPrice, t.days, t.paid)
}
