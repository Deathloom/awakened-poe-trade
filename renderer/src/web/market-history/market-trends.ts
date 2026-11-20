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
  // projected change in the next 3 days, %, if the trend holds (NaN under 4 days)
  outlook: number
  // too fast to call (projection past ±WILD_PCT or the week more than quadrupled)
  wild: boolean
  // days of history poe.ninja has for it (a new league starts with 1-2)
  days: number
}

// fewer days than this: change only, no outlook
export const OUTLOOK_MIN_DAYS = 4

// Deathloom fork (Gerhard 20 Nov 2026: every outlook showed +60%, the old cap): no cap.
// A projection past ±WILD_PCT, or a week that more than quadrupled, is "too fast to
// call" (thin markets, e.g. a 1c gem bought out to 15c): no number, kept out of Outlook.
export const WILD_PCT = 100
const WILD_WEEK = 300

interface Fit { slope: number, fit: number, recent: number, outlook: number }
// fit on the log price, so the slope is a % per day
function project (xs: number[], series: number[]): Fit {
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
  // the week's trend, weighted by how steady it is, nudged by the last 2 days
  const daily = b * fit * 0.7 + Math.log(1 + recent / 100) / 2 * 0.3
  return { slope, fit, recent, outlook: (Math.exp(daily * 3) - 1) * 100 }
}

function points (item: NinjaListing): { xs: number[], series: number[], lastPct: number } | null {
  const g = item.graph
  if (!g || g.length < 2) return null
  const pts: Array<[number, number]> = []
  g.forEach((v, i) => { if (v != null && Number.isFinite(v)) pts.push([i, v]) })
  if (pts.length < 2) return null
  const lastPct = pts[pts.length - 1][1]
  // graph value v -> price: today's price * (1 + v/100) / (1 + last/100)
  const base = item.chaos / (1 + lastPct / 100)
  const series = pts.map(([, v]) => base * (1 + v / 100))
  if (series.some(p => !(p > 0))) return null
  return { xs: pts.map(([i]) => i), series, lastPct }
}

// the Outlook tab's pick: steady climbers, not too fast to call
export function isSteadyClimber (t: Pick<Trend, 'outlook' | 'fit' | 'slope' | 'wild'>): boolean {
  return !t.wild && t.outlook > 1 && t.fit >= 0.75 && t.slope > 0
}

export function trendOf (item: NinjaListing): Trend | null {
  const p = points(item)
  if (!p) return null
  const { xs, series, lastPct } = p
  const f = project(xs, series)
  const enough = xs.length >= OUTLOOK_MIN_DAYS
  const outlook = enough ? f.outlook : NaN
  const wild = enough && (Math.abs(f.outlook) > WILD_PCT || lastPct > WILD_WEEK)
  return { series, change: lastPct, recent: f.recent, slope: f.slope, fit: enough ? f.fit : 0, outlook, wild, days: xs.length }
}

// How the outlook would have done this week: projected from the first days up to
// 3 days before today, compared with what the price actually did in those 3 days.
// null when poe.ninja has under OUTLOOK_MIN_DAYS + 3 days for it.
export function backtestOf (item: NinjaListing): { picked: boolean, projected: number, actual: number } | null {
  const p = points(item)
  if (!p || p.xs.length < OUTLOOK_MIN_DAYS + 3) return null
  const cut = p.xs.length - 3
  const series = p.series.slice(0, cut)
  const f = project(p.xs.slice(0, cut), series)
  const weekPct = (series[series.length - 1] / series[0] - 1) * 100
  const wild = Math.abs(f.outlook) > WILD_PCT || weekPct > WILD_WEEK
  const actual = (p.series[p.series.length - 1] / series[series.length - 1] - 1) * 100
  return { picked: isSteadyClimber({ ...f, wild }), projected: f.outlook, actual }
}

export interface BacktestSummary { n: number, rose: number, within: number, medianMiss: number }
// over the items the Outlook tab would have listed 3 days ago: how many really rose,
// how many landed within 15 points of the projection, and the typical miss
export function backtestSummary (items: NinjaListing[]): BacktestSummary | null {
  const misses: number[] = []
  let rose = 0; let within = 0
  for (const it of items) {
    const bt = backtestOf(it)
    if (!bt?.picked) continue
    const miss = Math.abs(bt.actual - bt.projected)
    misses.push(miss)
    if (bt.actual > 0) rose++
    if (miss <= 15) within++
  }
  if (misses.length < 5) return null
  misses.sort((a, b) => a - b)
  return { n: misses.length, rose, within, medianMiss: misses[Math.floor(misses.length / 2)] }
}

export type MarketGroup = { id: string, label: string, match: (category: string) => boolean }

export const MARKET_GROUPS: MarketGroup[] = [
  { id: 'all', label: 'Everything', match: () => true },
  { id: 'currency', label: 'Currency', match: c => c === 'currency' },
  { id: 'fragments', label: 'Fragments & invitations', match: c => ['fragments', 'invitations', 'vials'].includes(c) },
  { id: 'scarabs', label: 'Scarabs (Standard / before 3.30)', match: c => c === 'scarabs' },
  { id: 'league', label: 'League items (Threads, Viscera, Wombgifts…)', match: c => ['threads', 'viscera', 'wombgifts', 'scrying-orbs', 'memories', 'temples'].includes(c) },
  { id: 'crafting', label: 'Crafting (essences, fossils, oils…)', match: c => ['essences', 'fossils', 'resonators', 'oils', 'delirium-orbs', 'omens', 'allflame-embers', 'tattoos', 'runegrafts', 'astrolabes', 'djinn-coins', 'coffins', 'corpses', 'enshrouding-crystals', 'artifacts', 'incubators', 'ducats'].includes(c) },
  { id: 'divination', label: 'Divination cards', match: c => c === 'divination-cards' },
  { id: 'uniques', label: 'Uniques', match: c => c.startsWith('unique-') || ['shrine-belts', 'forbidden-jewels'].includes(c) },
  { id: 'gems', label: 'Skill gems', match: c => ['skill-gems', 'imbued-gems'].includes(c) },
  { id: 'maps', label: 'Maps', match: c => ['maps', 'blighted-maps', 'blight-ravaged-maps', 'valdo-maps'].includes(c) },
  { id: 'beasts', label: 'Beasts', match: c => c === 'beasts' },
  { id: 'bases', label: 'Base types, flasks, cluster jewels', match: c => ['base-types', 'flasks', 'cluster-jewels'].includes(c) }
]
