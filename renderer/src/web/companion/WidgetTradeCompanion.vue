<template>
  <!-- Deathloom fork: trade companion (incoming/outgoing trade whispers from Client.txt) + sales ledger -->
  <Widget :config="config" move-handles="tl" :removable="false" :inline-edit="false">
    <TradeCompanionBody v-if="!inHud" @incoming="onIncoming" />
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from '../overlay/interfaces'
import type { Widget as WidgetT, Anchor } from '../overlay/widgets'

export interface TradeCompanionWidget extends WidgetT {
  anchor: Anchor
}

export default {
  widget: {
    type: 'trade-companion',
    instances: 'single',
    initInstance: (): TradeCompanionWidget => ({
      wmId: 0,
      wmType: 'trade-companion',
      wmTitle: '{icon=fa-handshake}',
      wmWants: 'hide',
      wmZorder: null,
      wmFlags: ['invisible-on-blur'],
      anchor: { pos: 'tr', x: 98, y: 20 }
    })
  } satisfies WidgetSpec
}</script>

<script setup lang="ts">
import { computed, inject, onUnmounted, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import type { WidgetManager } from '../overlay/interfaces'
import Widget from '../overlay/Widget.vue'
import { inOverlay } from '../desktop/panels'
import TradeCompanionBody from './TradeCompanionBody.vue'

const props = defineProps<{ config: TradeCompanionWidget }>()
// Only draw while the overlay is active (Shift+Space), never over the game while
// it has focus: an always-visible overlay crashed the game to desktop on
// a tester's PC (2026-11-12). Also fixes configs saved before this change.
// To keep it visible while playing, pin it to the HUD window instead.
if (!props.config.wmFlags.includes('invisible-on-blur')) {
  props.config.wmFlags = [...props.config.wmFlags, 'invisible-on-blur']
}
const wm = inject<WidgetManager>('wm')!
// pinned to the HUD, or set to not show in the overlay (Where panels show)
const inHud = computed(() => Boolean(AppConfig().pob?.hud?.trades) || !inOverlay('trades'))

function onIncoming () {
  if (props.config.wmWants === 'hide') wm.show(props.config.wmId)
}
// Pinned to the HUD window: hide this widget and drop it from the widget menu
watch(inHud, (pinned) => {
  wm.setFlag(props.config.wmId, 'menu::skip', pinned)
  if (pinned && props.config.wmWants === 'show') wm.hide(props.config.wmId)
}, { immediate: true })
// Hotkey (Ctrl+H / Ctrl+T by default). Pinned panels are toggled in the HUD window by main.
const hotkey = Host.onEvent('MAIN->CLIENT::widget-action', (e) => {
  if (e.target !== 'trade-companion' || inHud.value) return
  // from in game (overlay not active yet) it always opens; main focuses the overlay
  if (props.config.wmWants === 'hide' || !wm.active.value) {
    wm.show(props.config.wmId)
  } else {
    wm.hide(props.config.wmId)
  }
})
onUnmounted(() => { hotkey.abort() })
</script>
