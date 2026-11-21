// Deathloom fork (Q5): Fate reward outcomes (3.30 Covens) for the Fate value
// helper on the Covens cheat sheet. Only what we could source:
//  - reward types: the in-game "Promised Profits" challenge list (challenges.ts)
//  - single Divine Orb / Orb of Annulment outcomes need 2 copies: GGG 3.30.0d
//  - other repeats: 1st and 3rd copy triple, 2nd does nothing: GGG 3.30.0b
//  - Dreadmaidens' Sacrament is a unique Basalt Flask, Hide of the Vendigo a
//    unique Exquisite Leather (3.30 unique reveals)
// How many items an outcome gives is not stated by GGG except the single
// Divine / Annulment ones, so values are per item.

import { THREADS } from './threads'

export interface PriceRef { ns: 'ITEM' | 'UNIQUE', name: string }

export interface FateOutcome {
  id: string
  // reward type as the game names it
  label: string
  // poe.ninja lookups, tried in order; several names for a group (Threads) give a range
  prices?: PriceRef[]
  group?: boolean
  // 'single': GGG says it gives exactly one; 'unstated': count not stated by GGG
  qty: 'single' | 'unstated'
  // copies of the same Fate that pay
  copies: 1 | 2 | 3
  note?: string
}

const ITEM = (name: string): PriceRef => ({ ns: 'ITEM', name })
const UNIQUE = (name: string): PriceRef => ({ ns: 'UNIQUE', name })

export const THREAD_ITEMS = THREADS.map(t => t.item)

export const FATE_OUTCOMES: FateOutcome[] = [
  { id: 'divine', label: 'Single Divine Orb', prices: [ITEM('Divine Orb')], qty: 'single', copies: 2, note: 'guaranteed with 2 copies (3.30.0d)' },
  { id: 'annul', label: 'Single Orb of Annulment', prices: [ITEM('Orb of Annulment')], qty: 'single', copies: 2, note: 'guaranteed with 2 copies (3.30.0d)' },
  { id: 'dreadmaidens', label: 'Dreadmaidens\' Sacrament', prices: [UNIQUE('Dreadmaidens\' Sacrament')], qty: 'unstated', copies: 1, note: 'unique Basalt Flask' },
  { id: 'vendigo', label: 'Hide of the Vendigo', prices: [UNIQUE('Hide of the Vendigo')], qty: 'unstated', copies: 1, note: 'unique body armour' },
  { id: 'corpse-rose', label: 'Corpse Rose', prices: [ITEM('Corpse Rose'), UNIQUE('Corpse Rose')], qty: 'unstated', copies: 1, note: 'item type not stated by GGG' },
  { id: 'doedres-tongue', label: 'Doedre\'s Tongue', prices: [ITEM('Doedre\'s Tongue'), UNIQUE('Doedre\'s Tongue')], qty: 'unstated', copies: 1, note: 'item type not stated by GGG' },
  { id: 'ordered-fate', label: 'Ordered Fate', prices: [ITEM('Ordered Fate'), UNIQUE('Ordered Fate')], qty: 'unstated', copies: 1, note: 'item type not stated by GGG' },
  { id: 'stacked-decks', label: 'Stacked Decks', prices: [ITEM('Stacked Deck')], qty: 'unstated', copies: 1 },
  { id: 'threads', label: 'Threads', prices: THREAD_ITEMS.map(ITEM), group: true, qty: 'unstated', copies: 1, note: 'cheapest – dearest Thread' },
  // random drops: no single price
  { id: 'currency', label: 'Currency Items', qty: 'unstated', copies: 1 },
  { id: 'unique', label: 'Unique Item', qty: 'unstated', copies: 1 },
  { id: 'gem', label: 'Gem', qty: 'unstated', copies: 1 },
  { id: 'rarity', label: 'Increased Item Rarity', qty: 'unstated', copies: 1 },
  { id: 'viscera', label: 'Viscera Item', qty: 'unstated', copies: 1 },
  { id: 'maps', label: 'Maps', qty: 'unstated', copies: 1 },
  { id: 'fated-equipment', label: 'Fated Equipment', qty: 'unstated', copies: 1 },
  { id: 'gold', label: 'Gold', qty: 'unstated', copies: 1 }
]

export const COPIES_RULE = 'Same Fate more than once: the 1st and 3rd copy triple the reward, the 2nd does nothing (3.30.0b), so use 1 or 3 copies. Single Divine Orb / Orb of Annulment outcomes need only 2 (3.30.0d).'

export interface FateRow {
  outcome: FateOutcome
  // chaos per item (low / high end; equal unless a group); null = no price
  low: number | null
  high: number | null
  // random drops (no price lookups at all)
  varies: boolean
  best: boolean
}

const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v >= 0

// priceOf: chaos for one lookup, or null. Rows are sorted by value (dearest
// first, by the low end), then unpriced, then random drops; the dearest priced
// row is marked best.
export function valueFates (outcomes: FateOutcome[], priceOf: (ref: PriceRef) => number | null | undefined): FateRow[] {
  const rows: FateRow[] = outcomes.map(outcome => {
    if (!outcome.prices?.length) return { outcome, low: null, high: null, varies: true, best: false }
    let vals: number[]
    if (outcome.group) {
      vals = outcome.prices.map(priceOf).filter(ok)
    } else {
      const first = outcome.prices.map(priceOf).find(ok)
      vals = first == null ? [] : [first]
    }
    if (!vals.length) return { outcome, low: null, high: null, varies: false, best: false }
    return { outcome, low: Math.min(...vals), high: Math.max(...vals), varies: false, best: false }
  })
  const rank = (r: FateRow) => r.varies ? 2 : r.low == null ? 1 : 0
  rows.sort((a, b) => rank(a) - rank(b) || (b.low ?? 0) - (a.low ?? 0))
  if (rows[0] && rank(rows[0]) === 0 && rows[0].low! > 0) rows[0].best = true
  return rows
}
