<template>
  <!-- Deathloom fork: this play session from Client.txt (Orbhoarder window) -->
  <div class="flex flex-col h-full min-h-0 rounded bg-gray-800 text-xs">
    <div class="flex items-baseline px-2 py-1 border-b border-gray-700">
      <span class="lg-head"><i class="fas fa-stopwatch mr-1 text-gray-500" />This session</span>
      <span class="ml-2 text-gray-500">since {{ clock(s.start) }} · {{ dur(Math.max(0, s.lastAt - s.start)) }}</span>
      <!-- stopwatch you start yourself (replaces the old Stopwatch widget) -->
      <span class="ml-auto flex items-center gap-x-1 text-gray-300" title="Stopwatch: start and pause it yourself">
        <i class="fas fa-hourglass-half text-gray-500" />{{ dur(watchMs) }}
        <button class="ui-btn ui-btn-quiet px-0.5" :title="watch.startedAt ? 'Pause the stopwatch' : 'Start the stopwatch'" @click="toggleWatch">
          <i class="fas" :class="watch.startedAt ? 'fa-pause' : 'fa-play'" /></button>
      </span>
      <UiMenu class="ml-1" :items="menuItems" title="More: reset the stopwatch, start a new session" align-right />
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-1">
      <div class="flex flex-wrap gap-x-4 text-gray-300">
        <span>Maps: {{ maps.length }}<span v-if="avgMap" class="text-gray-500"> · avg {{ dur(avgMap) }}</span></span>
        <span v-if="perHour" title="Maps finished per hour of map time">{{ perHour }}/h</span>
        <span :class="s.deaths ? 'text-red-300' : ''">Deaths: {{ s.deaths }}</span>
        <span title="Trades this session. What you sold and bought, with prices: Trade companion → Ledger.">Trades: {{ s.trades }}</span>
        <span v-if="pace" :title="pace.title">Levelling: {{ pace.text }}</span>
        <span v-if="profit.perHour != null" class="text-yellow-300" :title="`Loot ${money(profit.loot)} − map costs ${money(profit.cost)}, per hour of map time`">
          Profit: {{ money(profit.perHour) }}/h</span>
      </div>

      <!-- Map profit: loot value per map, typed in (nothing is read from the game but the log) -->
      <div v-if="lootTarget" class="flex flex-wrap items-center gap-1">
        <span class="lg-sub mr-1" :title="'Add what this map dropped (your estimate). ' + (current ? 'Current map.' : 'Last map.')">
          Loot{{ current ? '' : ' (last map)' }}:</span>
        <span class="text-yellow-300 mr-1">{{ money(lootTarget.loot ?? 0) }}</span>
        <button v-for="b of LOOT_STEPS" :key="b" class="ui-btn" @click="addLoot(b)">+{{ b }}c</button>
        <button v-if="divine" class="ui-btn" :title="`1 divine = ${Math.round(divine)} c`" @click="addLoot(divine)">+1 div</button>
        <input v-model.number="lootInput" type="number" min="0" class="w-14 bg-gray-900 rounded px-1" placeholder="c" title="Type an amount in chaos and press Enter"
          @keydown.enter="lootInput && addLoot(lootInput); lootInput = null">
        <button v-if="lootTarget.loot" class="ui-btn" title="Clear this map's loot" @click="setLoot(0)"><i class="fas fa-undo" /></button>
        <span class="ml-auto text-gray-500" title="What running one map costs you (map, threads, astrolabes…), taken off the profit">
          Cost/map <input :value="cost || ''" type="number" min="0" class="w-12 bg-gray-900 rounded px-1" placeholder="0" @change="setCost(($event.target as HTMLInputElement).valueAsNumber)"> c</span>
      </div>

      <div v-if="current" class="text-gray-200">
        <span class="lg-sub">Now:</span> {{ current.name || current.code }}
        <span class="text-gray-500">(area level {{ current.level }})</span>
        <span class="ml-1 font-mono">{{ dur(currentMs ?? 0) }}</span>
        <span v-for="m of current.mechanics" :key="m" class="ml-1 px-1 rounded bg-gray-700 text-gray-200">{{ m }}</span>
      </div>

      <div v-if="mechanics.length" class="flex flex-wrap gap-1 items-baseline">
        <span class="lg-sub mr-1" title="Counted once per area, from the league NPC's voice lines">Mechanics:</span>
        <span v-for="[m, n] of mechanics" :key="m" class="px-1 rounded bg-gray-900 text-gray-300">{{ m }} ×{{ n }}</span>
      </div>

      <div v-if="recent.length">
        <div class="lg-sub">Last maps</div>
        <div v-for="r of recent" :key="r.seed + r.code" class="flex gap-x-2 text-gray-400">
          <span class="truncate flex-1 min-w-0">{{ r.name || r.code }} <span class="text-gray-600">{{ r.level }}</span></span>
          <span v-if="r.mechanics.length" class="truncate text-gray-500">{{ r.mechanics.join(', ') }}</span>
          <span v-if="r.deaths" class="text-red-300">{{ r.deaths }}✝</span>
          <span v-if="r.loot" class="text-yellow-300">{{ money(r.loot) }}</span>
          <span class="font-mono w-12 text-right">{{ dur(r.ms) }}</span>
        </div>
      </div>

      <div v-if="zones.length">
        <div class="lg-sub" title="Time in each area this session (town and hideout too; breaks over 20 min not counted)">Where the time went</div>
        <div class="flex flex-wrap gap-x-3 text-gray-400">
          <span v-for="z of zones" :key="z.name">{{ z.name }} <span class="font-mono text-gray-300">{{ dur(z.ms) }}</span></span>
        </div>
      </div>

      <div class="flex flex-wrap gap-x-4 text-gray-500">
        <span v-if="s.loads.length" :title="`Last ${s.loads.length} loading screens · slowest ${Math.max(...s.loads).toFixed(1)} s`">
          Loading: avg {{ avgLoad.toFixed(1) }} s ({{ s.loadCount }} screens)</span>
        <span v-if="s.disconnects.length" class="text-yellow-300" :title="s.disconnects.map(d => `${clock(d.at)} ${d.reason}`).join('\n')">
          Disconnects: {{ s.disconnects.length }} · last {{ clock(s.disconnects[s.disconnects.length - 1].at) }}</span>
      </div>

      <!-- Deathloom fork (Q19): your strategy earns less than it used to -->
      <farm-nudge :runs="farmRuns" :strategy="strategy" />

      <div v-for="h of hints" :key="h.text" :class="h.warn ? 'text-yellow-300' : 'text-gray-400'">
        <i class="fas fa-lightbulb mr-1" />{{ h.text }}</div>

      <!-- Summary of the session before this one -->
      <div v-if="last" class="rounded bg-gray-900 px-2 py-1">
        <button class="lg-sub w-full text-left" @click="lastOpen = !lastOpen">
          <i class="fas mr-1" :class="lastOpen ? 'fa-caret-down' : 'fa-caret-right'" />Last session: {{ day(last.start) }} {{ clock(last.start) }}–{{ clock(last.end) }}
          <span class="text-gray-500">({{ dur(last.end - last.start) }})</span></button>
        <div v-if="lastOpen" class="flex flex-wrap gap-x-4 text-gray-400 pt-1">
          <span>Maps: {{ last.maps }}<span v-if="last.maps" class="text-gray-500"> · avg {{ dur(last.mapMs / last.maps) }}</span></span>
          <span :class="last.deaths ? 'text-red-300' : ''">Deaths: {{ last.deaths }}</span>
          <span>Trades: {{ last.trades }}</span>
          <span v-if="last.loot" class="text-yellow-300">Profit: {{ money(last.loot - last.cost) }}<span v-if="last.mapMs > 5 * 60_000"> ({{ money((last.loot - last.cost) / (last.mapMs / 3600000)) }}/h)</span></span>
          <span v-for="l of last.levels" :key="l.char">{{ l.char }}: {{ l.from }} → {{ l.to }}</span>
          <span v-if="last.topZone">Most time: {{ last.topZone.name }} ({{ dur(last.topZone.ms) }})</span>
          <span v-if="last.mechanics.length">{{ last.mechanics.map(([m, n]) => `${m} ×${n}`).join(', ') }}</span>
        </div>
      </div>

      <div v-if="!maps.length && !s.loadCount" class="text-gray-600">
        Nothing yet this session. Maps, league mechanics, deaths and loading times show up here as you play (read from the game's log).
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { gameKey } from '../game-storage'
import { computed, onUnmounted, ref } from 'vue'
import {
  currentMapMs, topZones, emptySession, loadPlaySession, PLAY_SESSION_KEY, savePlaySession, sessionHints, type PlaySession,
  addMapLoot, mapProfit, loadMapCost, saveMapCost, MAP_COST_KEY, loadLastSession, keepLastSession, LAST_SESSION_KEY
} from './play-session'
import { usePoeninja } from '@/web/background/Prices'
import UiMenu, { type UiMenuItem } from '@/web/ui/UiMenu.vue'
import { CHAR_LEVELS_KEY, currentChar, loadCharLevels } from './char-level'
import FarmNudge from '@/web/market-history/FarmNudge.vue'
import { FARM_RUNS_KEY, FARM_STRATEGY_KEY, loadFarmRuns, loadStrategy, mergeRuns, runsFromSession } from '@/web/market-history/market-tools'

const s = ref<PlaySession>(loadPlaySession())
const me = ref(currentChar(loadCharLevels())?.name ?? '')
const now = ref(Date.now())
// live map timer: only while the window is shown and you're in a map (keeps
// the Orbhoarder window idle while you play)
const timer = setInterval(() => {
  if (document.visibilityState === 'visible' && (currentMapMs(s.value) != null || watch.value.startedAt)) now.value = Date.now()
}, 1000)

// Stopwatch (Deathloom fork: replaces the upstream Stopwatch widget). Kept per
// window in local storage; runs while the app is closed too (start time based).
const WATCH_KEY = 'orbhoarder.stopwatch'
interface Watch { startedAt: number | null, ms: number }
function loadWatch (): Watch {
  try {
    const w = JSON.parse(localStorage.getItem(WATCH_KEY) ?? 'null') as Watch | null
    if (w && typeof w.ms === 'number') return { startedAt: typeof w.startedAt === 'number' ? w.startedAt : null, ms: w.ms }
  } catch {}
  return { startedAt: null, ms: 0 }
}
const watch = ref<Watch>(loadWatch())
function saveWatch (w: Watch) {
  watch.value = w
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(w)) } catch {}
}
const watchMs = computed(() => watch.value.ms + (watch.value.startedAt ? Math.max(0, now.value - watch.value.startedAt) : 0))
function toggleWatch () {
  const t = Date.now()
  now.value = t
  const w = watch.value
  saveWatch(w.startedAt ? { startedAt: null, ms: w.ms + t - w.startedAt } : { startedAt: t, ms: w.ms })
}
function resetWatch () {
  now.value = Date.now()
  saveWatch({ startedAt: watch.value.startedAt ? Date.now() : null, ms: 0 })
}
const onStorage = (e: StorageEvent) => {
  if (e.key === gameKey(PLAY_SESSION_KEY)) s.value = loadPlaySession()
  if (e.key === CHAR_LEVELS_KEY) me.value = currentChar(loadCharLevels())?.name ?? ''
  if (e.key === MAP_COST_KEY) cost.value = loadMapCost()
  if (e.key === gameKey(LAST_SESSION_KEY)) last.value = loadLastSession()
  if (e.key === WATCH_KEY) watch.value = loadWatch()
  if (e.key === gameKey(FARM_RUNS_KEY)) archived.value = loadFarmRuns()
  if (e.key === FARM_STRATEGY_KEY) strategy.value = loadStrategy()
}
window.addEventListener('storage', onStorage)
onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('storage', onStorage)
})

// rare actions live in the ⋯ menu (calmer header, 20 Nov 2026)
const menuItems = computed<UiMenuItem[]>(() => [
  { label: 'Reset the stopwatch', icon: 'fas fa-undo', disabled: !watchMs.value, action: resetWatch },
  { divider: true },
  { label: 'Start a new session', icon: 'fas fa-redo', hint: 'A new one also starts after 2 hours without playing', action: reset }
])

function reset () {
  keepLastSession(loadPlaySession())
  last.value = loadLastSession()
  s.value = emptySession()
  savePlaySession(s.value)
}

const maps = computed(() => s.value.maps.filter(m => m.ms > 0 || m === s.value.maps[s.value.maps.length - 1]))
const currentMs = computed(() => currentMapMs(s.value, now.value))
const current = computed(() => currentMs.value != null ? s.value.maps[s.value.maps.length - 1] : null)
const done = computed(() => maps.value.filter(m => m !== current.value && m.ms > 0))
const avgMap = computed(() => done.value.length ? done.value.reduce((a, m) => a + m.ms, 0) / done.value.length : 0)
const perHour = computed(() => {
  const total = done.value.reduce((a, m) => a + m.ms, 0)
  return done.value.length >= 3 && total ? (done.value.length / (total / 3600000)).toFixed(1) : ''
})
const recent = computed(() => done.value.slice(-6).reverse())
const mechanics = computed(() => Object.entries(s.value.mechanics).sort((a, b) => b[1] - a[1]))
const avgLoad = computed(() => s.value.loads.length ? s.value.loads.reduce((a, b) => a + b, 0) / s.value.loads.length : 0)
const hints = computed(() => sessionHints(s.value, now.value))
const zones = computed(() => topZones(s.value, 8, now.value))

// Map profit
const LOOT_STEPS = [5, 20, 50]
const ninja = usePoeninja()
ninja.queuePricesFetch()
const divine = computed(() => ninja.xchgRate.value)
const cost = ref(loadMapCost())
const lootInput = ref<number | null>(null)
// the map loot goes on: the one you're in, else the last one finished
const lootTarget = computed(() => current.value ?? done.value[done.value.length - 1] ?? null)
function addLoot (chaos: number) {
  const t = lootTarget.value
  if (t && chaos > 0) s.value = addMapLoot(t.seed, t.code, chaos)
}
function setLoot (chaos: number) {
  const t = lootTarget.value
  if (t) s.value = addMapLoot(t.seed, t.code, chaos, true)
}
function setCost (v: number) {
  cost.value = Number.isFinite(v) && v > 0 ? v : 0
  saveMapCost(cost.value)
}
const profit = computed(() => mapProfit(s.value, cost.value, now.value))
// Q19: maps from earlier sessions plus this one, for the profit-drop nudge
const archived = ref(loadFarmRuns())
const strategy = ref(loadStrategy())
const farmRuns = computed(() => mergeRuns(archived.value, runsFromSession(s.value.maps, cost.value)))
function money (chaos: number) {
  const d = divine.value
  if (d && Math.abs(chaos) >= d) return `${(chaos / d).toFixed(1)} div`
  return `${Math.round(chaos)} c`
}

// Last session (summary)
const last = ref(loadLastSession())
const lastOpen = ref(false)
function day (at: number) {
  return new Date(at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
}

const pace = computed(() => {
  const list = s.value.levels[me.value]
  if (!list || list.length < 2) return null
  const last = list[list.length - 1]
  const prev = list[list.length - 2]
  const steps = list.slice(-6)
  const span = steps[steps.length - 1].at - steps[0].at
  const levels = steps[steps.length - 1].level - steps[0].level
  const perLevel = levels > 0 ? span / levels : 0
  return {
    text: `level ${last.level} took ${dur(Math.max(0, last.at - prev.at) / Math.max(1, last.level - prev.level))}` +
      (perLevel ? ` · ${(3600000 / perLevel).toFixed(1)} levels/h` : ''),
    title: perLevel ? `Last ${levels} levels: ${dur(perLevel)} per level (${(3600000 / perLevel).toFixed(1)} levels/hour)` : ''
  }
})

function dur (ms: number) {
  const sec = Math.round(ms / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const ss = String(sec % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
function clock (at: number) {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>
