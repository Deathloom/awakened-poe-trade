<template>
  <!-- Deathloom fork: poe.ninja market overview (Loot Goblin window, Market tab):
       current prices, risers/fallers and a short trend outlook -->
  <div class="widget-default-style flex flex-col text-gray-200 leading-tight text-sm w-full h-full">
    <div class="flex flex-wrap items-center gap-2 px-2 py-1 bg-gray-900 rounded-t shrink-0">
      <span class="text-gray-500"><i class="fas fa-coins mr-1" />Market</span>
      <span class="text-xs text-gray-500">{{ leagueId ?? 'no league' }} · poe.ninja</span>
      <div class="flex gap-x-1 ml-2">
        <button v-for="m of MODES" :key="m.id" class="mk-tab" :class="{ 'mk-tab-on': mode === m.id }" :title="m.tip"
          @click="mode = m.id">{{ m.label }}</button>
      </div>
      <button class="ml-auto text-gray-500 hover:text-gray-200" title="Reload prices from poe.ninja" :disabled="ninja.isLoading.value"
        @click="ninja.queuePricesFetch()"><i class="fas fa-sync-alt" :class="{ 'fa-spin': ninja.isLoading.value }" /></button>
    </div>
    <div class="flex flex-wrap items-center gap-2 px-2 py-1 shrink-0 text-xs">
      <select v-model="group" class="bg-gray-900 rounded px-1 py-0.5">
        <option v-for="g of MARKET_GROUPS" :key="g.id" :value="g.id">{{ g.label }}</option>
      </select>
      <input v-model="search" class="bg-gray-900 rounded px-1 py-0.5 flex-1 min-w-[8rem]" placeholder="Search…" spellcheck="false">
      <label class="flex items-center gap-x-1 text-gray-400" title="Hide cheap items (their % moves are mostly noise)">
        at least <input v-model.number="minChaos" type="number" min="0" class="bg-gray-900 rounded px-1 w-14"> c
      </label>
    </div>
    <div v-if="mode === 'outlook'" class="px-2 pb-1 text-xs text-gray-500 shrink-0">
      Items whose price climbed steadily this week, with where it lands in 3 days if the trend holds.
      It's a projection from poe.ninja's last 7 days, not a promise: patches, streamers and big sellers change prices fast.
    </div>
    <div class="overflow-y-auto min-h-0 flex-1 px-1">
      <div v-if="!rows.length" class="p-2 text-gray-500">
        {{ ninja.isLoading.value || !all.length ? 'Loading prices from poe.ninja…' : 'Nothing matches.' }}
      </div>
      <table v-else class="w-full text-xs">
        <thead class="text-gray-500 sticky top-0 bg-gray-800">
          <tr>
            <th class="text-left font-normal py-0.5">Item</th>
            <th class="text-right font-normal">Price</th>
            <th class="text-right font-normal" title="Change over 7 days">7 days</th>
            <th v-if="mode === 'outlook'" class="text-right font-normal" title="Projected change in 3 days if the trend holds">3-day outlook</th>
            <th class="font-normal">Week</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="r of rows" :key="r.key" class="border-t border-gray-800 hover:bg-gray-900">
            <td class="py-0.5 pr-1 max-w-0 w-full">
              <div class="truncate" :title="r.label">{{ r.label }}</div>
              <div class="text-gray-600 truncate">{{ categoryLabel(r.item.category) }}</div>
            </td>
            <td class="text-right text-yellow-300 whitespace-nowrap pr-1">{{ price(r.item.chaos) }}</td>
            <td class="text-right whitespace-nowrap pr-1" :class="pctClass(r.trend?.change)">{{ pct(r.trend?.change) }}</td>
            <td v-if="mode === 'outlook'" class="text-right whitespace-nowrap pr-1" :class="pctClass(r.trend?.outlook)"
              :title="r.trend ? `Steadiness ${Math.round(r.trend.fit * 100)}% · last 2 days ${pct(r.trend.recent)}` : ''">
              {{ pct(r.trend?.outlook) }}</td>
            <td class="px-1"><svg v-if="r.trend" width="60" height="16" class="block">
              <polyline :points="spark(r.trend.series)" fill="none" stroke-width="1.2"
                :stroke="(r.trend.change ?? 0) >= 0 ? '#48bb78' : '#f56565'" /></svg></td>
            <td class="whitespace-nowrap text-right">
              <button class="px-1" :class="isWatched(r.watchKey) ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'"
                :title="isWatched(r.watchKey) ? 'Stop watching' : 'Watch (left panel)'" @click="watchRow(r)">
                <i :class="isWatched(r.watchKey) ? 'fas fa-star' : 'far fa-star'" /></button>
              <button class="px-1 text-gray-500 hover:text-gray-200" title="Open on poe.ninja" @click="open(r.item.url)">
                <i class="fas fa-external-link-alt" /></button>
            </td>
          </tr>
        </tbody>
      </table>
      <button v-if="filtered.length > limit" class="w-full my-1 py-1 text-xs text-gray-400 hover:text-gray-200 bg-gray-900 rounded"
        @click="limit += 100">Show more ({{ filtered.length - limit }} left)</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { usePoeninja, type NinjaListing } from '@/web/background/Prices'
import { useLeagues } from '@/web/background/Leagues'
import { isWatched, toggleWatch, watchKey } from './watchlist'
import { MARKET_GROUPS, trendOf, type Trend } from './market-trends'

type Mode = 'prices' | 'rising' | 'falling' | 'outlook'
const MODES: Array<{ id: Mode, label: string, tip: string }> = [
  { id: 'prices', label: 'Prices', tip: 'Current prices, most valuable first' },
  { id: 'rising', label: 'Rising', tip: 'Biggest gains over 7 days' },
  { id: 'falling', label: 'Falling', tip: 'Biggest drops over 7 days' },
  { id: 'outlook', label: 'Outlook', tip: 'Steady climbers and where they may be in 3 days' }
]

const ninja = usePoeninja()
const leagues = useLeagues()
const leagueId = computed(() => leagues.selectedId.value)

const MODE_KEY = 'deathloom.market-overview.v1'
let saved: { mode?: Mode, group?: string, minChaos?: number } = {}
try { saved = JSON.parse(localStorage.getItem(MODE_KEY) ?? '{}') } catch {}
const mode = ref<Mode>(saved.mode ?? 'prices')
const group = ref(saved.group ?? 'all')
const minChaos = ref(saved.minChaos ?? 5)
const search = ref('')
const limit = ref(100)
watch([mode, group, minChaos], () => {
  limit.value = 100
  try { localStorage.setItem(MODE_KEY, JSON.stringify({ mode: mode.value, group: group.value, minChaos: minChaos.value })) } catch {}
})
watch(search, () => { limit.value = 100 })

// keep prices fresh while the panel is open
ninja.queuePricesFetch()
const timer = setInterval(() => { ninja.queuePricesFetch() }, 10 * 60_000)
onUnmounted(() => { clearInterval(timer) })

interface Row { key: string, label: string, item: NinjaListing, trend: Trend | null, watchKey: string }

const all = computed<Row[]>(() => {
  if (ninja.dbVersion.value < 0) return []
  const league = leagueId.value ?? ''
  return ninja.allItems().map(item => ({
    key: `${item.category}|${item.name}|${item.variant ?? ''}`,
    label: [item.name, item.variant].filter(Boolean).join(' · '),
    item,
    trend: trendOf(item),
    watchKey: watchKey({ ns: item.ns, name: item.name, variant: item.variant }, league)
  }))
})

const filtered = computed(() => {
  const g = MARKET_GROUPS.find(x => x.id === group.value) ?? MARKET_GROUPS[0]
  const q = search.value.trim().toLowerCase()
  const min = Number(minChaos.value) || 0
  let list = all.value.filter(r => g.match(r.item.category) && r.item.chaos >= min &&
    (!q || r.label.toLowerCase().includes(q)))
  switch (mode.value) {
    case 'prices':
      list = list.sort((a, b) => b.item.chaos - a.item.chaos)
      break
    case 'rising':
      list = list.filter(r => (r.trend?.change ?? 0) > 0).sort((a, b) => b.trend!.change - a.trend!.change)
      break
    case 'falling':
      list = list.filter(r => (r.trend?.change ?? 0) < 0).sort((a, b) => a.trend!.change - b.trend!.change)
      break
    case 'outlook':
      // steady climbers: rising, a good fit and not just one spike
      list = list.filter(r => r.trend && r.trend.outlook > 1 && r.trend.fit >= 0.75 && r.trend.slope > 0)
        .sort((a, b) => b.trend!.outlook - a.trend!.outlook)
      break
  }
  return list
})
const rows = computed(() => filtered.value.slice(0, limit.value))

function watchRow (r: Row) {
  toggleWatch({ ns: r.item.ns, name: r.item.name, variant: r.item.variant, label: r.label, league: leagueId.value ?? '' }, r.item.chaos)
}

function categoryLabel (c: string) {
  return c.replace(/-/g, ' ')
}
function price (chaos: number) {
  const v = ninja.autoCurrency(chaos)
  const n = v.min >= 100 ? Math.round(v.min) : Math.round(v.min * 10) / 10
  return `${n} ${v.currency === 'div' ? 'div' : 'c'}`
}
function pct (v: number | undefined) {
  if (v == null || !Number.isFinite(v)) return '–'
  return `${v >= 0 ? '+' : ''}${Math.abs(v) >= 10 ? Math.round(v) : v.toFixed(1)}%`
}
function pctClass (v: number | undefined) {
  if (v == null) return 'text-gray-600'
  return v > 0.5 ? 'text-green-400' : v < -0.5 ? 'text-red-400' : 'text-gray-400'
}
function spark (series: number[]) {
  const min = Math.min(...series)
  const max = Math.max(...series)
  const span = max - min || 1
  return series.map((p, i) => `${(i / Math.max(1, series.length - 1) * 58 + 1).toFixed(1)},${(15 - (p - min) / span * 14).toFixed(1)}`).join(' ')
}
function open (url: string) { window.open(url) }
</script>

<style lang="postcss" scoped>
.mk-tab { @apply px-2 rounded text-xs text-gray-400 bg-gray-800; }
.mk-tab:hover { @apply text-gray-100; }
.mk-tab-on { @apply bg-gray-700 text-gray-100; }
</style>
