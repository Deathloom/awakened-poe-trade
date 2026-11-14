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
import MarketHistoryBody from './MarketHistoryBody.vue'

defineProps<{ config: MarketHistoryWidget }>()
</script>
