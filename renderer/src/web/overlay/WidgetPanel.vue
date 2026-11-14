<template>
  <!-- Deathloom fork: overlay widget for a panel that used to be only in the
       Loot Goblin window (tree map, atlas tree, this session, market overview).
       Same body as the window; one widget type per panel (panel-widgets.ts). -->
  <Widget :config="config" move-handles="tl" :removable="false" :inline-edit="false">
    <div v-if="!inHud" class="widget-default-style p-1 flex flex-col" :style="{ width: def.w, height: def.h, maxHeight: '85vh' }">
      <div class="flex items-center gap-x-2 px-1 pb-1 text-xs text-gray-400 shrink-0">
        <i class="fas" :class="def.icon" /><span>{{ def.label }}</span>
      </div>
      <div class="flex-1 min-h-0 flex flex-col rounded" :class="{ 'bg-gray-800': def.boxed }">
        <component :is="def.body" v-bind="def.props" />
      </div>
    </div>
  </Widget>
</template>

<script setup lang="ts">
import { computed, inject, onUnmounted, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import type { HudPanel } from '@ipc/types'
import type { WidgetManager } from './interfaces'
import type { Widget as WidgetT, Anchor } from './widgets'
import Widget from './Widget.vue'
import { inOverlay } from '../desktop/panels'
import { PANEL_BODIES } from './panel-widgets'

const props = defineProps<{ config: WidgetT & { anchor: Anchor } }>()
const def = computed(() => PANEL_BODIES[props.config.wmType])
const panel = computed(() => def.value.panel as HudPanel)
const wm = inject<WidgetManager>('wm')!
// pinned in game (HUD window), or set to not show in the overlay (Where panels show)
const inHud = computed(() => Boolean(AppConfig().pob?.hud?.[panel.value]) || !inOverlay(panel.value))
watch(inHud, (off) => {
  wm.setFlag(props.config.wmId, 'menu::skip', off)
  if (off && props.config.wmWants === 'show') wm.hide(props.config.wmId)
}, { immediate: true })
// hotkey (Settings → Path of Building → Where panels show); pinned ones toggle in the HUD window (main)
const hotkey = Host.onEvent('MAIN->CLIENT::widget-action', (e) => {
  if (e.target !== `panel:${panel.value}` || inHud.value) return
  if (props.config.wmWants === 'hide' || !wm.active.value) wm.show(props.config.wmId)
  else wm.hide(props.config.wmId)
})
onUnmounted(() => { hotkey.abort() })
</script>
