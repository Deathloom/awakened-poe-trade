// Deathloom fork: the "show while playing" HUD window loads the same page with ?hud
// (?hud=guide / trades / gear: one window per pinned panel)
import type { HudPanel } from '@ipc/types'

const params = new URLSearchParams(window.location.search)
export const IS_HUD = params.has('hud')
export const HUD_PANEL = (params.get('hud') || 'guide') as HudPanel
