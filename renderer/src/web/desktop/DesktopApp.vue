<template>
  <!-- Deathloom fork: desktop window (index.html?desktop). All panels in one
       normal window for a second screen; live with the game like the overlay. -->
  <div class="desktop-root relative flex flex-col h-full text-gray-200">
    <div class="desktop-topbar flex items-center gap-x-1 px-2 py-1 bg-gray-800 border-b border-gray-700 shrink-0 whitespace-nowrap overflow-x-auto">
      <span class="text-gray-300 mr-3 flex items-center shrink-0 font-semibold"><img src="/images/orbhoarder.svg" class="w-6 h-6 mr-1.5 lg-logo" alt="" /><span class="hidden 2xl:inline">Orbhoarder</span><span v-if="IS_DESKTOP2" class="text-gray-500" title="Second window: its own tabs, layout and look"> 2</span></span>
      <button v-for="v of VIEWS" :key="v.key" class="shrink-0 px-2 py-1 rounded-md text-sm"
        :class="view === v.key ? 'bg-blue-600/25 text-blue-100 lg-tab-active' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'"
        :title="v.title" :data-tour="v.key" @click="setView(v.key)">
        <i class="fas xl:mr-1.5" :class="v.icon" /><span class="hidden xl:inline">{{ v.label }}</span></button>
      <select v-if="view === 'overview'" class="shrink-0 ml-auto rounded-md bg-transparent text-xs text-gray-400 hover:text-gray-100 px-1 py-1"
        title="Which All tab layout shows. Auto: Mapping from your first atlas map, Levelling again when a new character starts (The Twilight Strand). Each layout is edited on its own."
        :value="layoutPref" @change="setLayoutPref(($event.target as HTMLSelectElement).value as LayoutPref)">
        <option value="auto">Auto ({{ layoutMode() === 'mapping' ? 'Mapping' : 'Levelling' }})</option>
        <option value="levelling">Levelling layout</option>
        <option value="mapping">Mapping layout</option>
      </select>
      <button v-if="view === 'overview'" class="shrink-0 ml-1 px-2 py-1 rounded-md text-xs"
        :class="editLayout ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'"
        title="Add, remove, move and resize the panels on the All tab" @click="editLayout = !editLayout">
        <i class="fas fa-th mr-1" />{{ editLayout ? 'Done' : 'Edit layout' }}</button>
      <span class="shrink-0 text-xs text-gray-500" :class="view === 'overview' ? 'ml-3' : 'ml-auto'" :title="playingHelp">{{ status }}</span>
      <button class="shrink-0 ml-3 px-2 py-1 rounded-md text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-700"
        title="Report a bug or suggest a feature" data-tour="feedback" @click="feedback = 'bug'">
        <i class="fas fa-bug mr-1" />Bug<span class="text-gray-600 mx-1">/</span><i class="fas fa-lightbulb mr-1" />Idea</button>
    </div>

    <!-- an update is downloaded: install from here (it also installs by itself once the game is closed) -->
    <div v-if="readyVersion && dismissed !== readyVersion"
      class="flex items-center gap-x-3 px-3 py-1 bg-green-900 border-b border-green-700 text-sm shrink-0">
      <i class="fas fa-download text-green-300" />
      <span class="text-green-100">Orbhoarder <b>{{ readyVersion }}</b> is downloaded and ready to install.</span>
      <span class="text-xs text-green-300">{{ playing ? 'Installing restarts Orbhoarder (the game keeps running).' : 'Takes a few seconds; Orbhoarder starts again by itself.' }}</span>
      <button class="ml-auto px-3 rounded bg-green-600 hover:bg-green-500 text-white" @click="installUpdate">Install now</button>
      <button class="text-green-300 hover:text-white" title="Later (installs by itself when the game isn't running)" @click="dismissed = readyVersion">Later</button>
    </div>

    <!-- Deathloom fork (Q6): price alerts that fired (also on a phone opened with the QR link) -->
    <PriceAlertBanner />

    <!-- All: customisable (Edit layout in the top bar) -->
    <AllLayout v-if="view === 'overview'" class="lg-view" :editing="editLayout" @done="editLayout = false" />
    <div v-else-if="view !== 'trade' && view !== 'lab'" class="flex-1 min-h-0 p-2">
      <div :key="view" class="h-full min-h-0 lg-view">
        <PobGearBody v-if="view === 'build'" :active="true" desktop />
        <LevellingBody v-else-if="view === 'levelling'" />
        <div v-else-if="view === 'atlas'" class="h-full min-h-0 flex flex-col rounded bg-gray-800"><AtlasTreeMap /></div>
        <FriendsBody v-else-if="view === 'friends'" />
        <!-- Market: watchlist | poe.ninja overview (drag the line to resize) -->
        <div v-else-if="view === 'market'" ref="marketEl" class="flex h-full min-h-0">
          <div class="min-w-0 min-h-0" :style="{ flex: `${market.sizes.value[0]} 1 0` }"><MarketHistoryBody :active="true" fill :tabs="false" /></div>
          <SplitGutter dir="x" @drag="d => market.drag(0, d, marketEl?.clientWidth ?? 0)" @end="market.save" @reset="market.reset" />
          <div class="min-w-0 min-h-0" :style="{ flex: `${market.sizes.value[1]} 1 0` }"><MarketOverview /></div>
        </div>
        <CraftBody v-else-if="view === 'craft'" />
        <MoneyToolsBody v-else-if="view === 'profit'" />
        <DesktopSettings v-else-if="view === 'settings'" />
        <ReferenceBody v-else-if="view === 'reference'" />
      </div>
    </div>
    <!-- Trade (whispers, search, trade site): kept alive once opened, so the trade
         site stays signed in and keeps its page -->
    <div v-if="tradeOpened" v-show="view === 'trade'" class="flex-1 min-h-0 p-2">
      <TradeBody />
    </div>
    <!-- Lab: poelab.com, kept alive once opened like the Trade site -->
    <div v-if="labOpened" v-show="view === 'lab'" class="flex-1 min-h-0 p-2">
      <LabSiteBody />
    </div>
    <!-- first-run setup (opens by itself on a new install) -->
    <WidgetSetupGuide v-if="!IS_DESKTOP2" desktop />
    <!-- after an update (not while the setup guide is open) -->
    <WhatsNew v-if="!IS_DESKTOP2" :active="!desktopSetupShown" />
    <!-- Deathloom fork (Q27): first-run tour (own chunk, loaded when it opens) -->
    <OnboardingTour v-if="tourOpen && !IS_DESKTOP2" @view="viewFromHotkey" />
    <FeedbackDialog v-if="feedback" :initial="feedback" @close="feedback = null" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onUnmounted, ref, watch } from 'vue'
import { loadSession, SESSION_KEY } from '../companion/char-level'
import { Host } from '@/web/background/IPC'
import {
  LazyPobGearBody as PobGearBody,
  LazyLevellingBody as LevellingBody,
  LazyMarketOverview as MarketOverview,
  LazyMarketHistoryBody as MarketHistoryBody,
  LazyCraftBody as CraftBody,
  LazyMoneyToolsBody as MoneyToolsBody
} from '../ui/LazyBodies'
import SplitGutter from './SplitGutter.vue'
import { useSplit } from './split'
import DesktopSettings from './DesktopSettings.vue'
import FeedbackDialog from './FeedbackDialog.vue'
import TradeBody from './TradeBody.vue'
import LabSiteBody from './LabSiteBody.vue'
import { tradeTabRequest } from './trade-tab'
import { IS_DESKTOP2, readWindowKey, windowKey } from '@/web/hud/is-hud'
import AllLayout from './AllLayout.vue'
import ReferenceBody from './ReferenceBody.vue'
import { hasSavedSub, resolveView, setSub } from './view-route'
import { layoutPref, layoutMode, setLayoutPref, useLayoutPhase } from './all-layout'
import type { LayoutPref } from './layout-phase'
import AtlasTreeMap from '../atlas/LazyAtlasTreeMap'
import PriceAlertBanner from '../market-history/PriceAlertBanner.vue'

// Deathloom fork: moving backgrounds pause while you play (the window is drawn without
// the GPU, so a constantly moving background under glass panels costs CPU the game wants)
const gameListener = Host.onEvent('MAIN->CLIENT::hud-state', (e) => {
  document.documentElement.classList.toggle('lg-game-active', e.playing)
})
onUnmounted(() => { gameListener.abort() })
import WidgetSetupGuide from '../setup/WidgetSetupGuide.vue'
import WhatsNew from '../whats-new/WhatsNew.vue'
import { desktopSetupShown } from '../setup/setup-state'
import { AppConfig } from '@/web/Config'
import { autoTourWanted, tourOpen } from '../onboarding/tour-state'
const OnboardingTour = defineAsyncComponent(() => import('../onboarding/OnboardingTour.vue'))
// Friends tab brings Build sharing (GitHub sync): loaded when the tab opens
const FriendsBody = defineAsyncComponent(() => import('./FriendsBody.vue'))
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
  { key: 'atlas', label: 'Atlas', icon: 'fa-globe', title: 'Atlas tree: your atlas builds, step along a build, edit and share' },
  { key: 'craft', label: 'Craft', icon: 'fa-flask', title: 'Crafting simulator and timeless jewel explorer' },
  { key: 'market', label: 'Market', icon: 'fa-chart-line', title: 'Prices: watched items, all poe.ninja prices, shopping and sell lists, bulk sell, farming' },
  { key: 'profit', label: 'Profit', icon: 'fa-piggy-bank', title: 'Ways to make currency: gem levelling, crafting costs, currency counter, Viscera, Temple, Wombgifts' },
  { key: 'trade', label: 'Trade', icon: 'fa-handshake', title: "Trading right now: whispers and ledger, Market search, GGG's trade site" },
  { key: 'friends', label: 'Friends', icon: 'fa-user-friends', title: "Friends' trade board and build sharing" },
  { key: 'lab', label: 'Lab', icon: 'fa-dungeon', title: "Today's labyrinth layouts on poelab.com (community site, shown as-is)" },
  { key: 'reference', label: 'Reference', icon: 'fa-book', title: 'Cheat sheets, vendor and bench recipes, your league tracking (Thread planner, Challenges, checklist) and Help' },
  { key: 'settings', label: 'Settings', icon: 'fa-cog', title: 'All Orbhoarder settings (same as Shift+Space → Settings)' }
] as const
type View = typeof VIEWS[number]['key']

const VIEW_KEY = 'deathloom.desktop-view.v1'
function loadView (): View {
  try {
    const v = readWindowKey(VIEW_KEY)
    // the Trade site tab was called 'trade' too: a window left there opens on Trade → Trade site
    if (v === 'trade' && !hasSavedSub('trade')) setSub('trade', 'site')
    // old tab names (before 1.0.30, and before the 27 Nov 2026 layout) keep your place
    const r = v ? resolveView(v, isView) : null
    if (r?.sub) setSub(r.view, r.sub)
    return r ? r.view as View : 'overview'
  } catch { return 'overview' }
}
const view = ref<View>(loadView())
// Deathloom fork: Report a bug / Suggest a feature dialog
const feedback = ref<'bug' | 'idea' | null>(null)
// a panel's hotkey asked for its tab (panel not shown in the overlay)
function isView (v: string) { return VIEWS.some(x => x.key === v) }
function viewFromHotkey (v: string) {
  const r = resolveView(v, isView)
  if (!r) return
  if (r.sub) setSub(r.view, r.sub)
  setView(r.view as View)
}
const askedView = new URLSearchParams(window.location.search).get('view')
if (askedView) viewFromHotkey(askedView)
// hotkeys, Help and Lab buttons go to window 1 (the main hub)
if (!IS_DESKTOP2) Host.onEvent('MAIN->CLIENT::desktop-view', (e) => { viewFromHotkey(e.view) })
function setView (v: View) {
  view.value = v
  try { localStorage.setItem(windowKey(VIEW_KEY), v) } catch {}
}
watch(view, (v) => {
  const label = VIEWS.find(x => x.key === v)?.label
  const name = IS_DESKTOP2 ? 'Orbhoarder (2)' : 'Orbhoarder'
  document.title = v === 'overview' ? name : `${name} · ${label}`
}, { immediate: true })

// Deathloom fork (Q27): new install: the tour opens once the setup guide closes
if (!IS_DESKTOP2 && autoTourWanted(AppConfig().pob?.setupDone)) {
  const stop = watch(desktopSetupShown, (shown) => {
    if (shown) return
    stop()
    tourOpen.value = true
  })
}

// Trade site tab: mounted the first time it's shown, then kept
const tradeOpened = ref(view.value === 'trade' || tradeTabRequest.value > 0)
if (tradeTabRequest.value > 0) { setSub('trade', 'site'); view.value = 'trade' }
watch(view, (v) => { if (v === 'trade') tradeOpened.value = true })
watch(tradeTabRequest, () => { setSub('trade', 'site'); setView('trade') })
// Lab tab: same, mounted the first time it's shown
const labOpened = ref(view.value === 'lab')
watch(view, (v) => { if (v === 'lab') labOpened.value = true })

// in game or not (from the HUD state main sends to every window)
const playing = ref<boolean | null>(null)
Host.onEvent('MAIN->CLIENT::hud-state', (e) => { playing.value = e.playing })
// All tab: Edit layout mode (left when you switch tabs)
const editLayout = ref(false)
// All tab: Levelling / Mapping layout follows the game (Auto)
onUnmounted(useLayoutPhase())
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
  /* Deathloom fork: Settings → Appearance (window background) */
  background-color: var(--window-bg, #1a202c);
  background-image: var(--window-bg-image, none);
  /* theme decorations repeat small tiles; pictures cover */
  background-size: var(--window-bg-size, cover);
  background-position: center;
  background-attachment: fixed;
}
html.desktop #app {
  justify-content: flex-start;
}
/* thin scrollbar when the tabs don't fit (narrow window) */
.desktop-topbar::-webkit-scrollbar { height: 4px; }
.desktop-root .widget-default-style {
  max-height: none;
}
</style>
