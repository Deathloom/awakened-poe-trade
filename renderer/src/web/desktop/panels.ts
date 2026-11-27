// Deathloom fork: where each panel shows (Settings → Panels →
// Where panels show). In game (HUD) is pob.hud.<panel>; this covers the
// Shift+Space overlay and the Orbhoarder window's All tab.

import { computed } from 'vue'
import type { PanelKey, HudPanel } from '@ipc/types'
import { AppConfig } from '@/web/Config'

// Deathloom fork (layout review step 6): in the order of the window's tabs; tab = the
// Orbhoarder window tab the panel lives on (Settings → Panels shows it)
export const PANELS: Array<{ key: PanelKey, label: string, hud?: HudPanel, overlay: boolean, window: boolean, view: string, tab: string }> = [
  { key: 'guide', label: 'Campaign guide / levelling', hud: 'guide', overlay: true, window: true, view: 'levelling', tab: 'Levelling' },
  { key: 'atlas', label: 'Atlas tree', hud: 'atlas', overlay: true, window: true, view: 'atlas', tab: 'Mapping' },
  { key: 'session', label: 'This session', hud: 'session', overlay: true, window: true, view: 'session', tab: 'Mapping' },
  { key: 'gear', label: 'Build (gear, gems, tree)', hud: 'gear', overlay: true, window: true, view: 'build', tab: 'Build' },
  { key: 'tree', label: 'Tree map', hud: 'tree', overlay: true, window: true, view: 'build', tab: 'Build' },
  { key: 'progress', label: 'Build progress', overlay: false, window: true, view: 'progress', tab: 'Build' },
  { key: 'market', label: 'Market (watched items, all prices)', hud: 'market', overlay: true, window: true, view: 'market', tab: 'Market' },
  { key: 'money', label: 'Profit (gems, crafting costs, currency counter, farming, league planners)', hud: 'money', overlay: true, window: true, view: 'profit', tab: 'Profit' },
  { key: 'trades', label: 'Trade companion', hud: 'trades', overlay: true, window: true, view: 'trades', tab: 'Trade' },
  { key: 'search', label: 'Market search', overlay: true, window: true, view: 'search', tab: 'Trade' },
  { key: 'board', label: "Friends' trade board", overlay: true, window: true, view: 'board', tab: 'Friends' },
  { key: 'cheats', label: 'Cheat sheets', hud: 'cheats', overlay: true, window: true, view: 'reference', tab: 'Reference' }
]

export function inOverlay (key: PanelKey): boolean {
  return AppConfig().pob?.panels?.[key]?.overlay !== false
}

export function inWindow (key: PanelKey): boolean {
  return AppConfig().pob?.panels?.[key]?.window !== false
}

export function useInOverlay (key: PanelKey) {
  return computed(() => inOverlay(key))
}
