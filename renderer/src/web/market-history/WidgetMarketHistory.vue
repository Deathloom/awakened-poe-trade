<template>
  <!-- Deathloom fork: price trends for watched items (poe.ninja 7 days + points recorded by the overlay) -->
  <Widget :config="config" move-handles="tl" :removable="false" :inline-edit="false">
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
import { inject as injectWm, watch as watchPlacement } from 'vue'
import type { WidgetManager } from '../overlay/interfaces'
import { useInOverlay } from '../desktop/panels'
import MarketHistoryBody from './MarketHistoryBody.vue'

const props = defineProps<{ config: MarketHistoryWidget }>()
// Where panels show: not in the overlay → hidden and out of the widget menu
const wmPlace = injectWm<WidgetManager>('wm')!
const shown = useInOverlay('market')
watchPlacement(shown, (on) => {
  wmPlace.setFlag(props.config.wmId, 'menu::skip', !on)
  if (!on && props.config.wmWants === 'show') wmPlace.hide(props.config.wmId)
}, { immediate: true })
</script>
