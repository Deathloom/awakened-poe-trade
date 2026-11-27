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
  // has its own hotkey setting already (Settings → Hotkeys), so no "panel:" hotkey
  ownHotkey?: boolean
}

export const EXTRA_PANELS: ExtraPanelDef[] = [
  { panel: 'tree', label: 'Tree map', icon: 'fa-project-diagram', widget: 'tree-map', view: 'build' },
  { panel: 'atlas', label: 'Atlas tree', icon: 'fa-globe', widget: 'atlas-tree', view: 'atlas' },
  { panel: 'session', label: 'This session', icon: 'fa-stopwatch', widget: 'play-session', view: 'session' },
  { panel: 'market', label: 'Market history', icon: 'fa-chart-line', widget: '', view: 'market' },
  { panel: 'overview', label: 'Market overview (poe.ninja)', icon: 'fa-coins', widget: 'market-overview', view: 'market' },
  { panel: 'cheats', label: 'Cheat sheets', icon: 'fa-book', widget: 'cheat-sheets', view: 'reference' },
  { panel: 'money', label: 'Profit', icon: 'fa-piggy-bank', widget: 'money-tools', view: 'profit' },
  // Deathloom fork (27 Nov 2026, layout follow-up): can be pinned in game too. Board and
  // Market search keep their own overlay widgets and hotkeys; Build progress is in game only
  { panel: 'board', label: "Friends' trade board", icon: 'fa-people-carry', widget: '', view: 'board', ownHotkey: true },
  { panel: 'search', label: 'Market search', icon: 'fa-search-dollar', widget: '', view: 'search', ownHotkey: true },
  { panel: 'progress', label: 'Build progress', icon: 'fa-tasks', widget: '', view: 'progress' }
]

// Deathloom fork (16 Nov 2026): Market overview is a tab of Market history now.
// Still defined (old settings, HUD and widget code know it) but not offered.
export const MERGED_PANELS: ReadonlySet<string> = new Set(['overview'])
export const OFFERED_EXTRA_PANELS = EXTRA_PANELS.filter(p => !MERGED_PANELS.has(p.panel))

// panels with a "panel:<panel>" hotkey in Settings → Hotkeys
export const HOTKEY_EXTRA_PANELS = OFFERED_EXTRA_PANELS.filter(p => !p.ownHotkey)

export const PANEL_WIDGET_TYPES = EXTRA_PANELS.filter(p => p.widget).map(p => p.widget)
