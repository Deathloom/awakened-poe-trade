<template>
  <!-- Deathloom fork: Profit, was Money tools (overlay, in game, Orbhoarder window). Prices
       from the poe.ninja economy data the app already downloads. -->
  <div class="flex flex-col h-full min-h-0 rounded bg-gray-800 text-xs">
    <div class="flex flex-wrap items-center gap-1 px-2 py-1 border-b border-gray-700 shrink-0">
      <span class="lg-head mr-1"><i class="fas fa-piggy-bank mr-1 text-gray-500" />Profit</span>
      <button v-for="t of TABS" :key="t.id" class="ui-tab"
        :class="{ 'ui-tab-on': tab === t.id }" @click="setTab(t.id)">{{ t.label }}</button>
      <span class="ml-auto text-gray-500">{{ league ?? 'no league' }}<span v-if="divine"> · 1 div = {{ Math.round(divine) }} c</span></span>
    </div>

    <div v-if="ninja.initialLoading()" class="p-2 text-gray-500">Loading prices from poe.ninja…</div>

    <!-- Deathloom fork (layout review step 3): Profit. Gem levelling is Market → Gems'
         tool now (it was here twice), and Crafting costs moved here from Market -->
    <MarketGems v-else-if="tab === 'gems'" class="flex-1 min-h-0" />
    <MarketCrafting v-else-if="tab === 'craft'" class="flex-1 min-h-0" />
    <MarketFarming v-else-if="tab === 'farm'" class="flex-1 min-h-0" />

    <!-- Deathloom fork (Q12): Viscera planner (own chunk: carries PoB's Viscera list) -->
    <VisceraPlanner v-else-if="tab === 'viscera'" :items="all" :money="money" />
    <!-- Deathloom fork (Q13): Temple of Atzoatl planner -->
    <TemplePlanner v-else-if="tab === 'temple'" :items="all" :money="money" />
    <!-- Deathloom fork (Q14): Wombgift value -->
    <WombgiftValue v-else-if="tab === 'wombgifts'" :items="all" :money="money" />

    <!-- Currency counter -->
    <div v-else class="flex-1 min-h-0 flex flex-col">
      <div class="flex items-baseline gap-2 px-2 py-1 shrink-0">
        <span class="text-gray-300">Total:</span>
        <span class="text-yellow-300 text-sm">{{ money(total.chaos) }}</span>
        <span v-if="divine && total.chaos >= divine" class="text-gray-500">({{ Math.round(total.chaos) }} c)</span>
        <button class="ui-btn ui-btn-quiet ml-auto" title="Set all counts to 0" @click="clearAll"><i class="fas fa-undo mr-1" />Clear</button>
      </div>
      <div class="flex-1 min-h-0 overflow-y-auto px-2 space-y-0.5">
        <div class="flex items-center gap-2">
          <span class="flex-1">Chaos Orb</span>
          <input :value="counter.chaos || ''" type="number" min="0" class="w-16 bg-gray-900 rounded px-1 text-right" placeholder="0"
            @input="setChaos(($event.target as HTMLInputElement).valueAsNumber)">
          <span class="w-16 text-right text-gray-500 font-mono">{{ counter.chaos ? money(counter.chaos) : '' }}</span>
          <span class="w-4" />
        </div>
        <div v-for="name of names" :key="name" class="flex items-center gap-2">
          <span class="flex-1 truncate" :class="price(name) == null ? 'text-gray-500' : ''" :title="price(name) == null ? 'No poe.ninja price' : `1 = ${money(price(name)!)}`">{{ name }}</span>
          <input :value="counter.counts[name] || ''" type="number" min="0" class="w-16 bg-gray-900 rounded px-1 text-right" placeholder="0"
            @input="setCount(name, ($event.target as HTMLInputElement).valueAsNumber)">
          <span class="w-16 text-right text-gray-500 font-mono">{{ counter.counts[name] && price(name) != null ? money(price(name)! * counter.counts[name]) : '' }}</span>
          <button v-if="counter.extra.includes(name)" class="ui-btn ui-btn-quiet px-1" title="Remove" @click="removeExtra(name)"><i class="fas fa-times" /></button>
          <span v-else class="w-4" />
        </div>
        <div class="flex items-center gap-2 pt-1">
          <input v-model="addName" list="money-item-names" class="flex-1 min-w-0 bg-gray-900 rounded px-1" placeholder="Add another item (thread, fossil, essence…)" spellcheck="false"
            @keydown.enter="addExtra">
          <datalist id="money-item-names"><option v-for="n of itemNames" :key="n" :value="n" /></datalist>
          <button class="ui-btn" :disabled="!addName.trim()" @click="addExtra">Add</button>
        </div>
      </div>
      <div class="px-2 py-1 text-gray-500 shrink-0">
        <i class="fas fa-info-circle mr-1" />Type what's in your stash (counts stay on this PC). Values at today's poe.ninja prices.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onUnmounted, ref } from 'vue'
import { usePoeninja } from '@/web/background/Prices'
import { useLeagues } from '@/web/background/Leagues'
import MarketGems from '../market-history/MarketGems.vue'
import MarketCrafting from '../market-history/MarketCrafting.vue'
import MarketFarming from '../market-history/MarketFarming.vue'
import { DEFAULT_CURRENCIES, loadCounter, saveCounter, counterTotal, COUNTER_KEY, type CounterState } from './money'

const VisceraPlanner = defineAsyncComponent(async () => await import('./VisceraPlanner.vue'))
const TemplePlanner = defineAsyncComponent(async () => await import('./TemplePlanner.vue'))
const WombgiftValue = defineAsyncComponent(async () => await import('./WombgiftValue.vue'))

const TABS = [
  { id: 'gems', label: 'Gems' },
  { id: 'craft', label: 'Crafting costs' },
  { id: 'counter', label: 'Currency counter' },
  { id: 'farm', label: 'Farming' },
  { id: 'viscera', label: 'Viscera' },
  { id: 'temple', label: 'Temple' },
  { id: 'wombgifts', label: 'Wombgifts' }
] as const
type Tab = typeof TABS[number]['id']
const TAB_KEY = 'deathloom.money-tab.v1'
const tab = ref<Tab>((() => {
  try {
    const t = localStorage.getItem(TAB_KEY)
    return TABS.find(x => x.id === t)?.id ?? 'gems'
  } catch { return 'gems' }
})())
function setTab (t: Tab) {
  tab.value = t
  try { localStorage.setItem(TAB_KEY, t) } catch {}
}

const ninja = usePoeninja()
const leagues = useLeagues()
const league = computed(() => leagues.selectedId.value)
const divine = computed(() => ninja.xchgRate.value)
ninja.queuePricesFetch()
const timer = setInterval(() => { ninja.queuePricesFetch() }, 10 * 60_000)

const all = computed(() => {
  if (ninja.dbVersion.value < 0) return []
  return ninja.allItems()
})

// Currency counter
const counter = ref<CounterState>(loadCounter())
const onStorage = (e: StorageEvent) => { if (e.key === COUNTER_KEY) counter.value = loadCounter() }
window.addEventListener('storage', onStorage)
onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('storage', onStorage)
})
const names = computed(() => [...DEFAULT_CURRENCIES, ...counter.value.extra.filter(n => !DEFAULT_CURRENCIES.includes(n))])
const priceIndex = computed(() => {
  const m = new Map<string, number>()
  for (const it of all.value) {
    if (it.ns === 'ITEM' && !it.variant && !m.has(it.name)) m.set(it.name, it.chaos)
  }
  return m
})
const itemNames = computed(() => [...priceIndex.value.keys()].sort())
function price (name: string): number | null {
  return priceIndex.value.get(name) ?? null
}
const total = computed(() => counterTotal(counter.value, price))
function update (fn: (c: CounterState) => void) {
  const c = loadCounter()
  fn(c)
  saveCounter(c)
  counter.value = c
}
function setChaos (v: number) { update(c => { c.chaos = Number.isFinite(v) && v > 0 ? v : 0 }) }
function setCount (name: string, v: number) {
  update(c => {
    c.counts = Object.fromEntries(Object.entries({ ...c.counts, [name]: v }).filter(([, n]) => Number.isFinite(n) && n > 0))
  })
}
const addName = ref('')
function addExtra () {
  const n = addName.value.trim()
  if (!n) return
  const known = itemNames.value.find(x => x.toLowerCase() === n.toLowerCase()) ?? n
  update(c => { if (!DEFAULT_CURRENCIES.includes(known) && !c.extra.includes(known)) c.extra.push(known) })
  addName.value = ''
}
function removeExtra (name: string) {
  update(c => {
    c.extra = c.extra.filter(x => x !== name)
    c.counts = Object.fromEntries(Object.entries(c.counts).filter(([n]) => n !== name))
  })
}
function clearAll () { update(c => { c.chaos = 0; c.counts = {} }) }

function money (chaos: number) {
  const d = divine.value
  if (d && Math.abs(chaos) >= d) return `${(chaos / d).toFixed(1)} div`
  return chaos >= 10 || chaos <= -10 ? `${Math.round(chaos)} c` : `${Math.round(chaos * 10) / 10} c`
}
</script>
