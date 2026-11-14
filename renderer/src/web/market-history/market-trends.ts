// Deathloom fork: trend maths for the market overview, from poe.ninja's
// 7-day sparkline (graph = % change per day vs. 7 days ago; last = 7-day change).
// The "outlook" is a simple projection of the recent trend: a hint for
// planning, not a prediction.

import type { NinjaListing } from '@/web/background/Prices'

export interface Trend {
  // price per day, oldest first (chaos), from the sparkline
  series: number[]
  // 7-day change, %
  change: number
  // change over the last 2 days, %
  recent: number
  // linear fit over the week: % of today's price per day, and how well it fits (0..1)
  slope: number
  fit: number
  // projected change in the next 3 days, %, if the trend holds
  outlook: number
}

export function trendOf (item: NinjaListing): Trend | null {
  const g = item.graph
  if (!g || g.length < 4) return null
  const pts: Array<[number, number]> = []
  g.forEach((v, i) => { if (v != null && Number.isFinite(v)) pts.push([i, v]) })
  if (pts.length < 4) return null
  const lastPct = pts[pts.length - 1][1]
  // graph value v -> price: today's price * (1 + v/100) / (1 + last/100)
  const base = item.chaos / (1 + lastPct / 100)
  const series = pts.map(([, v]) => base * (1 + v / 100))
  if (series.some(p => !(p > 0))) return null
  // fit on the log price, so the slope is a % per day
  const xs = pts.map(([i]) => i)
  const ys = series.map(p => Math.log(p))
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0; let sxx = 0; let syy = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
    syy += (ys[i] - my) ** 2
  }
  const b = sxx ? sxy / sxx : 0
  const fit = syy ? (sxy * sxy) / (sxx * syy) : 0
  const slope = (Math.exp(b) - 1) * 100
  const prev2 = series[Math.max(0, series.length - 3)]
  const recent = (series[series.length - 1] / prev2 - 1) * 100
  // the week's trend, weighted by how steady it is, nudged by the last 2 days;
  // capped so one spike doesn't promise the moon
  const daily = b * fit * 0.7 + Math.log(1 + recent / 100) / 2 * 0.3
  const outlook = Math.max(-60, Math.min(60, (Math.exp(daily * 3) - 1) * 100))
  return { series, change: lastPct, recent, slope, fit, outlook }
}

export type MarketGroup = { id: string, label: string, match: (category: string) => boolean }

export const MARKET_GROUPS: MarketGroup[] = [
  { id: 'all', label: 'Everything', match: () => true },
  { id: 'currency', label: 'Currency', match: c => c === 'currency' },
  { id: 'fragments', label: 'Fragments & invitations', match: c => ['fragments', 'invitations', 'vials'].includes(c) },
  { id: 'scarabs', label: 'Scarabs', match: c => c === 'scarabs' },
  { id: 'crafting', label: 'Crafting (essences, fossils, oils…)', match: c => ['essences', 'fossils', 'resonators', 'oils', 'delirium-orbs', 'omens', 'allflame-embers', 'tattoos', 'runegrafts', 'astrolabes', 'djinn-coins', 'coffins', 'corpses', 'enshrouding-crystals', 'artifacts', 'incubators', 'ducats'].includes(c) },
  { id: 'divination', label: 'Divination cards', match: c => c === 'divination-cards' },
  { id: 'uniques', label: 'Uniques', match: c => c.startsWith('unique-') },
  { id: 'gems', label: 'Skill gems', match: c => c === 'skill-gems' },
  { id: 'maps', label: 'Maps', match: c => ['maps', 'blighted-maps', 'blight-ravaged-maps'].includes(c) },
  { id: 'beasts', label: 'Beasts', match: c => c === 'beasts' },
  { id: 'bases', label: 'Base types', match: c => c === 'base-types' }
]
