<template>
  <!-- Deathloom fork: this play session from Client.txt (Loot Goblin window) -->
  <div class="flex flex-col h-full min-h-0 rounded bg-gray-800 text-xs">
    <div class="flex items-baseline px-2 py-1 border-b border-gray-700">
      <span class="lg-head"><i class="fas fa-stopwatch mr-1 text-gray-500" />This session</span>
      <span class="ml-2 text-gray-500">since {{ clock(s.start) }} · {{ dur(Math.max(0, s.lastAt - s.start)) }}</span>
      <button class="ml-auto text-gray-500 hover:text-gray-200" title="Start a new session (a new one also starts after 2 hours without playing)"
        @click="reset"><i class="fas fa-redo mr-1" />New session</button>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-1">
      <div class="flex flex-wrap gap-x-4 text-gray-300">
        <span>Maps: {{ maps.length }}<span v-if="avgMap" class="text-gray-500"> · avg {{ dur(avgMap) }}</span></span>
        <span v-if="perHour" title="Maps finished per hour of map time">{{ perHour }}/h</span>
        <span :class="s.deaths ? 'text-red-300' : ''">Deaths: {{ s.deaths }}</span>
        <span>Trades: {{ s.trades }}</span>
        <span v-if="pace" :title="pace.title">Levelling: {{ pace.text }}</span>
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
          <span class="font-mono w-12 text-right">{{ dur(r.ms) }}</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-x-4 text-gray-500">
        <span v-if="s.loads.length" :title="`Last ${s.loads.length} loading screens · slowest ${Math.max(...s.loads).toFixed(1)} s`">
          Loading: avg {{ avgLoad.toFixed(1) }} s ({{ s.loadCount }} screens)</span>
        <span v-if="s.disconnects.length" class="text-yellow-300" :title="s.disconnects.map(d => `${clock(d.at)} ${d.reason}`).join('\n')">
          Disconnects: {{ s.disconnects.length }} · last {{ clock(s.disconnects[s.disconnects.length - 1].at) }}</span>
      </div>

      <div v-for="h of hints" :key="h.text" :class="h.warn ? 'text-yellow-300' : 'text-gray-400'">
        <i class="fas fa-lightbulb mr-1" />{{ h.text }}</div>

      <div v-if="!maps.length && !s.loadCount" class="text-gray-600">
        Nothing yet this session. Maps, league mechanics, deaths and loading times show up here as you play (read from the game's log).
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { currentMapMs, emptySession, loadPlaySession, PLAY_SESSION_KEY, savePlaySession, sessionHints, type PlaySession } from './play-session'
import { CHAR_LEVELS_KEY, currentChar, loadCharLevels } from './char-level'

const s = ref<PlaySession>(loadPlaySession())
const me = ref(currentChar(loadCharLevels())?.name ?? '')
const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
const onStorage = (e: StorageEvent) => {
  if (e.key === PLAY_SESSION_KEY) s.value = loadPlaySession()
  if (e.key === CHAR_LEVELS_KEY) me.value = currentChar(loadCharLevels())?.name ?? ''
}
window.addEventListener('storage', onStorage)
onUnmounted(() => {
  clearInterval(timer)
  window.removeEventListener('storage', onStorage)
})

function reset () {
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
    text: `level ${last.level} took ${dur(Math.max(0, last.at - prev.at) / Math.max(1, last.level - prev.level))}`,
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
