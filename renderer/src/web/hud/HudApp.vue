<template>
  <!-- Deathloom fork: "show while playing" HUD window (index.html?hud). Read-only
       view of the settings; the overlay window owns and saves them. -->
  <div ref="root" class="hud-root flex flex-col gap-y-1 items-start" :class="{ 'invisible': hiddenByAlt }">
    <div class="hud-grip flex items-center gap-x-2 px-2 rounded-t bg-gray-900 text-gray-600 text-xs select-none"
      title="Drag to move" @pointerdown="dragStart" @pointermove="dragMove" @pointerup="dragEnd" @pointercancel="dragEnd">
      <i class="fas fa-grip-lines" />
      <span v-if="!playing">Drag to move · pinned over the game</span>
    </div>
    <CampaignGuideBody v-if="hud.guide" />
    <TradeCompanionBody v-if="hud.trades" compact />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig, defaultHudConfig } from '@/web/Config'
import CampaignGuideBody from '../companion/CampaignGuideBody.vue'
import TradeCompanionBody from '../companion/TradeCompanionBody.vue'

document.documentElement.classList.add('hud')
const hud = computed(() => AppConfig().pob?.hud ?? defaultHudConfig())

const playing = ref(true)
const hiddenByAlt = ref(false)
const listeners = [
  Host.onEvent('MAIN->CLIENT::hud-state', (e) => { playing.value = e.playing }),
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
    // the root is max-content wide, so its size is the panels' size (not the window's)
    const width = Math.ceil(el.scrollWidth)
    const height = Math.ceil(el.scrollHeight)
    if (width === lastSize.width && height === lastSize.height) return
    lastSize = { width, height }
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-size', payload: { width, height } })
  })
  observer.observe(root.value!)
})
onUnmounted(() => {
  observer?.disconnect()
  for (const l of listeners) l.abort()
})

let dragging = false
function sendDrag (phase: 'start' | 'move' | 'end', e: PointerEvent) {
  Host.sendEvent({ name: 'CLIENT->MAIN::hud-drag', payload: { phase, screenX: e.screenX, screenY: e.screenY } })
}
function dragStart (e: PointerEvent) {
  if (e.button !== 0) return
  dragging = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  sendDrag('start', e)
}
let lastMove = 0
function dragMove (e: PointerEvent) {
  if (!dragging) return
  const now = performance.now()
  if (now - lastMove < 16) return
  lastMove = now
  sendDrag('move', e)
}
function dragEnd (e: PointerEvent) {
  if (!dragging) return
  dragging = false
  sendDrag('end', e)
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
