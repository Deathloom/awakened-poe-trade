// Deathloom fork (Q20): price a build's rare in Market → Shopping. One trade search
// plus one fetch of the 10 cheapest listings, only when you click Price, through the
// same rate limiter as the price check (GGG's normal limits, nothing in the background).
// PoE1 only: Path of Building builds are PoE1 items.
import { AppConfig } from '@/web/Config'
import { tradeQueryFor, tradeSiteUrl } from '@/web/pob/gear-actions'
import { requestTradeResultList, requestResults } from '@/web/price-check/trade/pathofexile-trade'
import { rareEstimate, TRADE_CURRENCY_NAMES, type RareEstimate } from './market-tools'

export interface RarePrice extends RareEstimate {
  // listings found in total
  total: number
  url: string
  at: number
}

// in memory, per item text: a second click within 15 minutes doesn't search again
const memo = new Map<string, RarePrice>()
const TTL = 15 * 60_000

export function cachedRarePrice (text: string): RarePrice | null {
  const hit = memo.get(text)
  return hit && Date.now() - hit.at < TTL ? hit : null
}

export async function priceRare (text: string, prices: { divine: number | undefined, item: (name: string) => number | null }): Promise<RarePrice | string> {
  if (AppConfig().game === 'poe2') return 'Rare prices are for PoE1 builds; switch to PoE1 in Settings.'
  const hit = cachedRarePrice(text)
  if (hit) return hit
  const q = tradeQueryFor(text, 'similar')
  if (typeof q === 'string') return q
  try {
    const search = await requestTradeResultList(q.query, q.league)
    const url = tradeSiteUrl(q.query, q.league, search.id)
    if (!search.result.length) return 'No listings like this one right now. Try Trade and untick some mods.'
    const listings = await requestResults(search.id, search.result.slice(0, 10), { accountName: AppConfig().accountName })
    const est = rareEstimate(listings.map(l => ({ amount: l.priceAmount, currency: l.priceCurrency })), (c) => {
      if (c === 'chaos') return 1
      if (c === 'divine') return prices.divine ?? null
      const name = TRADE_CURRENCY_NAMES[c]
      return name ? prices.item(name) : null
    })
    if (!est) return 'The cheapest listings have no price in chaos or divine. Use Trade to look.'
    const res: RarePrice = { ...est, total: search.total, url, at: Date.now() }
    memo.set(text, res)
    return res
  } catch (e) {
    return `Trade site: ${(e as Error).message}`
  }
}
