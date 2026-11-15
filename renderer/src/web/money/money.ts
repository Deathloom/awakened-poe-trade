// Deathloom fork: money tools (gem levelling profit, currency counter). Only
// uses the poe.ninja economy prices the app already downloads (no extra requests).

import type { NinjaListing } from '@/web/background/Prices'

export interface GemProfit {
  name: string
  // what you buy and what you sell (poe.ninja variants: "1", "1/20", "20", "20/20")
  buy: { variant: string, chaos: number }
  sell: { variant: string, chaos: number }
  profit: number
  url: string
}

// Max level a gem is levelled to: most gems 20, exceptional supports less
const MAX_LEVEL: Record<string, number> = {
  'Enlighten Support': 3,
  'Empower Support': 3,
  'Enhance Support': 3
}

// Buy level 1, sell max level; with quality: buy 1/20, sell 20/20.
// Corrupted gems (21/xx, …c) are left out: corrupting is a gamble.
export function gemProfits (items: NinjaListing[], quality: boolean, minBuy = 1): GemProfit[] {
  const byName = new Map<string, Map<string, NinjaListing>>()
  for (const it of items) {
    if (it.category !== 'skill-gems' || !it.variant || it.variant.endsWith('c')) continue
    if (!byName.has(it.name)) byName.set(it.name, new Map())
    byName.get(it.name)!.set(it.variant, it)
  }
  const out: GemProfit[] = []
  for (const [name, variants] of byName) {
    const top = MAX_LEVEL[name] ?? 20
    const buyV = quality ? '1/20' : '1'
    const sellV = quality ? `${top}/20` : `${top}`
    const buy = variants.get(buyV)
    const sell = variants.get(sellV)
    if (!buy || !sell || buy.chaos < minBuy) continue
    out.push({
      name,
      buy: { variant: buyV, chaos: buy.chaos },
      sell: { variant: sellV, chaos: sell.chaos },
      profit: sell.chaos - buy.chaos,
      url: sell.url
    })
  }
  return out.sort((a, b) => b.profit - a.profit)
}

// ---- Currency counter -------------------------------------------------------
export const COUNTER_KEY = 'deathloom.currency-counter.v1'

// shown by default (poe.ninja names); more can be added by name
export const DEFAULT_CURRENCIES = [
  'Divine Orb', 'Exalted Orb', 'Orb of Annulment', 'Orb of Alchemy', 'Orb of Fusing',
  'Chromatic Orb', "Jeweller's Orb", 'Orb of Alteration', 'Vaal Orb', "Gemcutter's Prism",
  'Regal Orb', 'Orb of Regret', 'Orb of Scouring', 'Blessed Orb', "Cartographer's Chisel"
]

export interface CounterState {
  // chaos is counted as is
  chaos: number
  counts: Record<string, number>
  // extra item names the player added
  extra: string[]
}

export function loadCounter (): CounterState {
  try {
    const raw = JSON.parse(localStorage.getItem(COUNTER_KEY) ?? 'null')
    if (raw && typeof raw === 'object') {
      return {
        chaos: Number(raw.chaos) || 0,
        counts: raw.counts && typeof raw.counts === 'object' ? raw.counts : {},
        extra: Array.isArray(raw.extra) ? raw.extra.filter((n: unknown) => typeof n === 'string').slice(0, 40) : []
      }
    }
  } catch {}
  return { chaos: 0, counts: {}, extra: [] }
}

export function saveCounter (v: CounterState) {
  try { localStorage.setItem(COUNTER_KEY, JSON.stringify(v)) } catch {}
}

export function counterTotal (v: CounterState, price: (name: string) => number | null): { chaos: number, missing: string[] } {
  let chaos = v.chaos
  const missing: string[] = []
  for (const [name, n] of Object.entries(v.counts)) {
    if (!n) continue
    const p = price(name)
    if (p == null) missing.push(name)
    else chaos += p * n
  }
  return { chaos, missing }
}
