// Deathloom fork: build gear panel actions shared by the overlay widget and the
// HUD window. In the HUD they are sent to the overlay, which owns the league
// list and the price check window.

import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { useLeagues } from '@/web/background/Leagues'
import { parseClipboard } from '@/parser'
import { createPresets } from '@/web/price-check/filters/create-presets'
import { createTradeRequest } from '@/web/price-check/trade/pathofexile-trade'
import { getTradeEndpoint } from '@/web/price-check/trade/common'
import type { PriceCheckWidget } from '../overlay/interfaces'

// Exact stat search on the official trade site; returns an error message or null
export function openTradeSearch (text: string): string | null {
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
  const query = createTradeRequest(preset.filters, preset.stats)
  window.open(`https://${getTradeEndpoint()}/trade/search/${league}?q=${JSON.stringify(query)}`)
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
