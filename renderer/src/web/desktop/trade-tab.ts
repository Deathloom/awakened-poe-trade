// Deathloom fork: opening GGG's trade site in the Loot Goblin window's
// Trade site tab, from any window (overlay, HUD panels or the window itself).

import { ref } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { IS_DESKTOP, IS_DESKTOP2 } from '@/web/hud/is-hud'

// trade pages open in window 1 (window 2 keeps its own Trade site tab for browsing)
const isDesktop = IS_DESKTOP && !IS_DESKTOP2

// page the Trade site tab should show next (read once by the tab)
export const tradeTabUrl = ref<string | undefined>(
  isDesktop ? (new URLSearchParams(window.location.search).get('trade') ?? undefined) : undefined)
// bumped every time a page is asked for, so the window switches to the tab
export const tradeTabRequest = ref(tradeTabUrl.value ? 1 : 0)

export function isTradeSitePage (url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'www.pathofexile.com' && u.pathname.startsWith('/trade')
  } catch {
    return false
  }
}

// Shows the page in the Trade site tab; anything that isn't a trade site page
// (or a non-English realm) opens in the browser as before.
export function openTradeTab (url: string) {
  if (!isTradeSitePage(url)) {
    window.open(url)
    return
  }
  if (isDesktop) {
    tradeTabUrl.value = url
    tradeTabRequest.value++
  } else {
    Host.sendEvent({ name: 'CLIENT->MAIN::user-action', payload: { action: 'open-trade-tab', url } })
  }
}

if (isDesktop) {
  Host.onEvent('MAIN->CLIENT::open-trade-tab', ({ url }) => {
    if (!isTradeSitePage(url)) return
    tradeTabUrl.value = url
    tradeTabRequest.value++
  })
}

// Trade buttons: the Trade site tab (setting, on by default) or the browser
export function openTradeLink (url: string) {
  if (AppConfig().pob?.tradeLinksInWindow === false) {
    window.open(url)
  } else {
    openTradeTab(url)
  }
}
