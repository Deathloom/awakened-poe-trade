<template>
  <!-- Deathloom fork (Q15, 27 Nov): gem profit — buy low level, level in a spare socket, sell at max level -->
  <div class="flex flex-col h-full min-h-0 text-xs">
    <div class="flex flex-wrap items-center gap-2 px-2 py-1 shrink-0">
      <input v-model="query" class="flex-1 min-w-0 bg-gray-900 rounded px-1 py-0.5" placeholder="Find a gem…" spellcheck="false">
      <label class="flex items-center gap-1 text-gray-400" title="How many days a gem sits in your socket to reach max level. Awakened gems count ×3, Enlighten / Empower / Enhance ×5 (a rough guess).">
        Days to level <input :value="baseDays" type="number" min="0.5" step="0.5" class="w-12 bg-gray-900 rounded px-1 text-right"
          @change="setBaseDays(($event.target as HTMLInputElement).valueAsNumber)"></label>
      <span class="text-gray-500" :title="`${PRISM}: 1 per 1% quality`">Prism {{ prismPrice != null ? money(prismPrice) : '–' }}</span>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto px-2">
      <div v-if="tracked.length" class="mb-2">
        <div class="flex items-baseline gap-2 text-gray-300">
          <span>Levelling now</span>
          <span class="text-gray-500">profit at today's prices:</span>
          <span :class="trackedTotal < 0 ? 'text-red-400' : 'text-yellow-300'">{{ money(trackedTotal) }}</span>
        </div>
        <div v-for="(r, i) of trackedRows" :key="r.t.name + r.t.started" class="flex items-center gap-2 py-0.5 border-t border-gray-800">
          <span class="flex-1 min-w-0 truncate" :title="`${r.t.name}: ${r.t.buy} → ${r.t.sell}`">{{ r.t.name }} <span class="text-gray-500">{{ r.t.buy }} → {{ r.t.sell }}</span></span>
          <span class="text-gray-500 w-16 text-right" :title="'Days in the socket so far'">day {{ r.day }}/{{ r.t.days }}</span>
          <input :value="r.t.paid" type="number" min="0" class="w-14 bg-gray-900 rounded px-1 text-right" title="What you paid (chaos)"
            @change="editTracked(i, { paid: ($event.target as HTMLInputElement).valueAsNumber })">
          <input :value="r.t.days" type="number" min="0.5" step="0.5" class="w-12 bg-gray-900 rounded px-1 text-right" title="Days to level this gem"
            @change="editTracked(i, { days: ($event.target as HTMLInputElement).valueAsNumber })">
          <span class="w-16 text-right" :class="!r.plan ? 'text-gray-600' : r.plan.profit < 0 ? 'text-red-400' : 'text-yellow-300'"
            :title="r.plan ? `Sell ${money(r.plan.sell.chaos)} − paid ${money(r.t.paid)}${r.plan.prisms ? ` − ${r.plan.prisms} prisms ${money(r.plan.prismCost)}` : ''}` : 'No poe.ninja price'">
            {{ r.plan ? money(r.plan.profit) : '–' }}</span>
          <span class="w-16 text-right text-gray-400" title="Profit per slot-day">{{ r.plan ? money(r.plan.perDay) + '/d' : '' }}</span>
          <button class="ui-btn ui-btn-quiet px-1" title="Remove (sold or dropped)" @click="removeTracked(i)"><i class="fas fa-check" /></button>
        </div>
      </div>
      <table class="w-full">
        <tr class="text-gray-500 sticky top-0 bg-gray-800">
          <th class="text-left font-normal">Gem</th>
          <th class="text-right font-normal pr-1">Buy</th>
          <th class="text-right font-normal pr-1">Sell</th>
          <th class="text-right font-normal pr-1" :title="`${PRISM}s to add quality`">Prisms</th>
          <th class="text-right font-normal pr-1">Profit</th>
          <th class="text-right font-normal pr-1" title="Profit per day the gem sits in a socket">Per slot-day</th>
          <th />
        </tr>
        <tr v-for="p of shown" :key="p.name" class="border-t border-gray-800">
          <td class="truncate max-w-0 w-full" :title="p.name">{{ p.name }}</td>
          <td class="text-right pr-1 whitespace-nowrap"><span class="text-gray-500">{{ p.buy.variant }}</span> {{ money(p.buy.chaos) }}</td>
          <td class="text-right pr-1 whitespace-nowrap"><span class="text-gray-500">{{ p.sell.variant }}</span> {{ money(p.sell.chaos) }}</td>
          <td class="text-right pr-1 text-gray-400">{{ p.prisms || '' }}</td>
          <td class="text-right pr-1" :class="p.profit < 0 ? 'text-red-400' : 'text-yellow-300'">{{ money(p.profit) }}</td>
          <td class="text-right pr-1 whitespace-nowrap" :title="`${p.days} days`">{{ money(p.perDay) }}</td>
          <td class="whitespace-nowrap">
            <button class="ui-btn ui-btn-quiet px-1" title="I'm levelling this one: track it" @click="track(p)"><i class="fas fa-plus" /></button>
            <button class="ui-btn ui-btn-quiet px-1" title="Open the max-level gem on poe.ninja" @click="open(p.sell.url)"><i class="fas fa-external-link-alt" /></button>
          </td>
        </tr>
      </table>
      <div v-if="!shown.length" class="text-gray-500 py-1">{{ all.length ? 'No gem matches.' : 'Waiting for poe.ninja prices…' }}</div>
      <div v-else-if="more" class="text-gray-500 py-1">{{ more }} more; type a name to find one.</div>
    </div>
    <div class="px-2 py-1 text-gray-500 shrink-0">
      <i class="fas fa-info-circle mr-1" />poe.ninja prices. Buy = cheapest lowest-level copy, Sell = max level with the same or more quality (not corrupted). Thin markets can be off: check the trade site before buying.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useMarket } from './use-market'
import { PRISM, gemRoutes, dayOf, defaultDays, loadTracked, saveTracked, trackedPlan, GEM_TRACK_KEY, type GemPlan, type TrackedGem } from './gem-profit'

const { all, money, open, itemPrice, ninja } = useMarket()
ninja.queuePricesFetch()

const DAYS_KEY = 'deathloom.gem-days.v1'
const baseDays = ref((() => { try { const n = Number(localStorage.getItem(DAYS_KEY)); return n > 0 ? n : 3 } catch { return 3 } })())
function setBaseDays (n: number) {
  baseDays.value = Number.isFinite(n) && n > 0 ? n : 3
  try { localStorage.setItem(DAYS_KEY, String(baseDays.value)) } catch {}
}
const prismPrice = computed(() => itemPrice(PRISM))
const routes = computed(() => gemRoutes(all.value, prismPrice.value, baseDays.value))

const LIMIT = 40
const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? routes.value.filter(p => p.name.toLowerCase().includes(q)) : routes.value
})
const shown = computed(() => filtered.value.slice(0, LIMIT))
const more = computed(() => Math.max(0, filtered.value.length - LIMIT))

const tracked = ref<TrackedGem[]>(loadTracked())
function onStorage (e: StorageEvent) { if (e.key === GEM_TRACK_KEY) tracked.value = loadTracked() }
onMounted(() => window.addEventListener('storage', onStorage))
onUnmounted(() => window.removeEventListener('storage', onStorage))
function setTracked (list: TrackedGem[]) { tracked.value = list; saveTracked(list) }
function track (p: GemPlan) {
  setTracked([...tracked.value, {
    name: p.name,
    buy: p.buy.variant ?? '',
    sell: p.sell.variant ?? '',
    paid: Math.round(p.buy.chaos * 10) / 10,
    days: defaultDays(p.name, baseDays.value),
    started: Date.now()
  }])
}
function editTracked (i: number, patch: Partial<TrackedGem>) {
  setTracked(tracked.value.map((t, j) => {
    if (j !== i) return t
    const next = { ...t, ...patch }
    if (!Number.isFinite(next.paid) || next.paid < 0) next.paid = t.paid
    if (!Number.isFinite(next.days) || next.days <= 0) next.days = t.days
    return next
  }))
}
function removeTracked (i: number) { setTracked(tracked.value.filter((_, j) => j !== i)) }
const now = Date.now()
const trackedRows = computed(() => tracked.value.map(t => ({ t, day: dayOf(t.started, now), plan: trackedPlan(t, all.value, prismPrice.value) })))
const trackedTotal = computed(() => trackedRows.value.reduce((a, r) => a + (r.plan?.profit ?? 0), 0))
</script>
