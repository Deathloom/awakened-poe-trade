// Deathloom fork: build gear panel actions shared by the overlay widget and the
// HUD window. In the HUD they are sent to the overlay, which owns the league
// list and the price check window.

import { Host } from '@/web/background/IPC'
import { openTradeLink } from '@/web/desktop/trade-tab'
import { AppConfig } from '@/web/Config'
import { useLeagues } from '@/web/background/Leagues'
import { parseClipboard } from '@/parser'
import { createPresets } from '@/web/price-check/filters/create-presets'
import { createTradeRequest } from '@/web/price-check/trade/pathofexile-trade'
import { getTradeEndpoint } from '@/web/price-check/trade/common'
import type { PriceCheckWidget } from '../overlay/interfaces'

// Deathloom fork (Q20): the trade query for a PoB item text.
//  'exact'   Trade = this base type with all its mods ticked (at least these values)
//  'upgrade' ↑ = any base of the same kind with the same mods
//  'similar' what the price check picks by default (for an estimate)
// Returns the query and league, or an error message.
export type TradeQueryMode = 'exact' | 'upgrade' | 'similar'
export function tradeQueryFor (text: string, mode: TradeQueryMode): { query: ReturnType<typeof createTradeRequest>, league: string } | string {
  const parsed = parseClipboard(text)
  if (parsed.isErr()) {
    return "The overlay couldn't read this item; try the price check button."
  }
  const league = useLeagues().selectedId.value
  if (!league) {
    return 'Pick a league first (price check window title).'
  }
  const widget = AppConfig<PriceCheckWidget>('price-check')!
  const presets = createPresets(parsed.value, {
    league,
    merchantOnly: widget.merchantOnly,
    collapseListings: widget.collapseListings,
    activateStockFilter: widget.activateStockFilter,
    searchStatRange: widget.searchStatRange,
    useEn: AppConfig().useIntlSite,
    currency: widget.defaultCurrency
  })
  const preset = presets.presets.find(p => p.id === presets.active)!
  if (mode !== 'similar') {
    // Deathloom fork (Gerhard 17 Nov 2026): Trade = this base type with all its
    // mods ticked (at least these values); ↑ upgrade = any base of the same kind
    // with the same mods. Before, the mods came through unticked (price check
    // defaults) and Trade searched any wand instead of the item's base.
    const upgrade = mode === 'upgrade'
    if (preset.filters.searchRelaxed) preset.filters.searchRelaxed.disabled = !upgrade
    // uniques: Trade = any copy of this unique; ↑ = the same unique with at least these rolls
    if (parsed.value.rarity !== 'Unique' || upgrade) {
      for (const s of preset.stats) {
        if (s.group || s.hidden || s.not || !s.tradeId.length) continue
        if (s.roll) {
          if (s.roll.isNegated) continue
          s.roll.min = s.roll.value
          s.roll.max = ''
        }
        s.disabled = false
      }
    }
  }
  return { query: createTradeRequest(preset.filters, preset.stats), league }
}

export function tradeSiteUrl (query: unknown, league: string, queryId?: string) {
  return queryId
    ? `https://${getTradeEndpoint()}/trade/search/${league}/${queryId}`
    : `https://${getTradeEndpoint()}/trade/search/${league}?q=${JSON.stringify(query)}`
}

// Exact stat search on the official trade site; returns an error message or null.
// upgrade (idea 8): any base of the same kind, with at least the values this item
// has on the stats the price check picks by default (life, resistances, …)
export function openTradeSearch (text: string, upgrade = false): string | null {
  const q = tradeQueryFor(text, upgrade ? 'upgrade' : 'exact')
  if (typeof q === 'string') return q
  openTradeLink(tradeSiteUrl(q.query, q.league))
  return null
}

// Deathloom fork (20 Nov 2026, Market → Shopping): trade search by item type only
// (gems), cheapest first, online sellers. Returns an error message or null.
export function openTradeByType (type: string): string | null {
  const league = useLeagues().selectedId.value
  if (!league) return 'Pick a league first (price check window title).'
  const query = { query: { status: { option: 'online' }, type, stats: [{ type: 'and', filters: [] }] }, sort: { price: 'asc' } }
  openTradeLink(`https://${getTradeEndpoint()}/trade/search/${league}?q=${JSON.stringify(query)}`)
  return null
}

// Open the normal price check window for this item (stat filters, prices, build impact)
export function openPriceCheck (text: string, position: { x: number, y: number }) {
  Host.selfDispatch({
    name: 'MAIN->CLIENT::item-text',
    payload: {
      clipboard: text,
      position,
      focusOverlay: true,
      target: 'price-check'
    }
  })
}
