// Deathloom fork: overlay widgets for the panels added in 1.0.63 (one widget
// type each, all drawn by WidgetPanel.vue), and the bodies the HUD shows.
import type { Component } from 'vue'
import type { WidgetSpec } from './interfaces'
import type { Widget as WidgetT, Anchor } from './widgets'
import PobTreeMap from '../pob/PobTreeMap.vue'
import AtlasTreeMap from '../atlas/AtlasTreeMap.vue'
import PlaySessionBody from '../companion/PlaySessionBody.vue'
import MarketOverview from '../market-history/MarketOverview.vue'
import MarketHistoryBody from '../market-history/MarketHistoryBody.vue'
import { EXTRA_PANELS } from '../desktop/panel-defs'

export interface PanelBody {
  panel: string
  label: string
  icon: string
  body: Component
  props: Record<string, unknown>
  // dark box behind it (canvas panels)
  boxed: boolean
  w: string
  h: string
}

const BODIES: Record<string, Omit<PanelBody, 'panel' | 'label' | 'icon'>> = {
  tree: { body: PobTreeMap, props: { levelling: true, compact: true }, boxed: true, w: '30rem', h: '24rem' },
  atlas: { body: AtlasTreeMap, props: { compact: true }, boxed: true, w: '34rem', h: '26rem' },
  session: { body: PlaySessionBody, props: {}, boxed: false, w: '22rem', h: '24rem' },
  market: { body: MarketHistoryBody, props: { active: true, fill: true }, boxed: false, w: '26rem', h: '24rem' },
  overview: { body: MarketOverview, props: {}, boxed: false, w: '30rem', h: '26rem' }
}

// by panel (HUD) and by widget type (overlay)
export const PANEL_BODY_BY_PANEL: Record<string, PanelBody> = {}
export const PANEL_BODIES: Record<string, PanelBody> = {}
for (const p of EXTRA_PANELS) {
  const b: PanelBody = { panel: p.panel, label: p.label, icon: p.icon, ...BODIES[p.panel] }
  PANEL_BODY_BY_PANEL[p.panel] = b
  if (p.widget) PANEL_BODIES[p.widget] = b
}

export function panelWidgetSpecs (): WidgetSpec[] {
  return EXTRA_PANELS.filter(p => p.widget).map((p, i) => ({
    type: p.widget,
    instances: 'single',
    initInstance: (): WidgetT & { anchor: Anchor } => ({
      wmId: 0,
      wmType: p.widget,
      wmTitle: `{icon=${p.icon}}`,
      wmWants: 'hide',
      wmZorder: null,
      wmFlags: ['invisible-on-blur'],
      anchor: { pos: 'tc', x: 40 + i * 4, y: 12 + i * 2 }
    })
  }))
}
