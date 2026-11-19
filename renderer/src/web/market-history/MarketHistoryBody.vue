<template>
  <!-- Deathloom fork (body, used by the overlay widget and the desktop window): price trends for watched items (poe.ninja 7 days + points recorded by the overlay) -->
  <div class="widget-default-style flex flex-col text-gray-200 leading-tight text-sm" :style="fill ? { width: '100%', height: '100%' } : { width: '30rem', maxHeight: '80vh' }">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 bg-gray-900 rounded-t shrink-0">
      <span class="text-gray-500"><i class="fas fa-chart-line mr-1" />Market</span>
      <!-- Deathloom fork: Market overview is a tab here (was its own panel); 20 Nov: market tools tabs -->
      <div class="flex flex-wrap gap-px">
        <button v-for="t of shownTabs" :key="t.id" class="ui-tab" :class="{ 'ui-tab-on': curTab === t.id }" :title="t.tip" @click="setTab(t.id)">{{ t.label }}</button>
      </div>
      <div class="ml-auto flex items-center gap-x-2">
        <span class="text-xs text-gray-500">{{ league ?? 'no league' }}</span>
        <divine-chip />
      </div>
    </div>
    <div v-if="curTab === 'all'" class="flex-1 min-h-0" :style="fill ? {} : { height: '26rem' }"><MarketOverview /></div>
    <div v-else-if="curTab !== 'watched'" class="flex-1 min-h-0" :style="fill ? {} : { height: '26rem' }">
      <market-shopping v-if="curTab === 'shop'" />
      <market-sell v-else-if="curTab === 'sell'" />
      <market-farming v-else-if="curTab === 'farm'" />
      <market-crafting v-else />
    </div>
    <div v-else class="overflow-y-auto min-h-0 p-1">
      <div v-if="!items.length" class="p-1 text-gray-500">
        Nothing watched yet. Press the <i class="far fa-star" /> next to an item in the market list, or next to its poe.ninja price in a price check.
      </div>
      <div v-for="w of items" :key="w.key" class="rounded bg-gray-900 mb-1 p-1">
        <div class="flex items-center gap-x-2">
          <img v-if="w.icon" :src="w.icon" class="w-6 h-6 object-contain shrink-0" />
          <span class="truncate flex-1" :title="w.label">{{ w.label }}</span>
          <span v-if="w.now" class="text-yellow-300 shrink-0">{{ fmt(w.now.chaos) }} c</span>
          <span v-else class="text-gray-600 shrink-0 text-xs">no price</span>
          <span v-if="w.change != null" class="text-xs shrink-0 w-12 text-right" :class="w.change >= 0 ? 'text-green-500' : 'text-red-400'">
            {{ w.change >= 0 ? '+' : '' }}{{ Math.round(w.change) }}%</span>
          <button class="ui-btn ui-btn-quiet shrink-0" :class="{ 'ui-btn-on': w.alert }" :disabled="!w.now"
            :title="w.alert ? `Alert when the price moves ${w.alert.pct}% from ${fmt(w.alert.base)} c (click to change)` : 'Price alert: tell me when the price moves (click: 10%, 20%, 50%, off)'"
            @click="cycleAlert(w)"><i class="fas fa-bell mr-1" />{{ w.alert ? w.alert.pct + '%' : 'Alert' }}</button>
          <ui-menu :items="rowMenu(w)" align-right title="More: open on poe.ninja, stop watching" button-class="ui-btn-quiet" />
        </div>
        <div class="flex gap-x-2 items-end pt-1">
          <div class="flex-1">
            <div class="text-xs text-gray-500">poe.ninja, 7 days</div>
            <div class="h-10">
              <vue-apexcharts v-if="w.ninjaPoints.length > 1" type="area" height="40"
                :options="sparkOptions" :series="[{ data: w.ninjaPoints }]" />
            </div>
          </div>
          <div class="flex-1">
            <div class="text-xs text-gray-500">recorded{{ w.since ? ' since ' + w.since : '' }} ({{ w.points.length }})</div>
            <div class="h-10">
              <vue-apexcharts v-if="w.points.length > 1" type="line" height="40"
                :options="lineOptions" :series="[{ data: w.points.map(p => ({ x: p[0], y: p[1] })) }]" />
              <div v-else class="text-xs text-gray-600 pt-2">builds up while the overlay runs (about hourly)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MarketOverview from './MarketOverview.vue'
import MarketShopping from './MarketShopping.vue'
import MarketSell from './MarketSell.vue'
import MarketFarming from './MarketFarming.vue'
import MarketCrafting from './MarketCrafting.vue'
import DivineChip from './DivineChip.vue'
import UiMenu, { type UiMenuItem } from '../ui/UiMenu.vue'
import { computed, onUnmounted, ref, watch } from 'vue'
import VueApexcharts from 'vue3-apexcharts'
import { usePoeninja } from '@/web/background/Prices'
import { useLeagues } from '@/web/background/Leagues'
import { watchlist, removeWatch, record, setAlert, checkAlert, ALERT_STEPS, type WatchedItem } from './watchlist'

// active: the panel is on screen; fill: take the whole space (desktop window)
const props = defineProps<{ active?: boolean, fill?: boolean, tabs?: boolean }>()
const TAB_KEY = 'deathloom.market.tab.v1'
const TABS = [
  { id: 'watched', label: 'Watched', tip: 'Items you watch: a week of prices and price alerts' },
  { id: 'all', label: 'All prices', tip: 'Every poe.ninja price: risers, fallers, outlook' },
  { id: 'shop', label: 'Shopping', tip: 'What your build still needs (uniques and gems) and what it costs' },
  { id: 'sell', label: 'Sell list', tip: 'What you plan to sell: value now and whether to wait' },
  { id: 'farm', label: 'Farming', tip: 'Profit per hour per strategy or league mechanic' },
  { id: 'craft', label: 'Crafting', tip: 'Crafting currency prices and what your craft costs' }
] as const
type Tab = typeof TABS[number]['id']
const tab = ref<Tab>((() => { try { const v = localStorage.getItem(TAB_KEY); return TABS.some(t => t.id === v) ? v as Tab : 'watched' } catch { return 'watched' } })())
// the window's Market view shows All prices on the right, so that tab isn't listed there
const shownTabs = computed(() => TABS.filter(t => props.tabs !== false || t.id !== 'all'))
const curTab = computed<Tab>(() => props.tabs === false && tab.value === 'all' ? 'watched' : tab.value)
function setTab (t: Tab) {
  tab.value = t
  try { localStorage.setItem(TAB_KEY, t) } catch {}
}
const { findPriceByQuery, queuePricesFetch } = usePoeninja()
const leagues = useLeagues()
const league = computed(() => leagues.selectedId.value)

const items = computed(() => watchlist.value
  .filter(w => w.league === league.value)
  .map(w => {
    const now = findPriceByQuery({ ns: w.ns, name: w.name, variant: w.variant })
    const graph = (now?.graph ?? []).filter((p): p is number => p != null)
    // ninja's graph is % change per day; the last value is the 7-day change
    return {
      ...w,
      now,
      change: graph.length ? graph[graph.length - 1] : null,
      ninjaPoints: graph,
      since: w.points.length ? new Date(w.points[0][0]).toLocaleDateString() : ''
    }
  }))

function recordAll () {
  for (const w of items.value) {
    if (!w.now) continue
    record(w.key, w.now.chaos)
    if (w.alert) {
      const change = checkAlert(w.key, w.now.chaos)
      if (change != null) notify(w.label, change, w.now.chaos)
    }
  }
}

// Deathloom fork (idea 4): price alerts
function cycleAlert (w: WatchedItem & { now: { chaos: number } | null }) {
  const i = ALERT_STEPS.indexOf(w.alert?.pct ?? 0)
  setAlert(w.key, ALERT_STEPS[(i + 1) % ALERT_STEPS.length], w.now?.chaos)
}
function notify (label: string, change: number, chaos: number) {
  const text = `${label}: ${change >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(change))}% to ${fmt(chaos)} c`
  try {
    // eslint-disable-next-line no-new
    new Notification('Orbhoarder price alert', { body: text, silent: false })
  } catch {}
}

// Keep prices fresh and record a point now and then while something is watched
const timer = setInterval(() => {
  if (watchlist.value.some(w => w.league === league.value)) {
    queuePricesFetch()
    recordAll()
  }
}, 10 * 60_000)
onUnmounted(() => { clearInterval(timer) })

watch(() => props.active, (active) => {
  if (active) { queuePricesFetch(); recordAll() }
}, { immediate: true })
// only when a watched item or its price changes (not on every list update)
watch(() => items.value.map(w => `${w.key}=${w.now?.chaos ?? ''}`).join('|'), recordAll)

function open (url: string) { window.open(url) }
function rowMenu (w: { key: string, now: { url: string } | null }): UiMenuItem[] {
  return [
    { label: 'Open on poe.ninja (full history)', icon: 'fas fa-external-link-alt', disabled: !w.now, action: () => { if (w.now) open(w.now.url) } },
    { divider: true },
    { label: 'Stop watching', icon: 'fas fa-trash-alt', action: () => { removeWatch(w.key) } }
  ]
}
function fmt (n: number) { return n >= 100 ? Math.round(n) : Math.round(n * 10) / 10 }

const sparkOptions = {
  chart: { sparkline: { enabled: true }, animations: { enabled: false } },
  stroke: { curve: 'smooth', width: 1, colors: ['#a0aec0'] },
  fill: { colors: ['#4a5568'], type: 'solid' },
  tooltip: { enabled: false }
}
const lineOptions = {
  chart: { sparkline: { enabled: true }, animations: { enabled: false } },
  stroke: { curve: 'straight', width: 1.5, colors: ['#ecc94b'] },
  xaxis: { type: 'datetime' },
  tooltip: { enabled: true, theme: 'dark', x: { format: 'dd MMM HH:mm' }, y: { formatter: (v: number) => `${fmt(v)} c` } }
}
</script>
