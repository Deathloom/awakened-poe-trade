// Deathloom fork: market search without price-checking an item first.
//
// GGG rules (checked 14 Nov 2026): same trade site API Awakened PoE Trade has
// always used for price checks, same rate limiter, no login and no cookies.
// Results only; buying stays manual: Whisper sends GGG's own whisper text and
// Hideout sends one /hideout command, each one chat message per click. Instant
// buyout ("Travel to Hideout") needs your trade site sign-in, so it opens in
// the Trade site tab where you click GGG's own button.

import { DateTime } from 'luxon'
import { Host } from '@/web/background/IPC'
import { ITEMS_ITERATOR, type BaseType } from '@/assets/data'
import { RateLimiter } from '@/web/price-check/trade/RateLimiter'
import {
  getTradeEndpoint, adjustRateLimits, RATE_LIMIT_RULES, preventQueueCreation,
  type TradeResponse, type Account
} from '@/web/price-check/trade/common'

export type ListingStatus = 'online' | 'securable' | 'available' | 'any'

export interface MarketQuery {
  item: Pick<BaseType, 'name' | 'refName' | 'namespace' | 'icon'> & { base?: string }
  status: ListingStatus
  maxPrice?: number
  maxCurrency: 'chaos' | 'divine'
}

export interface MarketListing {
  id: string
  name: string
  typeLine: string
  icon?: string
  ilvl?: number
  corrupted: boolean
  priceAmount?: number
  priceCurrency?: string
  indexed: string
  relativeDate: string
  ign: string
  accountName: string
  status: 'online' | 'afk' | 'offline'
  // GGG's own whisper text (missing on instant buyout listings)
  whisper?: string
  // instant buyout: travel to the seller's hideout from the trade site
  instantBuyout: boolean
  mods: string[]
}

export interface MarketResult {
  queryId: string
  total: number
  listings: MarketListing[]
  // ids of the listings not fetched yet (GGG returns up to 100 per search)
  rest: string[]
  url: string
}

// Item names for the search box: uniques, base types, gems, cards …
export function findMarketItems (search: string, max = 12): BaseType[] {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length || search.trim().length < 3) return []
  const longest = [...words].sort((a, b) => b.length - a.length)[0]
  const seen = new Set<string>()
  const out: BaseType[] = []
  const firstLetter = longest[0].toUpperCase() + longest.slice(1)
  for (const probe of [firstLetter, longest]) {
    for (const item of ITEMS_ITERATOR(probe)) {
      if (item.namespace === 'AREA' || item.namespace === 'MERCENARY_BUILD') continue
      const lc = item.name.toLowerCase()
      if (!words.every(w => lc.includes(w))) continue
      const key = `${item.namespace}:${item.refName}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
      if (out.length >= max * 3) break
    }
  }
  // exact and "starts with" first, then shorter names
  const lcSearch = search.trim().toLowerCase()
  out.sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length)
  function rank (it: BaseType) {
    const lc = it.name.toLowerCase()
    return lc === lcSearch ? 0 : lc.startsWith(lcSearch) ? 1 : 2
  }
  return out.slice(0, max)
}

export function buildTradeQuery (q: MarketQuery) {
  const query: Record<string, unknown> = {
    status: { option: q.status },
    stats: [{ type: 'and', filters: [] }],
    filters: {} as Record<string, unknown>
  }
  if (q.item.namespace === 'UNIQUE') {
    query.name = q.item.refName
    if (q.item.base) query.type = q.item.base
  } else {
    query.type = q.item.refName
    if (q.item.namespace === 'ITEM' || q.item.namespace === 'GEM') {
      (query.filters as Record<string, unknown>).type_filters = { filters: { rarity: { option: 'nonunique' } } }
    }
  }
  if (q.maxPrice != null && q.maxPrice > 0) {
    (query.filters as Record<string, unknown>).trade_filters = {
      filters: { price: { max: q.maxPrice, option: q.maxCurrency } }
    }
  }
  return { query, sort: { price: 'asc' } }
}

export function tradeSiteUrl (league: string, body: unknown, queryId?: string): string {
  const base = `https://${getTradeEndpoint()}/trade/search/${encodeURIComponent(league)}`
  return queryId ? `${base}/${queryId}` : `${base}?q=${encodeURIComponent(JSON.stringify(body))}`
}

interface SearchResponse { id: string, result: string[], total: number }

interface FetchResult {
  id: string
  item: {
    name?: string
    typeLine?: string
    baseType?: string
    icon?: string
    ilvl?: number
    corrupted?: boolean
    implicitMods?: string[]
    explicitMods?: string[]
    craftedMods?: string[]
    fracturedMods?: string[]
    enchantMods?: string[]
  }
  listing: {
    indexed: string
    whisper?: string
    hideout_token?: string
    fee?: number
    price?: { amount: number, currency: string }
    account: Account
  }
}

const PAGE = 10

export async function searchMarket (q: MarketQuery, league: string): Promise<MarketResult> {
  const body = buildTradeQuery(q)
  preventQueueCreation([
    { count: 1, limiters: RATE_LIMIT_RULES.SEARCH },
    { count: 1, limiters: RATE_LIMIT_RULES.FETCH }
  ])
  await RateLimiter.waitMulti(RATE_LIMIT_RULES.SEARCH)
  const res = await Host.proxy(`${getTradeEndpoint()}/api/trade/search/${encodeURIComponent(league)}`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  adjustRateLimits(RATE_LIMIT_RULES.SEARCH, res.headers)
  const data = await res.json() as TradeResponse<SearchResponse>
  if (data.error) throw new Error(data.error.message)

  const listings = data.result.length ? await fetchListings(data.id, data.result.slice(0, PAGE)) : []
  return { queryId: data.id, total: data.total, listings, rest: data.result.slice(PAGE), url: tradeSiteUrl(league, body, data.id) }
}

// next page of the same search (each page = one fetch request, rate-limited)
export async function moreListings (queryId: string, ids: string[]): Promise<MarketListing[]> {
  preventQueueCreation([{ count: 1, limiters: RATE_LIMIT_RULES.FETCH }])
  return await fetchListings(queryId, ids.slice(0, PAGE))
}

async function fetchListings (queryId: string, ids: string[]): Promise<MarketListing[]> {
  await RateLimiter.waitMulti(RATE_LIMIT_RULES.FETCH)
  const res = await Host.proxy(`${getTradeEndpoint()}/api/trade/fetch/${ids.join(',')}?query=${queryId}`)
  adjustRateLimits(RATE_LIMIT_RULES.FETCH, res.headers)
  const data = await res.json() as TradeResponse<{ result: Array<FetchResult | null> }>
  if (data.error) throw new Error(data.error.message)
  return data.result.filter((r): r is FetchResult => r != null).map(toListing)
}

export function toListing (r: FetchResult): MarketListing {
  const acc = r.listing.account
  const instant = r.listing.hideout_token != null || r.listing.fee != null
  return {
    id: r.id,
    name: r.item.name ?? '',
    typeLine: r.item.typeLine ?? r.item.baseType ?? '',
    icon: r.item.icon,
    ilvl: r.item.ilvl,
    corrupted: r.item.corrupted === true,
    priceAmount: r.listing.price?.amount,
    priceCurrency: r.listing.price?.currency,
    indexed: r.listing.indexed,
    relativeDate: DateTime.fromISO(r.listing.indexed).toRelative({ style: 'short' }) ?? '',
    ign: acc.lastCharacterName,
    accountName: acc.name,
    status: instant ? 'online' : acc.online ? (acc.online.status === 'afk' ? 'afk' : 'online') : 'offline',
    whisper: typeof r.listing.whisper === 'string' && r.listing.whisper.startsWith('@') ? r.listing.whisper : undefined,
    instantBuyout: instant,
    mods: [
      ...(r.item.enchantMods ?? []),
      ...(r.item.implicitMods ?? []),
      ...(r.item.fracturedMods ?? []),
      ...(r.item.explicitMods ?? []),
      ...(r.item.craftedMods ?? [])
    ].map(m => m.replace(/\[([^|\]]+\|)?([^\]]+)\]/g, '$2'))
  }
}

// One chat command per click (GGG's macro rule). Whisper = GGG's own text.
export function whisperText (l: MarketListing): string | undefined {
  return l.whisper?.split('\n')[0]
}

export function hideoutCommand (l: MarketListing): string | undefined {
  return /^[^\s@/]+$/.test(l.ign) ? `/hideout ${l.ign}` : undefined
}
