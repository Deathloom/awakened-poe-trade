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
      <button v-if="view === 'overview'" class="ml-auto px-2 py-0.5 rounded text-xs"
        :class="editLayout ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'"
        title="Add, remove, move and resize the panels on the All tab" @click="editLayout = !editLayout">
        <i class="fas fa-th mr-1" />{{ editLayout ? 'Done' : 'Edit layout' }}</button>
      <span class="text-xs text-gray-500" :class="view === 'overview' ? 'ml-3' : 'ml-auto'" :title="playingHelp">{{ status }}</span>
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

    <!-- All: customisable (Edit layout in the top bar) -->
    <AllLayout v-if="view === 'overview'" :editing="editLayout" @done="editLayout = false" />
    <div v-else-if="view !== 'trade'" class="flex-1 min-h-0 p-2">
      <div class="h-full min-h-0">
        <PobGearBody v-if="view === 'build'" :active="true" desktop />
        <LevellingBody v-else-if="view === 'levelling'" />
        <div v-else-if="view === 'atlas'" class="h-full min-h-0 flex flex-col rounded bg-gray-800"><AtlasTreeMap /></div>
        <TradeCompanionBody v-else-if="view === 'trades'" fill />
        <!-- Market: watchlist | poe.ninja overview (drag the line to resize) -->
        <div v-else-if="view === 'market'" ref="marketEl" class="flex h-full min-h-0">
          <div class="min-w-0 min-h-0" :style="{ flex: `${market.sizes.value[0]} 1 0` }"><MarketHistoryBody :active="true" fill /></div>
          <SplitGutter dir="x" @drag="d => market.drag(0, d, marketEl?.clientWidth ?? 0)" @end="market.save" @reset="market.reset" />
          <div class="min-w-0 min-h-0" :style="{ flex: `${market.sizes.value[1]} 1 0` }"><MarketOverview /></div>
        </div>
        <DesktopSettings v-else-if="view === 'settings'" />
        <HelpBody v-else-if="view === 'help'" />
      </div>
    </div>
    <!-- Trade site: kept alive once opened (stays signed in and keeps its page) -->
    <div v-if="tradeOpened" v-show="view === 'trade'" class="flex-1 min-h-0 p-2">
      <TradeSiteBody />
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
import LevellingBody from './LevellingBody.vue'
import MarketOverview from '../market-history/MarketOverview.vue'
import SplitGutter from './SplitGutter.vue'
import { useSplit } from './split'
import TradeCompanionBody from '../companion/TradeCompanionBody.vue'
import MarketHistoryBody from '../market-history/MarketHistoryBody.vue'
import DesktopSettings from './DesktopSettings.vue'
import TradeSiteBody from './TradeSiteBody.vue'
import HelpBody from '../help/HelpBody.vue'
import { tradeTabRequest } from './trade-tab'
import AllLayout from './AllLayout.vue'
import AtlasTreeMap from '../atlas/AtlasTreeMap.vue'
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
  { key: 'atlas', label: 'Atlas', icon: 'fa-globe', title: 'Atlas tree: your atlas builds, what you have taken (from the game log), edit and share' },
  { key: 'trades', label: 'Trades', icon: 'fa-handshake', title: 'Trade whispers and ledger' },
  { key: 'market', label: 'Market', icon: 'fa-chart-line', title: 'Market history of watched items' },
  { key: 'trade', label: 'Trade site', icon: 'fa-store', title: "GGG's official trade site (sign in on GGG's own page; Loot Goblin never sees your login)" },
  { key: 'help', label: 'Help', icon: 'fa-question-circle', title: 'How to use it, where to get a build, FAQ' },
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
// a panel's hotkey asked for its tab (panel not shown in the overlay)
function viewFromHotkey (v: string) {
  if (VIEWS.some(x => x.key === v)) setView(v as View)
}
const askedView = new URLSearchParams(window.location.search).get('view')
if (askedView) viewFromHotkey(askedView)
Host.onEvent('MAIN->CLIENT::desktop-view', (e) => { viewFromHotkey(e.view) })
function setView (v: View) {
  view.value = v
  try { localStorage.setItem(VIEW_KEY, v) } catch {}
}
watch(view, (v) => {
  const label = VIEWS.find(x => x.key === v)?.label
  document.title = v === 'overview' ? 'Loot Goblin' : `Loot Goblin · ${label}`
}, { immediate: true })

// Trade site tab: mounted the first time it's shown, then kept
const tradeOpened = ref(view.value === 'trade' || tradeTabRequest.value > 0)
if (tradeTabRequest.value > 0) view.value = 'trade'
watch(view, (v) => { if (v === 'trade') tradeOpened.value = true })
watch(tradeTabRequest, () => { setView('trade') })

// in game or not (from the HUD state main sends to every window)
const playing = ref<boolean | null>(null)
Host.onEvent('MAIN->CLIENT::hud-state', (e) => { playing.value = e.playing })
// All tab: Edit layout mode (left when you switch tabs)
const editLayout = ref(false)
watch(view, (v) => { if (v !== 'overview') editLayout.value = false })
const marketEl = ref<HTMLElement>()
const market = useSplit('market', [0.5, 0.5])

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
