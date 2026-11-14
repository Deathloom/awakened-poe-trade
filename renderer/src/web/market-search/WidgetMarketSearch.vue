<template>
  <!-- Deathloom fork: market search (by name, no price check needed) -->
  <Widget :config="config" move-handles="tl" :removable="false" :inline-edit="false">
    <div class="widget-default-style p-1 flex flex-col" style="height: 32rem; max-height: 80vh;">
      <MarketSearchBody ref="body" />
    </div>
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from '../overlay/interfaces'
import type { Widget as WidgetT, Anchor } from '../overlay/widgets'

export interface MarketSearchWidget extends WidgetT {
  anchor: Anchor
}

export default {
  widget: {
    type: 'market-search',
    instances: 'single',
    initInstance: (): MarketSearchWidget => ({
      wmId: 0,
      wmType: 'market-search',
      wmTitle: '{icon=fa-search-dollar}',
      wmWants: 'hide',
      wmZorder: null,
      wmFlags: ['invisible-on-blur'],
      anchor: { pos: 'tc', x: 50, y: 10 }
    })
  } satisfies WidgetSpec
}
</script>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import Widget from '../overlay/Widget.vue'
import MarketSearchBody from './MarketSearchBody.vue'

const props = defineProps<{ config: MarketSearchWidget }>()
const body = ref<InstanceType<typeof MarketSearchBody>>()
watch(() => props.config.wmWants, (w) => {
  if (w === 'show') nextTick(() => body.value?.focus()).catch(() => {})
})
</script>
