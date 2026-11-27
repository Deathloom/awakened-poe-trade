// Deathloom fork (S4): panel bodies are loaded the first time they are shown
// instead of with every window (overlay, HUD, desktop), like the PoB panels
// (pob/LazyPobPanels.ts) and the atlas tree map. Each body is its own chunk; the
// widget wrappers (which carry the static `widget` spec) stay in the main
// bundle. The chunk is a local file, so the wait is a frame or two and nothing
// is shown meanwhile. A failed load is tried once more, then left empty (the
// next window load tries again). Template refs and emits pass through to the
// loaded body, so callers don't change.
import { defineAsyncComponent, type Component } from 'vue'

function lazy<T extends Component> (loader: () => Promise<{ default: T }>): T {
  return defineAsyncComponent({
    loader,
    onError (err, retry, fail, attempts) {
      if (attempts <= 1) retry()
      else { console.error(err); fail() }
    }
  }) as unknown as T
}

export const LazyPobGearBody = lazy(() => import('../pob/PobGearBody.vue'))
export const LazyLevellingBody = lazy(() => import('../desktop/LevellingBody.vue'))
export const LazyTradeCompanionBody = lazy(() => import('../companion/TradeCompanionBody.vue'))
export const LazyTradeBoardBody = lazy(() => import('../trade-board/TradeBoardBody.vue'))
export const LazyMarketHistoryBody = lazy(() => import('../market-history/MarketHistoryBody.vue'))
export const LazyMarketOverview = lazy(() => import('../market-history/MarketOverview.vue'))
export const LazyMarketSearchBody = lazy(() => import('../market-search/MarketSearchBody.vue'))
export const LazyPlaySessionBody = lazy(() => import('../companion/PlaySessionBody.vue'))
export const LazyCheatSheetsBody = lazy(() => import('../cheats/CheatSheetsBody.vue'))
export const LazyMoneyToolsBody = lazy(() => import('../money/MoneyToolsBody.vue'))
export const LazyCraftBody = lazy(() => import('../craft/CraftBody.vue'))
export const LazyHelpBody = lazy(() => import('../help/HelpBody.vue'))
