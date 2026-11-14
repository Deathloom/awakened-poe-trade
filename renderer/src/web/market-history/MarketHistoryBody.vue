<template>
  <!-- Deathloom fork (body, used by the overlay widget and the desktop window): price trends for watched items (poe.ninja 7 days + points recorded by the overlay) -->
  <div class="widget-default-style flex flex-col text-gray-200 leading-tight text-sm" :style="fill ? { width: '100%', height: '100%' } : { width: '26rem', maxHeight: '80vh' }">
    <div class="flex items-center gap-x-2 px-2 py-1 bg-gray-900 rounded-t shrink-0">
      <span class="text-gray-500"><i class="fas fa-chart-line mr-1" />Market history</span>
      <span class="text-xs text-gray-500">{{ league ?? 'no league' }}</span>
    </div>
    <div class="overflow-y-auto min-h-0 p-1">
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
          <button class="btn-mini shrink-0" title="Open this item on poe.ninja (full history)" :disabled="!w.now" @click="w.now && open(w.now.url)">
            <i class="fas fa-external-link-alt mr-1" />Open on poe.ninja</button>
          <button class="btn-mini shrink-0 hover:text-red-300" title="Stop watching this item" @click="removeWatch(w.key)">
            <i class="fas fa-trash-alt mr-1" />Delete</button>
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
import { computed, onUnmounted, watch } from 'vue'
import VueApexcharts from 'vue3-apexcharts'
import { usePoeninja } from '@/web/background/Prices'
import { useLeagues } from '@/web/background/Leagues'
import { watchlist, removeWatch, record } from './watchlist'

// active: the panel is on screen; fill: take the whole space (desktop window)
const props = defineProps<{ active?: boolean, fill?: boolean }>()
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
    if (w.now) record(w.key, w.now.chaos)
  }
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

<style lang="postcss" scoped>
.btn-mini {
  @apply bg-gray-700 text-gray-300 rounded px-2 text-xs;
  &:hover:not(:disabled) { @apply text-gray-100; }
  &:disabled { @apply opacity-50; }
}
</style>
