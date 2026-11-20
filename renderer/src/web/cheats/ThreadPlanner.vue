<template>
  <!-- Deathloom fork (Q3): Thread planner (Cheat sheets). Facts from threads.ts,
       prices from the shared poe.ninja download, notables from GGG's atlas data. -->
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-1">
      <select v-model="kindId" class="rounded bg-gray-900 px-1 py-0.5" title="Which Thread">
        <option v-for="t of THREADS" :key="t.id" :value="t.id">{{ t.label }}</option>
      </select>
      <span class="text-gray-500 ml-1">×</span>
      <button v-for="n of MAX_THREADS" :key="n" class="ui-tab" :class="{ 'ui-tab-on': count === n }" @click="setCount(n)">{{ n }}</button>
      <button class="ui-btn ui-btn-quiet ml-auto" :class="{ 'text-gray-100': helpOpen }" title="How this is worked out" @click="helpOpen = !helpOpen">?</button>
    </div>
    <div v-if="helpOpen" class="text-gray-500">
      {{ count }} {{ kind.item }}{{ count > 1 ? 's' : '' }} in the map device, one map. Mods and bonuses from GGG's 3.30.0b–c patch notes; prices are poe.ninja's for the league picked in Settings;
      notables from GGG's atlas tree data. The cost is the full price (Subtle Manipulations sometimes keeps the Threads).
    </div>

    <div>
      <div class="text-gray-100 font-semibold mb-0.5">In the map</div>
      <ul class="list-disc pl-4 text-gray-300 space-y-1">
        <li>At least <b class="text-gray-100">{{ mods }}</b> {{ kind.label }} Thread mod{{ mods > 1 ? 's' : '' }}<span v-if="modsNext" class="text-gray-500"> · {{ modsNext.at }} Threads for {{ modsNext.mods }}</span></li>
        <li v-if="bonus.active">Bonus ({{ bonus.active.at }}): <span class="text-gray-100">{{ bonus.active.text }}</span></li>
        <li v-else class="text-gray-400">No 3 / 6 / 8 bonus yet</li>
        <li v-if="bonus.next" class="text-gray-400">Next at {{ bonus.next.at }} (+{{ bonus.next.more }}): {{ bonus.next.text }}</li>
        <li v-if="gate" class="text-gray-400">{{ gate }}</li>
      </ul>
    </div>

    <div>
      <div class="text-gray-100 font-semibold mb-0.5">Cost per map</div>
      <div v-if="cost" class="text-gray-300">
        <span class="text-gray-100">{{ fmt(cost.chaos) }} c</span>
        <span v-if="cost.div != null" class="text-gray-400"> · {{ fmt(cost.div, true) }} div</span>
        <span class="text-gray-500"> · {{ count }} × {{ fmt(price!) }} c</span>
      </div>
      <div v-else class="text-gray-500">No poe.ninja price for {{ kind.item }} yet{{ ninja.isLoading.value ? ' (loading…)' : '' }}.</div>
    </div>

    <div>
      <div class="text-gray-100 font-semibold mb-0.5">Atlas notables for {{ kind.label }} Threads</div>
      <ul class="list-disc pl-4 text-gray-300 space-y-1">
        <li v-for="n of notables" :key="n.name"><span class="text-gray-100">{{ n.name }}</span> <span class="text-gray-400">· {{ n.how }}</span></li>
      </ul>
      <div class="text-gray-500 mt-1">For the mechanic itself ({{ mechanicNotables }} notables): Atlas → ⋯ → ready-made tree.</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { usePoeninja, displayRounding } from '@/web/background/Prices'
import { THREADS, MAX_THREADS, guaranteedMods, bonusState, threadCost, gateNote } from './threads'
import { threadNotables, CONTENT_NOTABLES } from '../atlas/atlas-generator'

const KEY = 'deathloom.cheats.threads.v1'
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {} } catch { return {} } })() as { kind?: string, count?: number }
const kindId = ref(THREADS.some(t => t.id === saved.kind) ? saved.kind! : THREADS[0].id)
const count = ref(Number.isInteger(saved.count) && saved.count! >= 1 && saved.count! <= MAX_THREADS ? saved.count! : 3)
const helpOpen = ref(false)
function save () { try { localStorage.setItem(KEY, JSON.stringify({ kind: kindId.value, count: count.value })) } catch {} }
function setCount (n: number) { count.value = n; save() }
const kind = computed(() => THREADS.find(t => t.id === kindId.value) ?? THREADS[0])
watch(kindId, save)

const mods = computed(() => guaranteedMods(count.value))
const modsNext = computed(() => {
  for (let n = count.value + 1; n <= MAX_THREADS; n++) {
    if (guaranteedMods(n) > mods.value) return { at: n, mods: guaranteedMods(n) }
  }
  return null
})
const bonus = computed(() => bonusState(kind.value, count.value))
const gate = computed(() => gateNote(kind.value, count.value))

// prices: the app's shared poe.ninja download (no other requests)
const ninja = usePoeninja()
ninja.queuePricesFetch()
const timer = setInterval(() => { ninja.queuePricesFetch() }, 10 * 60_000)
onUnmounted(() => clearInterval(timer))
const price = computed(() => {
  if (ninja.dbVersion.value < 0) return null
  return ninja.findPriceByQuery({ ns: 'ITEM', name: kind.value.item, variant: undefined })?.chaos ?? null
})
const cost = computed(() => threadCost(count.value, price.value, ninja.xchgRate.value))
const fmt = (v: number, fraction = false) => displayRounding(v, fraction)

const notables = computed(() => threadNotables(kind.value.atlas))
const mechanicNotables = computed(() => CONTENT_NOTABLES[kind.value.atlas] ?? 0)
</script>
