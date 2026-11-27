// Deathloom fork (Q16, 27 Nov 2026): bulk sell pricing. For stacks you sell in
// bulk (currency, fragments, essences, cards…): poe.ninja's price as a bulk
// ratio, compared with the ratio you see in the in-game Currency Exchange (you
// type it in), and a WTS line to copy for trade chat. Pure logic only (tested in
// tests/logic.test.mjs); the panel is MarketBulk.vue. Nothing here talks to GGG,
// reads the game or sends anything: the player pastes the line themselves.
import { gameKey } from '../game-storage'

export interface BulkEntry { ns: string, name: string, variant?: string, label: string, qty: number, exchange?: string }
export const BULK_KEY = 'deathloom.bulk-sell.v1'
const MAX_BULK = 100

export function loadBulk (): BulkEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(gameKey(BULK_KEY)) ?? '[]')
    return Array.isArray(v)
      ? v.filter(e => e && typeof e.name === 'string' && typeof e.ns === 'string' && typeof e.label === 'string')
          .map(e => ({ ...e, qty: Number.isFinite(e.qty) && e.qty > 0 ? Math.round(e.qty) : 1, exchange: typeof e.exchange === 'string' ? e.exchange.slice(0, 40) : undefined }))
          .slice(0, MAX_BULK)
      : []
  } catch { return [] }
}
export function saveBulk (list: BulkEntry[]) {
  try { localStorage.setItem(gameKey(BULK_KEY), JSON.stringify(list.slice(0, MAX_BULK))) } catch {}
}

// What the Currency Exchange pays for ONE item, in chaos, from what the player typed:
//   "12" or "12c"        12 chaos each
//   "0.5 div" / "0.5d"   half a divine each
//   "8/div", "8 per div" 8 items for 1 divine
//   "5/c", "5 per chaos" 5 items for 1 chaos
//   "40:3", "40 for 3c"  40 items for 3 chaos ("40:1 div" / "40 for 1 div" in divines)
export function parseExchange (text: string | undefined, divine: number | undefined): number | null {
  const t = (text ?? '').trim().toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ')
  if (!t) return null
  const unit = (u: string | undefined): number | null => {
    if (!u || /^c(haos)?$/.test(u)) return 1
    if (/^d(iv(ine)?s?)?$/.test(u)) return divine && divine > 0 ? divine : null
    return null
  }
  const num = '(\\d+(?:\\.\\d+)?)'
  const u = '\\s*(c|chaos|d|div|divs|divine)?'
  let m = new RegExp(`^${num}\\s*(?:/|per)\\s*(c|chaos|d|div|divine)$`).exec(t)
  if (m) {
    const n = Number(m[1]); const k = unit(m[2])
    return n > 0 && k != null ? k / n : null
  }
  m = new RegExp(`^${num}\\s*(?::|for)\\s*${num}${u}$`).exec(t)
  if (m) {
    const n = Number(m[1]); const p = Number(m[2]); const k = unit(m[3])
    return n > 0 && p > 0 && k != null ? p * k / n : null
  }
  m = new RegExp(`^${num}${u}(?: each)?$`).exec(t)
  if (m) {
    const p = Number(m[1]); const k = unit(m[2])
    return p > 0 && k != null ? p * k : null
  }
  return null
}

function nice (n: number): string {
  if (n >= 10) return String(Math.round(n))
  return String(Math.round(n * 10) / 10)
}

// One item's price as players quote bulk: "3 div each", "12 c each (12 per div)", "8 per chaos"
export function bulkRatio (each: number, divine: number | undefined): string {
  if (!(each > 0)) return '–'
  if (divine && each >= divine) return `${nice(each / divine)} div each`
  if (each >= 1) {
    const perDiv = divine ? Math.floor(divine / each) : 0
    return perDiv >= 2 ? `${nice(each)} c each (${perDiv} per div)` : `${nice(each)} c each`
  }
  return `${nice(1 / each)} per chaos`
}

export function bulkTotal (chaos: number, divine: number | undefined): string {
  if (divine && chaos >= divine) return `${nice(chaos / divine)} div`
  return `${nice(chaos)} c`
}

// Currency Exchange vs poe.ninja for one item
export type BulkCompare = { pct: number, text: string, tone: 'exchange' | 'ninja' | 'same' }
export function compareExchange (exchange: number | null, ninja: number | null): BulkCompare | null {
  if (exchange == null || ninja == null || !(ninja > 0)) return null
  const pct = (exchange - ninja) / ninja * 100
  if (Math.abs(pct) < 3) return { pct, text: 'Same as poe.ninja', tone: 'same' }
  if (pct > 0) return { pct, text: `Exchange pays ${Math.round(pct)}% more`, tone: 'exchange' }
  return { pct, text: `Exchange pays ${Math.round(-pct)}% less`, tone: 'ninja' }
}

// The price to ask: the better of the two (the Exchange when it pays more)
export function askEach (exchange: number | null, ninja: number | null): number | null {
  if (exchange == null) return ninja
  if (ninja == null) return exchange
  return Math.max(exchange, ninja)
}

// Text for trade chat. The player pastes it; nothing is sent for them.
export function wtsLine (rows: Array<{ label: string, qty: number, each: number | null }>, divine: number | undefined): string {
  const parts = rows
    .filter(r => r.each != null && r.each > 0 && r.qty > 0)
    .map(r => `${r.qty}x ${r.label} at ${bulkRatio(r.each!, divine)}, ${bulkTotal(r.each! * r.qty, divine)} for all`)
  return parts.length ? `WTS ${parts.join(' | ')}` : ''
}
