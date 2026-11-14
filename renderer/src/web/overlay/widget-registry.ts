import type { Component } from 'vue'
import type { WidgetSpec } from './interfaces'
import WidgetTimer from '../stopwatch/WidgetTimer.vue'
import WidgetStashSearch from '../stash-search/WidgetStashSearch.vue'
import WidgetMenu from './WidgetMenu.vue'
import PriceCheckWindow from '@/web/price-check/PriceCheckWindow.vue'
import WidgetItemCheck from '@/web/item-check/WidgetItemCheck.vue'
import WidgetImageStrip from './WidgetImageStrip.vue'
import WidgetDelveGrid from './WidgetDelveGrid.vue'
import WidgetItemSearch from '../item-search/WidgetItemSearch.vue'
import WidgetSettings from '../settings/SettingsWindow.vue'
import WidgetPobGear from '../pob/WidgetPobGear.vue'
import WidgetTradeCompanion from '../companion/WidgetTradeCompanion.vue'
import WidgetCampaignGuide from '../companion/WidgetCampaignGuide.vue'
import WidgetMarketHistory from '../market-history/WidgetMarketHistory.vue'
import WidgetSetupGuide from '../setup/WidgetSetupGuide.vue'

type WidgetComponent = Component & { widget: WidgetSpec }

export const registry = {
  widgets: [] as WidgetComponent[],

  getWidgetComponent (wmType: string) {
    return this.widgets.find(component => component.widget.type === wmType)
  }
}

// Core
registry.widgets.push(WidgetMenu as unknown as WidgetComponent)
registry.widgets.push(WidgetSettings as unknown as WidgetComponent)
// Extra
registry.widgets.push(WidgetItemSearch as unknown as WidgetComponent)
registry.widgets.push(WidgetTimer as unknown as WidgetComponent)
registry.widgets.push(WidgetStashSearch as unknown as WidgetComponent)
registry.widgets.push(PriceCheckWindow as unknown as WidgetComponent)
registry.widgets.push(WidgetItemCheck as unknown as WidgetComponent)
registry.widgets.push(WidgetImageStrip as unknown as WidgetComponent)
registry.widgets.push(WidgetDelveGrid as unknown as WidgetComponent)
// Deathloom fork
registry.widgets.push(WidgetPobGear as unknown as WidgetComponent)
registry.widgets.push(WidgetTradeCompanion as unknown as WidgetComponent)
registry.widgets.push(WidgetCampaignGuide as unknown as WidgetComponent)
registry.widgets.push(WidgetMarketHistory as unknown as WidgetComponent)
registry.widgets.push(WidgetSetupGuide as unknown as WidgetComponent)
