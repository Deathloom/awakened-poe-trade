// Deathloom fork: panels added to the overlay and the in-game HUD in 1.0.63
// (before, they were only in the Loot Goblin window). No imports: Config.ts,
// main and the widgets all read this.
import type { HudPanel } from '@ipc/types'

export interface ExtraPanelDef {
  panel: HudPanel
  label: string
  icon: string
  // overlay widget type ('' = the panel already had an overlay widget)
  widget: string
  // Loot Goblin window tab its hotkey opens when it's in neither the overlay nor in game
  view: string
}

export const EXTRA_PANELS: ExtraPanelDef[] = [
  { panel: 'tree', label: 'Tree map', icon: 'fa-project-diagram', widget: 'tree-map', view: 'build' },
  { panel: 'atlas', label: 'Atlas tree', icon: 'fa-globe', widget: 'atlas-tree', view: 'atlas' },
  { panel: 'session', label: 'This session', icon: 'fa-stopwatch', widget: 'play-session', view: 'overview' },
  { panel: 'market', label: 'Market history', icon: 'fa-chart-line', widget: '', view: 'market' },
  { panel: 'overview', label: 'Market overview (poe.ninja)', icon: 'fa-coins', widget: 'market-overview', view: 'market' }
]

export const PANEL_WIDGET_TYPES = EXTRA_PANELS.filter(p => p.widget).map(p => p.widget)
