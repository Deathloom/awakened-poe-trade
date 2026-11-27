<template>
  <!-- Deathloom fork (20 Nov): farming profit — profit per hour per strategy / league mechanic,
       from the maps This session tracked and the loot typed in there -->
  <div class="flex flex-col h-full min-h-0 text-xs">
    <div class="flex flex-wrap items-center gap-2 px-2 py-1 shrink-0">
      <label class="flex items-center gap-1 flex-1 min-w-[12rem]" title="What you're farming now (e.g. 'Breach + Wombgifts'). New maps get this label.">
        <span class="text-gray-400 shrink-0">Farming now:</span>
        <input v-model="strategy" list="farm-strategies" class="flex-1 min-w-0 bg-gray-900 rounded px-1 py-0.5" placeholder="Name your strategy" spellcheck="false" @change="setStrategy">
        <datalist id="farm-strategies"><option v-for="s of known" :key="s" :value="s" /></datalist>
      </label>
      <div class="flex gap-px">
        <button class="ui-tab" :class="{ 'ui-tab-on': by === 'strategy' }" @click="by = 'strategy'">By strategy</button>
        <button class="ui-tab" :class="{ 'ui-tab-on': by === 'mechanic' }" @click="by = 'mechanic'">By mechanic</button>
      </div>
      <select v-model="range" class="bg-gray-900 rounded px-1 py-0.5" title="Which maps count">
        <option value="league">This league</option>
        <option value="7d">Last 7 days</option>
        <option value="all">Everything</option>
      </select>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto px-2">
      <!-- Deathloom fork (Q19): weekly report card + profit-drop nudge -->
      <farm-nudge class="py-1" :runs="allRuns" :strategy="strategy" />
      <div v-if="week" class="my-1 p-1.5 rounded border border-gray-700 bg-gray-900 space-y-0.5">
        <div class="flex items-baseline gap-2">
          <span class="text-gray-300">Last 7 days</span>
          <span class="text-gray-500">{{ week.maps }} map{{ week.maps === 1 ? '' : 's' }} · {{ week.hours.toFixed(1) }} h</span>
          <span class="ml-auto font-mono" :class="week.profit < 0 ? 'text-red-400' : 'text-yellow-300'" title="Loot minus map costs">{{ money(week.profit) }}</span>
          <span class="font-mono" :class="week.perHour < 0 ? 'text-red-400' : 'text-yellow-300'">{{ money(week.perHour) }}/h</span>
        </div>
        <div v-if="week.prev" class="text-gray-500">
          Week before: {{ week.prev.maps }} maps, {{ money(week.prev.perHour) }}/h<template v-if="week.change != null">
            · <span :class="week.change < 0 ? 'text-red-400' : 'text-green-300'">{{ week.change < 0 ? '▼' : '▲' }} {{ Math.abs(Math.round(week.change * 100)) }} % per hour</span></template>
        </div>
        <div v-if="week.strategies.length" class="flex flex-wrap gap-x-3 text-gray-400">
          <span v-for="(s, i) of week.strategies.slice(0, 4)" :key="s.name" :class="{ 'text-green-300': i === 0 && week.strategies.length > 1 }">{{ s.name }} {{ money(s.perHour) }}/h <span class="text-gray-600">({{ s.maps }})</span></span>
        </div>
        <div v-if="week.tip" class="text-gray-300"><i class="fas fa-lightbulb mr-1 text-gray-500" />{{ week.tip }}</div>
      </div>
      <div v-if="!stats.length" class="text-gray-500 py-1">
        No maps with loot yet. Play maps with This session open and add each map's loot there (+10c, +50c, +1 div or type it). Then the profit per hour of each strategy shows up here.
      </div>
      <table v-else class="w-full">
        <tr class="text-gray-500 sticky top-0 bg-gray-800">
          <th class="text-left font-normal">{{ by === 'strategy' ? 'Strategy' : 'Mechanic' }}</th>
          <th class="text-right font-normal pr-2">Maps</th>
          <th class="text-right font-normal pr-2" title="Average minutes per map">Min/map</th>
          <th class="text-right font-normal pr-2" title="Loot minus map cost, per map">Per map</th>
          <th class="text-right font-normal">Per hour</th>
        </tr>
        <tr v-for="(s, i) of stats" :key="s.name" class="border-t border-gray-800" :class="{ 'text-green-300': i === 0 && stats.length > 1 && s.perHour > 0 }">
          <td class="truncate max-w-0 w-full" :title="s.name">{{ s.name }}</td>
          <td class="text-right pr-2">{{ s.maps }}</td>
          <td class="text-right pr-2">{{ s.minutesPerMap.toFixed(1) }}</td>
          <td class="text-right pr-2 font-mono" :class="s.perMap < 0 ? 'text-red-400' : ''">{{ money(s.perMap) }}</td>
          <td class="text-right font-mono" :class="s.perHour < 0 ? 'text-red-400' : 'text-yellow-300'">{{ money(s.perHour) }}</td>
        </tr>
      </table>
      <div v-if="stats.length && few" class="text-gray-500 py-1">Fewer than 10 maps per row: one lucky drop moves the numbers a lot.</div>
    </div>
    <div class="px-2 py-1 text-gray-500 shrink-0">
      <i class="fas fa-info-circle mr-1" />Profit = the loot you add in This session minus Cost/map. Mechanics come from the NPCs you hear in the map. Kept on this PC.
    </div>
  </div>
</template>

<script setup lang="ts">
import { gameKey } from '../game-storage'
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useMarket } from './use-market'
import FarmNudge from './FarmNudge.vue'
import { weeklyReport, FARM_RUNS_KEY, FARM_STRATEGY_KEY, farmingStats, loadFarmRuns, loadStrategy, mergeRuns, runsFromSession, saveStrategy } from './market-tools'
import { PLAY_SESSION_KEY, loadMapCost, loadPlaySession } from '../companion/play-session'

const { money, league } = useMarket()
const strategy = ref(loadStrategy())
function setStrategy () { saveStrategy(strategy.value) }
const by = ref<'strategy' | 'mechanic'>('strategy')
const range = ref<'league' | '7d' | 'all'>('league')

const archived = shallowRef(loadFarmRuns())
const session = shallowRef(loadPlaySession())
function onStorage (e: StorageEvent) {
  if (e.key === gameKey(FARM_RUNS_KEY)) archived.value = loadFarmRuns()
  if (e.key === gameKey(PLAY_SESSION_KEY)) session.value = loadPlaySession()
  if (e.key === FARM_STRATEGY_KEY) strategy.value = loadStrategy()
}
// the session panel saves often; re-read now and then too (same window doesn't get storage events).
// Only while the window is shown; catch up as soon as it is shown again.
function reload () { session.value = loadPlaySession(); archived.value = loadFarmRuns() }
function onVisibility () { if (!document.hidden) reload() }
const timer = setInterval(() => { if (!document.hidden) reload() }, 30_000)
onMounted(() => {
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onVisibility)
})
onUnmounted(() => {
  window.removeEventListener('storage', onStorage)
  document.removeEventListener('visibilitychange', onVisibility)
  clearInterval(timer)
})

// runs archived before this feature have no league: count them under "this league" only by date
const allRuns = computed(() => mergeRuns(archived.value, runsFromSession(session.value.maps, loadMapCost(), league.value ?? undefined)))
const runs = computed(() => {
  let list = allRuns.value
  if (range.value === '7d') list = list.filter(r => r.at >= Date.now() - 7 * 86_400_000)
  if (range.value === 'league') list = list.filter(r => !r.league || r.league === league.value)
  return list
})
// recomputed with the 30 s reload (session changes), so "now" moves along
const week = computed(() => weeklyReport(allRuns.value, Date.now()))
const stats = computed(() => farmingStats(runs.value, by.value))
const few = computed(() => stats.value.some(s => s.maps < 10))
const known = computed(() => [...new Set(archived.value.map(r => r.strategy).filter(s => s && s !== 'No strategy set'))].sort())
</script>
