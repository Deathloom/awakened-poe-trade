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
