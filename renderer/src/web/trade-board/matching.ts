// Deathloom fork (Q23): friends' board matching. What you want (the Shopping
// list's uniques and gems, your own Wanted listings) against what friends give
// or sell, and what you give or sell against what friends want. Pure: the
// board panel and the overlay's ping both use it. Nothing is posted: a match
// only marks the listing and, once per listing, tells you.

export interface MatchListing {
  number: number
  kind: 'give' | 'sell' | 'wanted'
  name: string
  base?: string
  league?: string
  mine: boolean
}

export interface BoardMatch {
  number: number
  // why it matches, shown on the listing
  reason: string
}

// lower case, no "Superior", no punctuation, single spaces
export function normName (s: string | undefined): string {
  return (s ?? '').toLowerCase().replace(/^superior\s+/, '').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

// "Tabula Rasa" ~ "tabula rasa"; a typed want like "6-link Tabula Rasa please" holds the name
function contains (text: string, name: string): boolean {
  return name.length >= 5 && ` ${text} `.includes(` ${name} `)
}

// loose: one name inside the other (typed listings); exact: same name or base
// (Shopping list names come from PoB, so "Multistrike Support" mustn't match "Awakened Multistrike Support")
export function sameThing (want: string, l: { name: string, base?: string }, exact = false): boolean {
  const w = normName(want)
  if (!w) return false
  for (const n of [normName(l.name), normName(l.base)]) {
    if (!n) continue
    if (n === w || (!exact && (contains(w, n) || contains(n, w)))) return true
  }
  return false
}

function sameLeague (a?: string, b?: string) { return !a || !b || a === b }

export function boardMatches (listings: MatchListing[], shopping: string[]): BoardMatch[] {
  const mine = listings.filter(l => l.mine)
  const myWanted = mine.filter(l => l.kind === 'wanted')
  const myOffers = mine.filter(l => l.kind !== 'wanted')
  const out: BoardMatch[] = []
  for (const l of listings) {
    if (l.mine) continue
    if (l.kind === 'wanted') {
      const m = myOffers.find(o => sameLeague(o.league, l.league) && (sameThing(o.name, l) || (o.base ? sameThing(o.base, l) : false)))
      if (m) out.push({ number: l.number, reason: `You ${m.kind === 'give' ? 'give' : 'sell'} ${m.name}` })
      continue
    }
    const shop = shopping.find(s => sameThing(s, l, true))
    if (shop) { out.push({ number: l.number, reason: 'On your Shopping list' }); continue }
    const w = myWanted.find(o => sameLeague(o.league, l.league) && sameThing(o.name, l))
    if (w) out.push({ number: l.number, reason: `You want ${w.name}` })
  }
  return out
}

// Pure: matches not told about yet, and the seen list to keep (only listings still open)
export function unseen (matches: BoardMatch[], seen: number[]): { fresh: BoardMatch[], keep: number[] } {
  const was = new Set(seen)
  const fresh = matches.filter(m => !was.has(m.number))
  return { fresh, keep: matches.map(m => m.number) }
}

// ---- the Shopping list's names (written by Market → Shopping, read anywhere) ---------
export const BOARD_WANTS_KEY = 'deathloom.board-wants.v1'
export const BOARD_SEEN_KEY = 'deathloom.board-seen-matches.v1'
export const BOARD_PING_KEY = 'deathloom.board-ping.v1'

export function parseWants (raw: string | null): string[] {
  try {
    const v = JSON.parse(raw ?? 'null')
    if (!v || !Array.isArray(v.names)) return []
    return v.names.filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 0).map((n: string) => n.slice(0, 120)).slice(0, 200)
  } catch { return [] }
}

export function parseSeen (raw: string | null): number[] {
  try {
    const v = JSON.parse(raw ?? '[]')
    return Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n) && n > 0).slice(0, 500) : []
  } catch { return [] }
}

export function pingText (fresh: Array<BoardMatch & { name: string, kind: string, author: string }>): { title: string, body: string } {
  if (fresh.length === 1) {
    const m = fresh[0]
    const what = m.kind === 'wanted' ? `${m.author} wants ${m.name}` : `${m.author} ${m.kind === 'give' ? 'gives away' : 'sells'} ${m.name}`
    return { title: "Friends' board: a match for you", body: `${what}\n${m.reason}` }
  }
  return { title: `Friends' board: ${fresh.length} matches for you`, body: fresh.slice(0, 4).map(m => m.name).join(', ') + (fresh.length > 4 ? ', …' : '') }
}
