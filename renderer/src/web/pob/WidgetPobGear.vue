<template>
  <!-- Deathloom fork: the active PoB build's gear, with Copy / Trade / Check per item -->
  <Widget :config="config" move-handles="tl" :removable="false" :inline-edit="false">
    <PobGearBody v-if="!inHud" :active="config.wmWants === 'show' && wm.active.value" />
  </Widget>
</template>

<script lang="ts">
import type { WidgetSpec } from '../overlay/interfaces'
import type { PobGearWidget } from './widget'

export default {
  widget: {
    type: 'pob-gear',
    instances: 'single',
    initInstance: (): PobGearWidget => {
      return {
        wmId: 0,
        wmType: 'pob-gear',
        wmTitle: '{icon=fa-hammer}',
        wmWants: 'hide',
        wmZorder: null,
        wmFlags: ['invisible-on-blur'],
        anchor: {
          pos: 'tl',
          x: 35,
          y: 10
        }
      }
    }
  } satisfies WidgetSpec
}
</script>

<script setup lang="ts">
import { computed, inject, onUnmounted, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import type { WidgetManager } from '../overlay/interfaces'
import Widget from '../overlay/Widget.vue'
import PobGearBody from './PobGearBody.vue'

const props = defineProps<{
  config: PobGearWidget
}>()

const wm = inject<WidgetManager>('wm')!
const inHud = computed(() => Boolean(AppConfig().pob?.hud?.gear))

// Pinned to the HUD window: hide this widget and drop it from the widget menu
watch(inHud, (pinned) => {
  wm.setFlag(props.config.wmId, 'menu::skip', pinned)
  if (pinned && props.config.wmWants === 'show') wm.hide(props.config.wmId)
}, { immediate: true })

// Hotkey (Ctrl+G by default). When pinned, main toggles it in the HUD window instead.
const hotkey = Host.onEvent('MAIN->CLIENT::widget-action', (e) => {
  if (e.target !== 'pob-gear' || inHud.value) return
  // From in game (overlay not active yet) the hotkey always opens the panel;
  // main focuses the overlay at the same time
  if (props.config.wmWants === 'hide' || !wm.active.value) {
    wm.show(props.config.wmId)
  } else {
    wm.hide(props.config.wmId)
  }
})
onUnmounted(() => { hotkey.abort() })
</script>
