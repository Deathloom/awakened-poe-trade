<template>
  <!-- Deathloom fork: one pinned panel of the "show while playing" HUD. Alone in
       its own window (?hud=guide / trades / gear ...) or one of several in the
       shared window (?hud=all, idea 16 step 2). -->
  <!-- drag from the grip or any empty spot of the panel (not buttons, lists or inputs) -->
  <div ref="root" class="hud-root relative flex flex-col items-start select-none"
    :style="dimsStyle" @pointerdown="dragStart" @pointerup="dragEnd"
    @pointerenter="hover(true)" @pointerleave="hover(false)">
    <div class="hud-grip self-stretch flex items-center justify-center gap-x-2 px-2 rounded-t bg-gray-900 text-gray-600 text-xs"
      title="Drag to move">
      <i class="fas fa-grip-lines" />
      <span>{{ playing ? '' : 'Drag to move' }}</span>
    </div>
    <CampaignGuideBody v-if="panel === 'guide'" :tall="Boolean(dims)" />
    <TradeCompanionBody v-else-if="panel === 'trades'" compact @incoming="showTrades" @empty="hideTradesIfAuto" />
    <PobGearBody v-else-if="panel === 'gear'" :active="!hidden.gear" hud />
    <!-- panels added in 1.0.63 (tree map, atlas, session, market history, market overview) -->
    <div v-else-if="extra" class="flex flex-col p-1 rounded-b bg-gray-900"
      :style="{ width: `var(--hud-w, ${extra.w})`, height: `var(--hud-h, ${extra.h})` }">
      <div class="flex-1 min-h-0 flex flex-col rounded" :class="{ 'bg-gray-800': extra.boxed }">
        <component :is="extra.body" v-if="!hidden[panel]" v-bind="extra.props" />
      </div>
    </div>
    <!-- resize by the bottom-right corner -->
    <div class="hud-resize" data-no-drag title="Drag to resize (Settings: Reset positions and sizes)"
      @pointerdown.stop="resizeStart" @pointerup.stop="resizeEnd" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import CampaignGuideBody from '../companion/CampaignGuideBody.vue'
import TradeCompanionBody from '../companion/TradeCompanionBody.vue'
import PobGearBody from '../pob/PobGearBody.vue'
import { PANEL_BODY_BY_PANEL } from '../overlay/panel-widgets'
import type { HudPanel } from '@ipc/types'

const props = defineProps<{
  panel: HudPanel
  playing: boolean
  hidden: Record<HudPanel, boolean>
  // in the shared window: tell main when the pointer is over this panel
  shared?: boolean
}>()
const emit = defineEmits<{ size: [{ width: number, height: number }] }>()

const extra = PANEL_BODY_BY_PANEL[props.panel]
// size set by dragging the corner: from settings, live while resizing
const liveDims = ref<{ w: number, h: number } | null>(null)
let resizing = false
const dims = computed(() => liveDims.value ?? AppConfig().pob?.hud?.dims?.[props.panel] ?? null)
// never bigger than the screen, so the resize corner can't end up off-screen
// (older saved sizes could be; main also clamps new resizes to the game window)
const dimsStyle = computed(() => dims.value
  ? {
      '--hud-w': `${Math.min(dims.value.w, Math.max(200, window.screen.availWidth - 40))}px`,
      '--hud-h': `${Math.min(dims.value.h, Math.max(80, window.screen.availHeight - 40))}px`
    }
  : {})

const listeners = [
  Host.onEvent('MAIN->CLIENT::hud-dims', (e) => {
    if (e.panel !== props.panel) return
    // kept after the resize until the saved setting comes back from the overlay
    liveDims.value = { w: e.w, h: e.h }
    resizing = !e.done
  }),
  Host.onEvent('MAIN->CLIENT::config-changed', () => { if (!resizing) liveDims.value = null })
]

const root = ref<HTMLElement>()
let observer: ResizeObserver | undefined
let lastSize = { width: 0, height: 0 }
onMounted(() => {
  observer = new ResizeObserver(() => {
    const el = root.value
    if (!el) return
    // the root is max-content wide, so its size is the panel's size (not the window's)
    const width = Math.ceil(el.scrollWidth)
    const height = Math.ceil(el.scrollHeight)
    if (width === lastSize.width && height === lastSize.height) return
    if (width === 0 && height === 0) return
    lastSize = { width, height }
    emit('size', lastSize)
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-size', payload: { panel: props.panel, width, height } })
  })
  observer.observe(root.value!)
})
onUnmounted(() => {
  observer?.disconnect()
  for (const l of listeners) l.abort()
  if (isOver) hover(false)
})

let isOver = false
function hover (on: boolean) {
  if (!props.shared) return
  isOver = on
  Host.sendEvent({ name: 'CLIENT->MAIN::hud-hover', payload: { panel: on ? props.panel : null } })
}

// Main moves the panel with the real cursor until the button is released
// (the page can't capture the mouse: the HUD is never the foreground window)
function sendDrag (phase: 'start' | 'end', e: PointerEvent) {
  Host.sendEvent({ name: 'CLIENT->MAIN::hud-drag', payload: { panel: props.panel, phase, screenX: e.screenX, screenY: e.screenY } })
}
const NO_DRAG = 'button, a, input, select, textarea, option, label, [data-no-drag]'
function dragStart (e: PointerEvent) {
  if (e.button !== 0) return
  const target = e.target as HTMLElement | null
  if (target?.closest(NO_DRAG)) return
  sendDrag('start', e)
}
function dragEnd (e: PointerEvent) {
  sendDrag('end', e)
}

function resizeStart (e: PointerEvent) {
  if (e.button !== 0) return
  // the first child after the grip is the panel; start from its current size
  const panel = root.value?.children[1] as HTMLElement | undefined
  const r = panel?.getBoundingClientRect()
  Host.sendEvent({ name: 'CLIENT->MAIN::hud-resize', payload: { panel: props.panel, phase: 'start', w: r?.width ?? 300, h: r?.height ?? 200 } })
}
function resizeEnd () {
  Host.sendEvent({ name: 'CLIENT->MAIN::hud-resize', payload: { panel: props.panel, phase: 'end', w: 0, h: 0 } })
}

// a trade whisper arrived: open the companion (it starts closed)
function showTrades () {
  if (props.hidden.trades) {
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-panel', payload: { panel: 'trades', visible: true } })
  }
}

// no open trades left: close it again if auto-hide is on (its hotkey still opens it)
function hideTradesIfAuto () {
  if (AppConfig().pob?.hud?.autoHideTrades && !props.hidden.trades) {
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-panel', payload: { panel: 'trades', visible: false } })
  }
}
</script>

<style>
.hud-root {
  width: max-content;
}
.hud-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  border-right: 3px solid rgba(156, 163, 175, 0.6);
  border-bottom: 3px solid rgba(156, 163, 175, 0.6);
  border-bottom-right-radius: 3px;
}
.hud-grip {
  cursor: move;
  height: 1rem;
}
</style>
