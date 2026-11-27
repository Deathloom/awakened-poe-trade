<template>
  <!-- Deathloom fork: price trends for watched items (poe.ninja 7 days + points recorded by the overlay) -->
  <Widget :config="config" move-handles="corners" grip :removable="false" :inline-edit="false">
    <MarketHistoryBody :active="config.wmWants === 'show'" />
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from '../overlay/interfaces'
import type { Widget as WidgetT, Anchor } from '../overlay/widgets'

export interface MarketHistoryWidget extends WidgetT {
  anchor: Anchor
}

export default {
  widget: {
    type: 'market-history',
    instances: 'single',
    initInstance: (): MarketHistoryWidget => ({
      wmId: 0,
      wmType: 'market-history',
      wmTitle: '{icon=fa-chart-line}',
      wmWants: 'hide',
      wmZorder: null,
      wmFlags: ['invisible-on-blur'],
      anchor: { pos: 'tl', x: 40, y: 15 }
    })
  } satisfies WidgetSpec
}
</script>

<script setup lang="ts">
import Widget from '../overlay/Widget.vue'
import { computed, inject as injectWm, onUnmounted, watch as watchPlacement } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import type { WidgetManager } from '../overlay/interfaces'
import { useInOverlay } from '../desktop/panels'
import { LazyMarketHistoryBody as MarketHistoryBody } from '../ui/LazyBodies'
import { toggleFromHotkey } from '../overlay/hotkey-toggle'

const props = defineProps<{ config: MarketHistoryWidget }>()
// Where panels show: not in the overlay → hidden and out of the widget menu
const wmPlace = injectWm<WidgetManager>('wm')!
const inOverlay = useInOverlay('market')
// pinned in game (HUD window) counts as not in the overlay
const shown = computed(() => inOverlay.value && !AppConfig().pob?.hud?.market)
watchPlacement(shown, (on) => {
  wmPlace.setFlag(props.config.wmId, 'menu::skip', !on)
  if (!on && props.config.wmWants === 'show') wmPlace.hide(props.config.wmId)
}, { immediate: true })
// hotkey (Settings → Hotkeys); pinned in game it toggles in the HUD window (main)
const hotkey = Host.onEvent('MAIN->CLIENT::widget-action', (e) => {
  if (e.target !== 'panel:market' || !shown.value) return
  toggleFromHotkey(wmPlace, props.config.wmId, props.config.wmWants)
})
onUnmounted(() => { hotkey.abort() })
</script>
