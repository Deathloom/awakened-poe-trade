// Deathloom fork: panels added to the overlay and the in-game HUD in 1.0.63
// (before, they were only in the Orbhoarder window). No imports: Config.ts,
// main and the widgets all read this.
import type { HudPanel } from '@ipc/types'

export interface ExtraPanelDef {
  panel: HudPanel
  label: string
  icon: string
  // overlay widget type ('' = the panel already had an overlay widget)
  widget: string
  // Orbhoarder window tab its hotkey opens when it's in neither the overlay nor in game
  view: string
}

export const EXTRA_PANELS: ExtraPanelDef[] = [
  { panel: 'tree', label: 'Tree map', icon: 'fa-project-diagram', widget: 'tree-map', view: 'build' },
  { panel: 'atlas', label: 'Atlas tree', icon: 'fa-globe', widget: 'atlas-tree', view: 'atlas' },
  { panel: 'session', label: 'This session', icon: 'fa-stopwatch', widget: 'play-session', view: 'overview' },
  { panel: 'market', label: 'Market history', icon: 'fa-chart-line', widget: '', view: 'market' },
  { panel: 'overview', label: 'Market overview (poe.ninja)', icon: 'fa-coins', widget: 'market-overview', view: 'market' },
  { panel: 'cheats', label: 'Cheat sheets', icon: 'fa-book', widget: 'cheat-sheets', view: 'reference' },
  { panel: 'money', label: 'Money tools', icon: 'fa-piggy-bank', widget: 'money-tools', view: 'market' }
]

// Deathloom fork (16 Nov 2026): Market overview is a tab of Market history now.
// Still defined (old settings, HUD and widget code know it) but not offered.
export const MERGED_PANELS: ReadonlySet<string> = new Set(['overview'])
export const OFFERED_EXTRA_PANELS = EXTRA_PANELS.filter(p => !MERGED_PANELS.has(p.panel))

export const PANEL_WIDGET_TYPES = EXTRA_PANELS.filter(p => p.widget).map(p => p.widget)
