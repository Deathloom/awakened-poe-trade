<template>
  <!-- Deathloom fork: desktop window (index.html?desktop). All panels in one
       normal window for a second screen; live with the game like the overlay. -->
  <div class="desktop-root flex flex-col h-full text-gray-200 bg-gray-900">
    <div class="flex items-center gap-x-1 px-2 py-1 bg-gray-800 border-b border-gray-700 shrink-0">
      <span class="text-gray-400 mr-3"><i class="fas fa-coins mr-1 text-yellow-500" />Loot Goblin</span>
      <button v-for="v of VIEWS" :key="v.key" class="px-3 py-0.5 rounded"
        :class="view === v.key ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'"
        :title="v.title" @click="setView(v.key)">
        <i class="fas mr-1" :class="v.icon" />{{ v.label }}</button>
      <span class="ml-auto text-xs text-gray-500" :title="playingHelp">{{ status }}</span>
    </div>

    <div v-if="view === 'overview'" class="desktop-grid flex-1 min-h-0 p-2">
      <div class="area-build min-h-0"><PobGearBody :active="true" desktop /></div>
      <div class="area-guide min-h-0"><CampaignGuideBody tall /></div>
      <div class="area-trades min-h-0"><TradeCompanionBody fill /></div>
      <div class="area-market min-h-0"><MarketHistoryBody :active="true" fill /></div>
    </div>
    <div v-else class="flex-1 min-h-0 p-2">
      <div class="h-full min-h-0" :class="view === 'guide' ? 'single-guide' : ''">
        <PobGearBody v-if="view === 'build'" :active="true" desktop />
        <CampaignGuideBody v-else-if="view === 'guide'" tall />
        <TradeCompanionBody v-else-if="view === 'trades'" fill />
        <MarketHistoryBody v-else-if="view === 'market'" :active="true" fill />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import PobGearBody from '../pob/PobGearBody.vue'
import CampaignGuideBody from '../companion/CampaignGuideBody.vue'
import TradeCompanionBody from '../companion/TradeCompanionBody.vue'
import MarketHistoryBody from '../market-history/MarketHistoryBody.vue'
import { useLeagues } from '@/web/background/Leagues'
import { usePoeninja } from '@/web/background/Prices'

document.documentElement.classList.add('desktop')
// leagues and poe.ninja prices, like the overlay loads them (market history)
usePoeninja()
useLeagues().load()

const VIEWS = [
  { key: 'overview', label: 'All', icon: 'fa-th-large', title: 'Everything at once' },
  { key: 'build', label: 'Build', icon: 'fa-hammer', title: 'Gear, gems and tree of the active build' },
  { key: 'guide', label: 'Guide', icon: 'fa-route', title: 'Campaign guide' },
  { key: 'trades', label: 'Trades', icon: 'fa-handshake', title: 'Trade whispers and ledger' },
  { key: 'market', label: 'Market', icon: 'fa-chart-line', title: 'Market history of watched items' }
] as const
type View = typeof VIEWS[number]['key']

const VIEW_KEY = 'deathloom.desktop-view.v1'
function loadView (): View {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return VIEWS.some(x => x.key === v) ? v as View : 'overview'
  } catch { return 'overview' }
}
const view = ref<View>(loadView())
function setView (v: View) {
  view.value = v
  try { localStorage.setItem(VIEW_KEY, v) } catch {}
}
watch(view, (v) => {
  const label = VIEWS.find(x => x.key === v)?.label
  document.title = v === 'overview' ? 'Loot Goblin' : `Loot Goblin · ${label}`
}, { immediate: true })

// in game or not (from the HUD state main sends to every window)
const playing = ref<boolean | null>(null)
Host.onEvent('MAIN->CLIENT::hud-state', (e) => { playing.value = e.playing })
const status = computed(() => playing.value == null ? '' : playing.value ? 'In game' : 'Not playing')
const playingHelp = 'Panels update live from the game (Client.txt). Clicking here takes focus away from the game. Not affiliated with or endorsed by Grinding Gear Games.'
</script>

<style>
html.desktop, html.desktop body {
  background: #111827;
}
html.desktop #app {
  justify-content: flex-start;
}
.desktop-grid {
  display: grid;
  gap: 0.5rem;
  grid-template-columns: minmax(26rem, 1.3fr) minmax(20rem, 1fr) minmax(22rem, 1fr);
  grid-template-rows: 1fr 1fr;
  grid-template-areas:
    "build guide market"
    "build trades market";
}
@media (max-width: 1250px) {
  .desktop-grid {
    grid-template-columns: minmax(24rem, 1.2fr) minmax(20rem, 1fr);
    grid-template-rows: 1fr 1fr 1fr;
    grid-template-areas:
      "build guide"
      "build trades"
      "build market";
    overflow-y: auto;
  }
}
.area-build { grid-area: build; }
.area-guide { grid-area: guide; --hud-w: 100%; --hud-h: 100%; }
.area-trades { grid-area: trades; }
.area-market { grid-area: market; }
.single-guide { --hud-w: 100%; --hud-h: 100%; }
.desktop-root .widget-default-style {
  max-height: none;
}
</style>
