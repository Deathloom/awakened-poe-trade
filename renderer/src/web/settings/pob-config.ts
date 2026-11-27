// Deathloom fork: the app's own settings live in config.pob (historical name);
// several settings pages edit it, so its defaults are filled in one place
import { computed } from 'vue'
import type { Config } from '@/web/Config'
import { defaultPobConfig, defaultHudConfig } from '@/web/Config'
import type { HudPanel } from '@ipc/types'
import { OFFERED_EXTRA_PANELS } from '@/web/desktop/panel-defs'
import { PANELS } from '@/web/desktop/panels'

export function usePobConfig (config: () => Config) {
  return computed(() => {
    const c = config()
    c.pob ??= defaultPobConfig()
    c.pob.chatButtons ??= 'copy'
    c.pob.hud ??= defaultHudConfig()
    c.pob.hud.clickThroughPanels ??= defaultHudConfig().clickThroughPanels
    if (c.pob.guideKey === undefined) c.pob.guideKey = null
    if (c.pob.tradesKey === undefined) c.pob.tradesKey = null
    if (c.pob.openPobKey === undefined) c.pob.openPobKey = null
    return c.pob
  })
}

export type PanelHotkeyField = 'guideKey' | 'tradesKey' | 'gearPanelKey' | null

// panels that can be pinned over the game, with where their hotkey is kept
// (layout review step 6: in the order of the window's tabs, like Where panels show)
const tabOrder = (k: string) => { const i = PANELS.findIndex(p => p.hud === k); return i < 0 ? PANELS.length : i }
export const HUD_PANELS: Array<{ key: HudPanel, label: string, hotkey: PanelHotkeyField }> = [
  { key: 'guide' as HudPanel, label: 'Campaign guide', hotkey: 'guideKey' as PanelHotkeyField },
  { key: 'trades' as HudPanel, label: 'Trade companion', hotkey: 'tradesKey' as PanelHotkeyField },
  { key: 'gear' as HudPanel, label: 'Build gear', hotkey: 'gearPanelKey' as PanelHotkeyField },
  ...OFFERED_EXTRA_PANELS.map(p => ({ key: p.panel, label: p.label, hotkey: null }))
].sort((a, b) => tabOrder(a.key) - tabOrder(b.key))
