// Deathloom fork (Q29, 27 Nov 2026): league recap card. Pure: puts together
// what Orbhoarder already kept on this PC for one league (farming runs, the
// trade ledger, pace runs, the league checklist and challenge ticks) into one
// summary, plus a plain-text version to paste for friends. Nothing is read from
// GGG's site, API or the game. Unit-tested in tests/league-recap.test.mjs.

import type { FarmRun } from '../market-history/market-tools'
import type { TradeEntry } from '../companion/ledger'
import type { PaceRun } from '../companion/pace-log'

export interface RecapProgressGroup { title: string, items: Array<{ id: string, label: string }> }

export interface RecapInput {
  league: string
  farmRuns: FarmRun[]
  ledger: TradeEntry[]
  paceRuns: PaceRun[]
  // league checklist (Reference → Tracking → Checklist): groups and this league's ticks
  progress: RecapProgressGroup[]
  progressTicks: Set<string>
  challengesDone: number
  challengesTotal: number
}

export interface LeagueRecap {
  league: string
  // first and last thing seen for this league (ms; 0 when nothing)
  from: number
  to: number
  days: number
  maps: number
  mapHours: number
  profit: number
  perHour: number
  bestStrategy?: { name: string, maps: number, perHour: number }
  topMechanic?: { name: string, maps: number }
  sales: number
  purchases: number
  // sold amounts per currency ("chaos", "divine", …), biggest first
  sold: Array<{ currency: string, amount: number }>
  characters: Array<{ name: string, cls: string, level: number, deaths: number, campaignMs: number }>
  deaths: number
  pinnacles: string[]
  voidstones: number
  challengesDone: number
  challengesTotal: number
  // nothing kept for this league
  empty: boolean
}

const DAY = 24 * 60 * 60 * 1000
// characters started up to this long before the first map or trade count (levelling)
const LEVELLING_SLACK = 14 * DAY
// fewer maps than this don't name a "best strategy"
const MIN_MAPS_FOR_BEST = 5

const sameLeague = (a: string | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase()

function addPrice (totals: Map<string, number>, price: string) {
  const m = price.trim().match(/^([\d.,]+)\s+(.+)$/)
  if (!m) return
  const amount = Number(m[1].replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return
  const cur = m[2].trim().toLowerCase()
  totals.set(cur, (totals.get(cur) ?? 0) + amount)
}

export function leagueRecap (inp: RecapInput): LeagueRecap {
  const runs = inp.farmRuns.filter(r => sameLeague(r.league, inp.league))
  const trades = inp.ledger.filter(t => sameLeague(t.league, inp.league))
  const ats = [...runs.map(r => r.at), ...trades.map(t => t.at)].filter(n => Number.isFinite(n) && n > 0)
  const first = ats.length ? Math.min(...ats) : 0
  const last = ats.length ? Math.max(...ats) : 0

  // characters: pace runs started in this league's window (or a bit before: levelling)
  const chars = first
    ? inp.paceRuns.filter(p => p.startAt > 0 && p.startAt >= first - LEVELLING_SLACK && p.startAt <= last + DAY)
    : []
  const charFrom = chars.length ? Math.min(...chars.map(c => c.startAt)) : 0
  const charTo = chars.length ? Math.max(...chars.map(c => c.updatedAt || c.startAt)) : 0
  const from = [first, charFrom].filter(Boolean).reduce((a, b) => Math.min(a, b), Infinity)
  const to = Math.max(last, charTo)

  const mapMs = runs.reduce((s, r) => s + Math.max(0, r.ms), 0)
  const profit = runs.reduce((s, r) => s + (r.loot - r.cost), 0)
  const mapHours = mapMs / 3_600_000

  const byStrategy = new Map<string, FarmRun[]>()
  const byMechanic = new Map<string, number>()
  for (const r of runs) {
    byStrategy.set(r.strategy, [...(byStrategy.get(r.strategy) ?? []), r])
    for (const m of r.mechanics) byMechanic.set(m, (byMechanic.get(m) ?? 0) + 1)
  }
  let bestStrategy: LeagueRecap['bestStrategy']
  for (const [name, list] of byStrategy) {
    if (list.length < MIN_MAPS_FOR_BEST) continue
    const h = list.reduce((s, r) => s + r.ms, 0) / 3_600_000
    if (h <= 0) continue
    const perHour = list.reduce((s, r) => s + r.loot - r.cost, 0) / h
    if (!bestStrategy || perHour > bestStrategy.perHour) bestStrategy = { name, maps: list.length, perHour }
  }
  const topM = [...byMechanic].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]

  const soldTotals = new Map<string, number>()
  const sales = trades.filter(t => t.direction === 'from')
  for (const t of sales) addPrice(soldTotals, t.price)

  const pinGroup = inp.progress.find(g => /pinnacle/i.test(g.title))
  const pinnacles = (pinGroup?.items ?? []).filter(i => inp.progressTicks.has(i.id)).map(i => i.label)
  const voidstones = ['void1', 'void2', 'void3', 'void4'].filter(id => inp.progressTicks.has(id)).length

  const characters = [...chars]
    .sort((a, b) => b.level - a.level || a.startAt - b.startAt)
    .map(c => ({ name: c.name, cls: c.cls, level: c.level, deaths: c.deaths, campaignMs: c.campaignMs }))

  const empty = !runs.length && !trades.length && !characters.length && !inp.progressTicks.size && !inp.challengesDone
  return {
    league: inp.league,
    from: Number.isFinite(from) ? from : 0,
    to,
    days: Number.isFinite(from) && to >= from ? Math.max(1, Math.ceil((to - from) / DAY)) : 0,
    maps: runs.length,
    mapHours,
    profit,
    perHour: mapHours > 0 ? profit / mapHours : 0,
    bestStrategy,
    topMechanic: topM ? { name: topM[0], maps: topM[1] } : undefined,
    sales: sales.length,
    purchases: trades.filter(t => t.direction === 'to').length,
    sold: [...soldTotals].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount),
    characters,
    deaths: characters.reduce((s, c) => s + c.deaths, 0),
    pinnacles,
    voidstones,
    challengesDone: inp.challengesDone,
    challengesTotal: inp.challengesTotal,
    empty
  }
}

const fmt = (n: number) => Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(Math.round(n))
const fmtAmount = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1)
export function fmtHours (ms: number): string {
  const m = Math.round(ms / 60_000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`
}
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

// plain text for Discord or a chat with friends (no links, nothing private beyond names)
export function recapText (r: LeagueRecap): string {
  const lines: string[] = [`${r.league} league recap (Orbhoarder)`]
  if (r.from) lines.push(`${fmtDate(r.from)} to ${fmtDate(r.to)}, ${r.days} day${r.days === 1 ? '' : 's'}`)
  if (r.characters.length) {
    lines.push(`Characters: ${r.characters.map(c => `${c.name} (${[c.cls, `level ${c.level}`].filter(Boolean).join(' ')})`).join(', ')}`)
    lines.push(`Deaths: ${r.deaths}`)
  }
  if (r.maps) {
    lines.push(`Maps: ${r.maps} in ${r.mapHours.toFixed(1)} h, profit ${fmt(r.profit)}c (${fmt(r.perHour)}c/h)`)
    if (r.bestStrategy) lines.push(`Best strategy: ${r.bestStrategy.name} (${fmt(r.bestStrategy.perHour)}c/h over ${r.bestStrategy.maps} maps)`)
    if (r.topMechanic) lines.push(`Most seen mechanic: ${r.topMechanic.name} (${r.topMechanic.maps} maps)`)
  }
  if (r.sales || r.purchases) {
    lines.push(`Trades: ${r.sales} sold, ${r.purchases} bought` + (r.sold.length ? `; sold for ${r.sold.slice(0, 3).map(s => `${fmtAmount(s.amount)} ${s.currency}`).join(', ')}` : ''))
  }
  if (r.pinnacles.length) lines.push(`Bosses: ${r.pinnacles.join(', ')}`)
  if (r.voidstones) lines.push(`Voidstones: ${r.voidstones}/4`)
  if (r.challengesTotal) lines.push(`Challenges: ${r.challengesDone}/${r.challengesTotal}`)
  return lines.join('\n')
}
