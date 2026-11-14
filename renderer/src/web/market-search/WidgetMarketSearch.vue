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
import { inject as injectWm, nextTick, onUnmounted, ref, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import Widget from '../overlay/Widget.vue'
import type { WidgetManager } from '../overlay/interfaces'
import { useInOverlay } from '../desktop/panels'
import MarketSearchBody from './MarketSearchBody.vue'

const props = defineProps<{ config: MarketSearchWidget }>()
const body = ref<InstanceType<typeof MarketSearchBody>>()
watch(() => props.config.wmWants, (w) => {
  if (w === 'show') nextTick(() => body.value?.focus()).catch(() => {})
})
// Where panels show: not in the overlay → hidden and out of the widget menu
const wmPlace = injectWm<WidgetManager>('wm')!
const shown = useInOverlay('search')
watch(shown, (on) => {
  wmPlace.setFlag(props.config.wmId, 'menu::skip', !on)
  if (!on && props.config.wmWants === 'show') wmPlace.hide(props.config.wmId)
}, { immediate: true })
// hotkey (Settings → Path of Building): toggles it in the overlay (focused, so you can type)
const hotkey = Host.onEvent('MAIN->CLIENT::widget-action', (e) => {
  if (e.target !== 'market-search' || !shown.value) return
  if (props.config.wmWants === 'hide' || !wmPlace.active.value) wmPlace.show(props.config.wmId)
  else wmPlace.hide(props.config.wmId)
})
onUnmounted(() => { hotkey.abort() })
</script>
