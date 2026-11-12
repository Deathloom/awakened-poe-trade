<template>
  <!-- Deathloom fork: trade companion (incoming/outgoing trade whispers from Client.txt) + sales ledger -->
  <Widget :config="config" move-handles="tl" :removable="false" :inline-edit="false">
    <div v-if="inHud" class="widget-default-style text-gray-400 text-sm p-2" style="width: 24rem;">
      <i class="fas fa-handshake mr-1" />The trade companion is pinned over the game
      (Settings → Path of Building → Show while playing).
    </div>
    <TradeCompanionBody v-else @incoming="onIncoming" />
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
}
</script>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { AppConfig } from '@/web/Config'
import type { WidgetManager } from '../overlay/interfaces'
import Widget from '../overlay/Widget.vue'
import TradeCompanionBody from './TradeCompanionBody.vue'

const props = defineProps<{ config: TradeCompanionWidget }>()
// Only draw while the overlay is active (Shift+Space), never over the game while
// it has focus: an always-visible overlay crashed the game to desktop on
// Gerhard's PC (2026-11-12). Also fixes configs saved before this change.
// To keep it visible while playing, pin it to the HUD window instead.
if (!props.config.wmFlags.includes('invisible-on-blur')) {
  props.config.wmFlags = [...props.config.wmFlags, 'invisible-on-blur']
}
const wm = inject<WidgetManager>('wm')!
const inHud = computed(() => Boolean(AppConfig().pob?.hud?.trades))

function onIncoming () {
  if (props.config.wmWants === 'hide') wm.show(props.config.wmId)
}
</script>
