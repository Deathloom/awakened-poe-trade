// Deathloom fork: where each panel shows (Settings → Panels →
// Where panels show). In game (HUD) is pob.hud.<panel>; this covers the
// Shift+Space overlay and the Orbhoarder window's All tab.

import { computed } from 'vue'
import type { PanelKey, HudPanel } from '@ipc/types'
import { AppConfig, type Config } from '@/web/Config'
import { POE1_ONLY_PANELS, POE1_ONLY_VIEWS } from '@ipc/game'

// Deathloom fork (layout review step 6): in the order of the window's tabs; tab = the
// Orbhoarder window tab the panel lives on (Settings → Panels shows it)
export const PANELS: Array<{ key: PanelKey, label: string, hud?: HudPanel, overlay: boolean, window: boolean, view: string, tab: string }> = [
  { key: 'guide', label: 'Campaign guide / levelling', hud: 'guide', overlay: true, window: true, view: 'levelling', tab: 'Levelling' },
  { key: 'atlas', label: 'Atlas tree', hud: 'atlas', overlay: true, window: true, view: 'atlas', tab: 'Mapping' },
  { key: 'session', label: 'This session', hud: 'session', overlay: true, window: true, view: 'session', tab: 'Mapping' },
  { key: 'gear', label: 'Build (gear, gems, tree)', hud: 'gear', overlay: true, window: true, view: 'build', tab: 'Build' },
  { key: 'tree', label: 'Tree map', hud: 'tree', overlay: true, window: true, view: 'build', tab: 'Build' },
  { key: 'progress', label: 'Build progress', hud: 'progress', overlay: false, window: true, view: 'progress', tab: 'Build' },
  { key: 'market', label: 'Market (watched items, all prices)', hud: 'market', overlay: true, window: true, view: 'market', tab: 'Market' },
  { key: 'money', label: 'Profit (gems, crafting costs, currency counter, farming, league planners)', hud: 'money', overlay: true, window: true, view: 'profit', tab: 'Profit' },
  { key: 'trades', label: 'Trade companion', hud: 'trades', overlay: true, window: true, view: 'trades', tab: 'Trade' },
  { key: 'search', label: 'Market search', hud: 'search', overlay: true, window: true, view: 'search', tab: 'Trade' },
  { key: 'board', label: "Friends' trade board", hud: 'board', overlay: true, window: true, view: 'board', tab: 'Friends' },
  { key: 'cheats', label: 'Cheat sheets', hud: 'cheats', overlay: true, window: true, view: 'reference', tab: 'Reference' }
]

// Deathloom fork (wave 6): panels and window tabs that only work for PoE1 (PoB
// builds, PoE1 campaign / atlas / league planners, poe.ninja PoE1 prices). Hidden
// everywhere (overlay, in game, window) while PoE2 is the active game.
export { POE1_ONLY_PANELS, POE1_ONLY_VIEWS }

export function isPoe2 (): boolean {
  return (AppConfig() as Config | null)?.game === 'poe2'
}

export function hiddenForGame (key: string): boolean {
  return isPoe2() && POE1_ONLY_PANELS.has(key)
}

export function inOverlay (key: PanelKey): boolean {
  return !hiddenForGame(key) && AppConfig().pob?.panels?.[key]?.overlay !== false
}

export function inWindow (key: PanelKey): boolean {
  return !hiddenForGame(key) && AppConfig().pob?.panels?.[key]?.window !== false
}

export function useInOverlay (key: PanelKey) {
  return computed(() => inOverlay(key))
}
