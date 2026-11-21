<template>
  <!-- Deathloom fork (Q8): deaths and pace log. Act splits, deaths and levels per
       hour of this character, next to an earlier fresh start saved on this PC. -->
  <div class="rounded px-1 py-1 mb-1 bg-gray-900 text-xs">
    <div class="lg-head flex items-baseline gap-x-1">
      <button class="flex items-baseline min-w-0 hover:text-gray-100" :title="open ? 'Hide' : 'Show the pace log'" @click="toggleOpen">
        <i class="fas fa-flag-checkered mr-1 text-gray-500" />
        <span class="truncate">Pace<template v-if="run"> · {{ run.name }}</template></span>
        <i class="fas ml-1 text-gray-600" :class="open ? 'fa-chevron-up' : 'fa-chevron-down'" />
      </button>
      <span v-if="!open && run && headDelta" class="font-mono" :class="headDelta.delta <= 0 ? 'text-green-400' : 'text-red-300'">
        act {{ headDelta.act }} {{ fmtDelta(headDelta.delta) }}</span>
      <div class="ml-auto flex items-center gap-x-1">
        <button class="ui-btn ui-btn-quiet text-xs" :class="{ 'ui-btn-on': legend }" title="What these numbers mean" @click="legend = !legend"><i class="fas fa-question" /></button>
        <UiMenu :items="menu" title="Compare with, forget runs" button-class="ui-btn-quiet text-xs" align-right />
      </div>
    </div>
    <div v-if="legend" class="text-gray-500 py-1">
      From Client.txt only. <b>Campaign time</b> counts time in acts 1–10 between zone changes (gaps over 20 minutes don't count).
      <b>Levels/h</b> is levels gained per hour of campaign time: the log has no experience numbers, so this is not XP/h.
      <b>Reached</b> is the campaign time when you first entered the act; <b>vs</b> is the difference to the run you compare with
      (green: faster). Deaths are only your character's ("… has been slain"). A run is saved for each character followed from
      level 2, on this PC only (up to {{ MAX_RUNS }}: the newest, and always your best); nothing is sent anywhere.
      Characters made before this version: Levelling → Rebuild from game log fills in their levels.
    </div>
    <div v-if="askForget && run" class="flex items-center gap-x-2 py-1 text-gray-300">
      Forget the pace run of {{ run.name }}?
      <button class="ui-btn text-xs" @click="doForget">Forget</button>
      <button class="ui-btn ui-btn-quiet text-xs" @click="askForget = false">Keep</button>
    </div>
    <template v-if="open">
      <div v-if="!run" class="text-gray-600">
        No run for this character yet: runs start with characters followed from level 2 (or Rebuild from game log).
      </div>
      <template v-else>
        <div class="flex flex-wrap gap-x-4 text-gray-300">
          <span>Campaign: {{ run.campaignMs ? fmtClock(run.campaignMs) : '–' }}</span>
          <span title="Levels per hour of campaign time (not XP/h: the log has no experience numbers)">
            Levels/h: {{ fmtRate(rate) }}<span v-if="other" class="text-gray-500"> ({{ fmtRate(refRate) }} then)</span></span>
          <span>Deaths: {{ run.deaths }}<span v-if="other" class="text-gray-500"> ({{ refDeathsSoFar }} by act {{ lastAct(run) }} then)</span></span>
          <span v-if="other" class="text-gray-500" :title="refTitle">vs {{ refLabel }}</span>
        </div>
        <table v-if="rows.length" class="mt-1 text-gray-300">
          <tr class="text-gray-500">
            <th class="text-left pr-3 font-normal">Act</th>
            <th class="text-right pr-3 font-normal">Reached</th>
            <th v-if="other" class="text-right pr-3 font-normal">vs</th>
            <th class="text-right pr-3 font-normal" title="Character level when you entered the act (then: the compared run)">Level</th>
            <th class="text-right font-normal" title="Deaths in this act (then: the compared run)">Deaths</th>
          </tr>
          <tr v-for="r of rows" :key="r.act">
            <td class="pr-3">{{ r.act }}</td>
            <td class="text-right pr-3 font-mono">{{ r.at != null ? fmtClock(r.at) : '–' }}</td>
            <td v-if="other" class="text-right pr-3 font-mono" :class="r.delta == null ? 'text-gray-600' : r.delta <= 0 ? 'text-green-400' : 'text-red-300'"
              :title="r.refAt != null ? `Then: ${fmtClock(r.refAt)}` : 'Not reached then'">
              {{ r.delta != null ? fmtDelta(r.delta) : r.refAt != null ? fmtClock(r.refAt) : '–' }}</td>
            <td class="text-right pr-3 font-mono">{{ r.level || '–' }}<span v-if="other" class="text-gray-600"> / {{ r.refLevel || '–' }}</span></td>
            <td class="text-right font-mono">{{ r.at != null ? r.deaths : '–' }}<span v-if="other" class="text-gray-600"> / {{ r.refAt != null ? r.refDeaths : '–' }}</span></td>
          </tr>
        </table>
        <div v-if="!run.startAt" class="text-gray-600">Started before this version: level times fill in from now on (or Rebuild from game log).</div>
        <div v-if="!other" class="text-gray-600">No earlier run to compare with yet: your next fresh start will be compared with this one.</div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref as vref, watch } from 'vue'
import type { CharLevels } from './char-level'
import UiMenu, { type UiMenuItem } from '../ui/UiMenu.vue'
import {
  PACE_KEY, MAX_RUNS, loadPaceStore, savePaceStore, forgetRun, bestRun, latestRun, lastAct,
  levelsPerHour, paceRows, fmtClock, fmtDelta, type PaceStore, type PaceRun
} from './pace-log'

const props = defineProps<{ levels: CharLevels, charName: string | undefined }>()

const store = vref<PaceStore>(loadPaceStore())
const reload = () => { store.value = loadPaceStore() }
// the level recorder (overlay window) and this window's Rebuild both write the store
watch(() => props.levels, reload)
const onStorage = (e: StorageEvent) => { if (e.key === PACE_KEY) reload() }
window.addEventListener('storage', onStorage)
onUnmounted(() => window.removeEventListener('storage', onStorage))

// per-viewer choices (this PC's window only)
const OPEN_KEY = 'deathloom.pace.open.v1'
const CMP_KEY = 'deathloom.pace.compare.v1'
const readKey = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d } catch { return d } }
const writeKey = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }
const open = vref(readKey(OPEN_KEY, '1') === '1')
function toggleOpen () { open.value = !open.value; writeKey(OPEN_KEY, open.value ? '1' : '0') }
const legend = vref(false)
// 'best' | 'last' | a run id
const compare = vref(readKey(CMP_KEY, 'best'))
function setCompare (v: string) { compare.value = v; writeKey(CMP_KEY, v) }

const run = computed<PaceRun | null>(() => {
  const mine = store.value.runs.filter(r => r.name === props.charName)
  return mine.sort((a, b) => b.startAt - a.startAt)[0] ?? null
})
const other = computed<PaceRun | null>(() => {
  const runs = store.value.runs
  const except = run.value?.id
  if (compare.value === 'last') return latestRun(runs, except)
  if (compare.value !== 'best') {
    const r = runs.find(r => r.id === compare.value && r.id !== except)
    if (r) return r
  }
  return bestRun(runs, except)
})
const runLabel = (r: PaceRun) => `${r.name}${r.cls ? ` (${r.cls})` : ''}${r.startAt ? `, ${new Date(r.startAt).toLocaleDateString()}` : ''}`
const refLabel = computed(() => other.value ? runLabel(other.value) : '')
const refTitle = computed(() => other.value ? `Compared with ${runLabel(other.value)}: reached act ${lastAct(other.value)}, level ${other.value.level}, ${other.value.deaths} deaths. ⋯ to pick another run.` : '')

const rows = computed(() => run.value ? paceRows(run.value, other.value) : [])
const rate = computed(() => run.value ? levelsPerHour(run.value) : null)
// the compared run's rate over the same campaign time
const refRate = computed(() => other.value && run.value ? levelsPerHour(other.value, Math.max(run.value.campaignMs, 1)) : null)
const refDeathsSoFar = computed(() => {
  if (!other.value || !run.value) return 0
  const upTo = lastAct(run.value)
  return Object.entries(other.value.deathsByAct).filter(([a]) => Number(a) <= upTo).reduce((n, [, d]) => n + d, 0)
})
// the latest act both runs reached, for the closed header
const headDelta = computed(() => {
  const last = [...rows.value].reverse().find(r => r.delta != null)
  return last ? { act: last.act, delta: last.delta! } : null
})
const askForget = vref(false)
function doForget () {
  askForget.value = false
  if (!run.value) return
  store.value = forgetRun(store.value, run.value.id)
  savePaceStore(store.value)
}
function fmtRate (v: number | null) { return v == null ? '–' : v.toFixed(1) }

const menu = computed<UiMenuItem[]>(() => {
  const items: UiMenuItem[] = [
    { label: 'Compare with your best run', checked: compare.value === 'best', hint: 'The earlier run that got furthest, fastest', action: () => setCompare('best') },
    { label: 'Compare with your last run', checked: compare.value === 'last', hint: 'The most recent earlier start', action: () => setCompare('last') }
  ]
  const others = store.value.runs.filter(r => r.id !== run.value?.id)
  if (others.length) items.push({ divider: true })
  for (const r of others) {
    items.push({ label: `${runLabel(r)} · act ${lastAct(r)}`, checked: compare.value === r.id, action: () => setCompare(r.id) })
  }
  items.push({ divider: true })
  items.push({
    label: 'Forget this run',
    icon: 'fas fa-trash-alt',
    disabled: !run.value,
    hint: 'Removes this character\'s run from the pace log (on this PC). The character\'s other levelling data stays.',
    action: () => { askForget.value = true }
  })
  return items
})
</script>
