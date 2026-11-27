// Deathloom fork: where each panel shows (Settings → Panels →
// Where panels show). In game (HUD) is pob.hud.<panel>; this covers the
// Shift+Space overlay and the Orbhoarder window's All tab.

import { computed } from 'vue'
import type { PanelKey, HudPanel } from '@ipc/types'
import { AppConfig } from '@/web/Config'

export const PANELS: Array<{ key: PanelKey, label: string, hud?: HudPanel, overlay: boolean, window: boolean, view: string }> = [
  { key: 'gear', label: 'Build (gear, gems, tree)', hud: 'gear', overlay: true, window: true, view: 'build' },
  { key: 'guide', label: 'Campaign guide / levelling', hud: 'guide', overlay: true, window: true, view: 'levelling' },
  { key: 'trades', label: 'Trade companion', hud: 'trades', overlay: true, window: true, view: 'trades' },
  { key: 'market', label: 'Market (watched items, all prices)', hud: 'market', overlay: true, window: true, view: 'market' },
  { key: 'search', label: 'Market search', overlay: true, window: false, view: 'trade' },
  { key: 'board', label: "Friends' trade board", overlay: true, window: true, view: 'board' },
  { key: 'tree', label: 'Tree map', hud: 'tree', overlay: true, window: true, view: 'build' },
  { key: 'atlas', label: 'Atlas tree', hud: 'atlas', overlay: true, window: true, view: 'atlas' },
  { key: 'session', label: 'This session', hud: 'session', overlay: true, window: true, view: 'overview' },
  { key: 'cheats', label: 'Cheat sheets', hud: 'cheats', overlay: true, window: true, view: 'reference' },
  { key: 'money', label: 'Money tools (gem levelling, currency counter)', hud: 'money', overlay: true, window: true, view: 'market' }
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
