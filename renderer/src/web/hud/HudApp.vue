<template>
  <!-- Deathloom fork: "show while playing" HUD. One window per pinned panel
       (index.html?hud=guide / trades / gear ...), or all pinned panels in one
       window the size of the game (?hud=all, Settings → Panels → "One window
       for all pinned panels"). Read-only view of the settings; the overlay
       window owns and saves them. -->
  <div v-if="IS_HUD_SHARED" class="hud-shared" :class="{ 'invisible': hiddenByAlt }">
    <template v-for="p of sharedPanels" :key="p">
      <!-- panels that work in the background (whispers, price alerts, session timer)
           stay loaded while closed; the others are only made while open -->
      <div v-if="!hidden[p] || KEEP_ALIVE.has(p)" v-show="!hidden[p]"
        class="absolute" :style="panelStyle(p)">
        <HudPanelView :panel="p" :playing="playing" :hidden="hidden" shared @size="sizes[p] = $event" />
      </div>
    </template>
  </div>
  <div v-else :class="{ 'invisible': hiddenByAlt }">
    <HudPanelView :panel="HUD_PANEL" :playing="playing" :hidden="hidden" />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import { HUD_PANEL, IS_HUD_SHARED } from './is-hud'
import { AppConfig } from '@/web/Config'
import HudPanelView from './HudPanelView.vue'
import { useLeagues } from '@/web/background/Leagues'
import { usePoeninja } from '@/web/background/Prices'
import type { HudPanel } from '@ipc/types'

document.documentElement.classList.add('hud')
if (IS_HUD_SHARED) document.documentElement.classList.add('hud-all')

const ALL: HudPanel[] = ['guide', 'trades', 'gear', 'tree', 'atlas', 'session', 'market', 'overview', 'cheats', 'money', 'board', 'search', 'progress']
// same list as main (HudWindow.ts KEEP_ALIVE)
const KEEP_ALIVE: ReadonlySet<HudPanel> = new Set<HudPanel>(['trades', 'market', 'session'])

const playing = ref(true)
const hidden = ref<Record<HudPanel, boolean>>({ guide: true, trades: true, gear: true, tree: true, atlas: true, session: true, market: true, overview: true, cheats: true, money: true, board: true, search: true, progress: true })
const hiddenByAlt = ref(false)

const sharedPanels = computed(() => ALL.filter(p => Boolean(AppConfig().pob?.hud?.[p])))
// market panels need leagues and poe.ninja prices (the overlay and window load them too)
let marketLoaded = false
watch(() => IS_HUD_SHARED ? sharedPanels.value : [HUD_PANEL], (panels) => {
  if (marketLoaded || !panels.some(p => p === 'market' || p === 'overview' || p === 'progress' || p === 'search')) return
  marketLoaded = true
  usePoeninja()
  useLeagues().load()
}, { immediate: true })

// shared window: live position while dragging, else the saved one
const livePos = reactive<Partial<Record<HudPanel, { x: number, y: number } | undefined>>>({})
const sizes = reactive<Partial<Record<HudPanel, { width: number, height: number }>>>({})
function panelStyle (p: HudPanel) {
  const hud = AppConfig().pob?.hud
  const pos = livePos[p] ?? hud?.pos?.[p] ?? { x: 10, y: 90 }
  const size = sizes[p] ?? { width: 0, height: 0 }
  // kept inside the window (= the game window), the same way main clamps it
  const x = Math.max(0, Math.min(window.innerWidth - size.width, Math.round(pos.x)))
  const y = Math.max(0, Math.min(window.innerHeight - size.height, Math.round(pos.y)))
  return {
    left: `${x}px`,
    top: `${y}px`,
    opacity: Math.max(30, Math.min(100, hud?.opacity || 100)) / 100
  }
}

const listeners = [
  Host.onEvent('MAIN->CLIENT::hud-state', (e) => { playing.value = e.playing; hidden.value = e.hidden }),
  Host.onEvent('MAIN->CLIENT::hud-pos', (e) => { livePos[e.panel] = { x: e.x, y: e.y } }),
  // saved position is back from the overlay: use it again
  Host.onEvent('MAIN->CLIENT::config-changed', () => {
    const saved = AppConfig().pob?.hud?.pos
    for (const p of ALL) {
      const live = livePos[p]
      if (live && saved?.[p] && saved[p].x === live.x && saved[p].y === live.y) livePos[p] = undefined
    }
  }),
  // same as the overlay: holding Alt hides it (to read ground labels)
  Host.onEvent('MAIN->OVERLAY::visibility', (e) => { hiddenByAlt.value = !e.isVisible })
]
onUnmounted(() => {
  for (const l of listeners) l.abort()
})
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
html.hud-all, html.hud-all body, html.hud-all #app {
  height: 100%;
}
.hud-shared {
  position: fixed;
  inset: 0;
  pointer-events: none;
}
.hud-shared > div {
  pointer-events: auto;
}
</style>
