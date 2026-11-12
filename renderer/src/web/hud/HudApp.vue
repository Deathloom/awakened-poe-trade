<template>
  <!-- Deathloom fork: "show while playing" HUD window, one per pinned panel
       (index.html?hud=guide / trades / gear). Read-only view of the settings;
       the overlay window owns and saves them. -->
  <!-- drag from the grip or any empty spot of the panel (not buttons, lists or inputs) -->
  <div ref="root" class="hud-root flex flex-col items-start select-none" :class="{ 'invisible': hiddenByAlt }"
    @pointerdown="dragStart" @pointerup="dragEnd">
    <div class="hud-grip self-stretch flex items-center justify-center gap-x-2 px-2 rounded-t bg-gray-900 text-gray-600 text-xs"
      title="Drag to move">
      <i class="fas fa-grip-lines" />
      <span>{{ playing ? '' : 'Drag to move' }}</span>
    </div>
    <CampaignGuideBody v-if="HUD_PANEL === 'guide'" />
    <TradeCompanionBody v-else-if="HUD_PANEL === 'trades'" compact @incoming="showTrades" @empty="hideTradesIfAuto" />
    <PobGearBody v-else-if="HUD_PANEL === 'gear'" :active="!hidden.gear" hud />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Host } from '@/web/background/IPC'
import { HUD_PANEL } from './is-hud'
import { AppConfig } from '@/web/Config'
import CampaignGuideBody from '../companion/CampaignGuideBody.vue'
import TradeCompanionBody from '../companion/TradeCompanionBody.vue'
import PobGearBody from '../pob/PobGearBody.vue'

document.documentElement.classList.add('hud')

const playing = ref(true)
const hidden = ref({ guide: true, trades: true, gear: true })
const hiddenByAlt = ref(false)
const listeners = [
  Host.onEvent('MAIN->CLIENT::hud-state', (e) => { playing.value = e.playing; hidden.value = e.hidden }),
  // same as the overlay: holding Alt hides it (to read ground labels)
  Host.onEvent('MAIN->OVERLAY::visibility', (e) => { hiddenByAlt.value = !e.isVisible })
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
    lastSize = { width, height }
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-size', payload: { panel: HUD_PANEL, width, height } })
  })
  observer.observe(root.value!)
})
onUnmounted(() => {
  observer?.disconnect()
  for (const l of listeners) l.abort()
})

// Main moves the window with the real cursor until the button is released
// (the page can't capture the mouse: the HUD is never the foreground window)
function sendDrag (phase: 'start' | 'end', e: PointerEvent) {
  Host.sendEvent({ name: 'CLIENT->MAIN::hud-drag', payload: { panel: HUD_PANEL, phase, screenX: e.screenX, screenY: e.screenY } })
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

// a trade whisper arrived: open the companion (it starts closed)
function showTrades () {
  if (hidden.value.trades) {
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-panel', payload: { panel: 'trades', visible: true } })
  }
}

// no open trades left: close it again if auto-hide is on (Ctrl+T still opens it)
function hideTradesIfAuto () {
  if (AppConfig().pob?.hud?.autoHideTrades && !hidden.value.trades) {
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-panel', payload: { panel: 'trades', visible: false } })
  }
}
</script>

<style>
html.hud, html.hud body, html.hud #app {
  background: transparent;
  height: auto;
  overflow: hidden;
}
html.hud #app {
  align-items: flex-start;
}
.hud-root {
  width: max-content;
}
.hud-grip {
  cursor: move;
  height: 1rem;
}
</style>
