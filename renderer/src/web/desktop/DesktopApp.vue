<template>
  <!-- Deathloom fork: desktop window (index.html?desktop). All panels in one
       normal window for a second screen; live with the game like the overlay. -->
  <div class="desktop-root relative flex flex-col h-full text-gray-200 bg-gray-900">
    <div class="flex items-center gap-x-1 px-2 py-1 bg-gray-800 border-b border-gray-700 shrink-0">
      <span class="text-gray-400 mr-3"><i class="fas fa-coins mr-1 text-yellow-500" />Loot Goblin</span>
      <button v-for="v of VIEWS" :key="v.key" class="px-3 py-0.5 rounded"
        :class="view === v.key ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'"
        :title="v.title" @click="setView(v.key)">
        <i class="fas mr-1" :class="v.icon" />{{ v.label }}</button>
      <span class="ml-auto text-xs text-gray-500" :title="playingHelp">{{ status }}</span>
    </div>

    <!-- an update is downloaded: install from here (it also installs by itself once the game is closed) -->
    <div v-if="readyVersion && dismissed !== readyVersion"
      class="flex items-center gap-x-3 px-3 py-1 bg-green-900 border-b border-green-700 text-sm shrink-0">
      <i class="fas fa-download text-green-300" />
      <span class="text-green-100">Loot Goblin <b>{{ readyVersion }}</b> is downloaded and ready to install.</span>
      <span class="text-xs text-green-300">{{ playing ? 'Installing restarts Loot Goblin (the game keeps running).' : 'Takes a few seconds; Loot Goblin starts again by itself.' }}</span>
      <button class="ml-auto px-3 rounded bg-green-600 hover:bg-green-500 text-white" @click="installUpdate">Install now</button>
      <button class="text-green-300 hover:text-white" title="Later (installs by itself when the game isn't running)" @click="dismissed = readyVersion">Later</button>
    </div>

    <!-- All: three columns and the right column's rows can be resized (drag the lines) -->
    <div v-if="view === 'overview'" ref="colsEl" class="flex flex-1 min-h-0 p-2">
      <div class="min-w-0 min-h-0" :style="{ flex: `${cols.sizes.value[0]} 1 0` }"><PobGearBody :active="true" desktop /></div>
      <SplitGutter dir="x" @drag="d => cols.drag(0, d, colsEl?.clientWidth ?? 0)" @end="cols.save" @reset="cols.reset" />
      <div class="min-w-0 min-h-0" :style="{ flex: `${cols.sizes.value[1]} 1 0` }"><LevellingBody /></div>
      <SplitGutter dir="x" @drag="d => cols.drag(1, d, colsEl?.clientWidth ?? 0)" @end="cols.save" @reset="cols.reset" />
      <div ref="rowsEl" class="min-w-0 min-h-0 flex flex-col" :style="{ flex: `${cols.sizes.value[2]} 1 0` }">
        <div class="min-h-0 flex flex-col rounded bg-gray-800" :style="{ flex: `${rows.sizes.value[0]} 1 0` }"><PobTreeMap levelling compact /></div>
        <SplitGutter dir="y" @drag="d => rows.drag(0, d, rowsEl?.clientHeight ?? 0)" @end="rows.save" @reset="rows.reset" />
        <div class="min-h-0" :style="{ flex: `${rows.sizes.value[1]} 1 0` }"><TradeCompanionBody fill /></div>
        <SplitGutter dir="y" @drag="d => rows.drag(1, d, rowsEl?.clientHeight ?? 0)" @end="rows.save" @reset="rows.reset" />
        <div class="min-h-0" :style="{ flex: `${rows.sizes.value[2]} 1 0` }"><MarketHistoryBody :active="true" fill /></div>
      </div>
    </div>
    <div v-else class="flex-1 min-h-0 p-2">
      <div class="h-full min-h-0">
        <PobGearBody v-if="view === 'build'" :active="true" desktop />
        <LevellingBody v-else-if="view === 'levelling'" />
        <TradeCompanionBody v-else-if="view === 'trades'" fill />
        <MarketHistoryBody v-else-if="view === 'market'" :active="true" fill />
        <DesktopSettings v-else-if="view === 'settings'" />
      </div>
    </div>
    <!-- first-run setup (opens by itself on a new install) -->
    <WidgetSetupGuide desktop />
    <!-- after an update (not while the setup guide is open) -->
    <WhatsNew :active="!desktopSetupShown" />
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { loadSession, SESSION_KEY } from '../companion/char-level'
import { Host } from '@/web/background/IPC'
import PobGearBody from '../pob/PobGearBody.vue'
import PobTreeMap from '../pob/PobTreeMap.vue'
import LevellingBody from './LevellingBody.vue'
import SplitGutter from './SplitGutter.vue'
import { useSplit } from './split'
import TradeCompanionBody from '../companion/TradeCompanionBody.vue'
import MarketHistoryBody from '../market-history/MarketHistoryBody.vue'
import DesktopSettings from './DesktopSettings.vue'
import WidgetSetupGuide from '../setup/WidgetSetupGuide.vue'
import WhatsNew from '../whats-new/WhatsNew.vue'
import { desktopSetupShown } from '../setup/setup-state'
import { useLeagues } from '@/web/background/Leagues'
import { usePoeninja } from '@/web/background/Prices'

document.documentElement.classList.add('desktop')
// leagues and poe.ninja prices, like the overlay loads them (market history)
usePoeninja()
useLeagues().load()

const VIEWS = [
  { key: 'overview', label: 'All', icon: 'fa-th-large', title: 'Everything at once' },
  { key: 'build', label: 'Build', icon: 'fa-hammer', title: 'Gear, gems and tree of the active build' },
  { key: 'levelling', label: 'Levelling', icon: 'fa-route', title: 'Campaign guide, quest gems, gem swaps and the next passives' },
  { key: 'trades', label: 'Trades', icon: 'fa-handshake', title: 'Trade whispers and ledger' },
  { key: 'market', label: 'Market', icon: 'fa-chart-line', title: 'Market history of watched items' },
  { key: 'settings', label: 'Settings', icon: 'fa-cog', title: 'All Loot Goblin settings (same as Shift+Space → Settings)' }
] as const
type View = typeof VIEWS[number]['key']

const VIEW_KEY = 'deathloom.desktop-view.v1'
function loadView (): View {
  try {
    let v = localStorage.getItem(VIEW_KEY)
    if (v === 'guide' || v === 'next') v = 'levelling' // before 1.0.30
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
// All tab layout (fractions, saved)
const colsEl = ref<HTMLElement>()
const rowsEl = ref<HTMLElement>()
const cols = useSplit('all-cols', [0.34, 0.36, 0.3])
const rows = useSplit('all-right', [0.45, 0.3, 0.25])

// downloaded update ready to install (main broadcasts the updater state)
const readyVersion = computed(() => Host.updateInfo.value.state === 'update-downloaded' ? Host.updateInfo.value.version : null)
const dismissed = ref<string | null>(null)
function installUpdate () {
  Host.sendEvent({ name: 'CLIENT->MAIN::user-action', payload: { action: 'update-and-restart' } })
}

// AFK from the game log (": AFK mode is now ON")
const session = ref(loadSession())
const onSession = (e: StorageEvent) => { if (e.key === SESSION_KEY) session.value = loadSession() }
window.addEventListener('storage', onSession)
onUnmounted(() => { window.removeEventListener('storage', onSession) })
const status = computed(() => playing.value == null ? '' : playing.value ? (session.value.afk ? 'In game · AFK' : 'In game') : 'Not playing')
const playingHelp = 'Panels update live from the game (Client.txt). Clicking here takes focus away from the game. Not affiliated with or endorsed by Grinding Gear Games.'
</script>

<style>
html.desktop, html.desktop body {
  background: #111827;
}
html.desktop #app {
  justify-content: flex-start;
}
.desktop-root .widget-default-style {
  max-height: none;
}
</style>
