// Deathloom fork: the "show while playing" HUD window loads the same page with ?hud
// (?hud=guide / trades / gear: one window per pinned panel)
import type { HudPanel } from '@ipc/types'

const params = new URLSearchParams(window.location.search)
export const IS_HUD = params.has('hud')
export const HUD_PANEL = (params.get('hud') || 'guide') as HudPanel

// Deathloom fork: the desktop window (all panels, for a second screen) loads
// the same page with ?desktop. It connects like the HUD (never the "last
// active" overlay client) but may save settings.
export const IS_DESKTOP = params.has('desktop') && !IS_HUD

// Deathloom fork: optional second Loot Goblin window (?desktop=2, third screen).
// It keeps its own tab, All-tab layout and split sizes (localStorage keys with
// ".w2"), starting from window 1's until changed there.
export const DESKTOP_ID: 0 | 1 | 2 = IS_DESKTOP ? (params.get('desktop') === '2' ? 2 : 1) : 0
export const IS_DESKTOP2 = DESKTOP_ID === 2

export function windowKey (key: string): string {
  return IS_DESKTOP2 ? `${key}.w2` : key
}

export function readWindowKey (key: string): string | null {
  return IS_DESKTOP2 ? (localStorage.getItem(`${key}.w2`) ?? localStorage.getItem(key)) : localStorage.getItem(key)
}
