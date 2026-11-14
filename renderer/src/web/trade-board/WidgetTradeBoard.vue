<template>
  <!-- Deathloom fork: friends' trade board in the overlay (widget menu, or the
       "Post to friends' board" hotkey on a hovered item) -->
  <Widget :config="config" move-handles="tl" :removable="false" :inline-edit="false">
    <TradeBoardBody />
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from '../overlay/interfaces'
import type { Widget as WidgetT, Anchor } from '../overlay/widgets'

export interface TradeBoardWidget extends WidgetT {
  anchor: Anchor
}

export default {
  widget: {
    type: 'trade-board',
    instances: 'single',
    initInstance: (): TradeBoardWidget => ({
      wmId: 0,
      wmType: 'trade-board',
      wmTitle: '{icon=fa-people-carry}',
      wmWants: 'hide',
      wmZorder: null,
      wmFlags: ['invisible-on-blur'],
      anchor: { pos: 'tc', x: 50, y: 10 }
    })
  } satisfies WidgetSpec
}
</script>

<script setup lang="ts">
import { inject, watch } from 'vue'
import Widget from '../overlay/Widget.vue'
import type { WidgetManager } from '../overlay/interfaces'
import { Host } from '@/web/background/IPC'
import { useInOverlay } from '../desktop/panels'
import { postDraft } from './board'
import TradeBoardBody from './TradeBoardBody.vue'

const props = defineProps<{ config: TradeBoardWidget }>()
const wm = inject<WidgetManager>('wm')!

// hotkey on a hovered item: open the board with the post form filled in
Host.onEvent('MAIN->CLIENT::item-text', (e) => {
  if (e.target !== 'board-post') return
  postDraft.value = { item: e.clipboard, at: Date.now() }
  wm.show(props.config.wmId)
})

// Where panels show: not in the overlay → hidden and out of the widget menu
const shown = useInOverlay('board')
watch(shown, (on) => {
  wm.setFlag(props.config.wmId, 'menu::skip', !on)
  if (!on && props.config.wmWants === 'show') wm.hide(props.config.wmId)
}, { immediate: true })
</script>
