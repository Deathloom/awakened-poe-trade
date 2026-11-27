<template>
  <!-- Deathloom fork (Q21, 27 Nov 2026): boss readiness card. The active build's
       saved PoB stats against a rule-of-thumb bar per pinnacle boss, plus the
       fight's main mechanics. Stats come from the build file (as last saved in
       PoB); nothing is read from the game or GGG's site. -->
  <div class="rounded px-2 py-1.5 mb-2 bg-gray-900">
    <div class="lg-head flex items-baseline"><i class="fas fa-skull mr-1 text-gray-500" />
      <span>Boss readiness</span>
      <span class="ml-2 text-gray-600 normal-case">rule of thumb</span>
      <button class="ml-auto ui-btn ui-btn-quiet text-xs" :class="{ 'ui-btn-on': uber }" title="Show the uber versions instead" @click="setUber(!uber)">Uber</button>
      <button class="ml-1 ui-btn ui-btn-quiet text-xs" :disabled="notesBusy" title="Read the build file again (after saving in Path of Building)" @click="loadNotes()">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': notesBusy }" /></button>
    </div>
    <div v-if="notesError" class="text-xs text-gray-400">{{ notesError }}</div>
    <div v-else-if="!stats" class="text-xs text-gray-500">
      {{ notesState ? 'This build has no saved stats yet: open it in Path of Building and save it once.' : 'Reading the build file…' }}</div>
    <template v-else>
      <div v-for="r of rows" :key="r.boss.id" class="border-t border-gray-800 first:border-t-0">
        <button type="button" class="w-full flex items-baseline gap-x-2 py-px text-left" @click="open = open === r.boss.id ? '' : r.boss.id">
          <i class="fas text-xs w-3 text-gray-600" :class="open === r.boss.id ? 'fa-caret-down' : 'fa-caret-right'" />
          <span class="truncate min-w-0 text-gray-200">{{ r.boss.name }}</span>
          <i v-if="beaten(r.boss)" class="fas fa-check text-xs text-green-400" title="Ticked as beaten in Reference → Tracking → Checklist" />
          <span class="ml-auto shrink-0 text-xs" :class="VERDICT_CLASS[r.verdict]" :title="failing(r)">{{ VERDICT_LABEL[r.verdict] }}</span>
        </button>
        <div v-if="open === r.boss.id" class="pl-5 pb-1 text-xs">
          <div v-for="c of r.checks" :key="c.id" class="flex items-baseline gap-x-2">
            <i class="fas w-3" :class="c.ok == null ? 'fa-question text-gray-600' : c.ok ? 'fa-check text-green-400' : 'fa-times text-red-400'" />
            <span class="w-36 shrink-0 text-gray-400">{{ c.label }}</span>
            <span :class="c.ok === false ? 'text-gray-200' : 'text-gray-400'">{{ c.have }}</span>
            <span class="text-gray-600">want {{ c.want }}</span>
          </div>
          <div class="text-gray-500 mt-0.5">Main hits: {{ r.boss.hits.join(', ').toLowerCase() }}</div>
          <ul class="list-disc pl-4 text-gray-400">
            <li v-for="m of r.boss.mechanics" :key="m">{{ m }}</li>
          </ul>
        </div>
      </div>
      <div class="lg-sub">From the build's stats as last saved in Path of Building ({{ buildName }}). The bars are rules of thumb, not GGG numbers; a good dodge beats a big max hit.</div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import { useLeagues } from '@/web/background/Leagues'
import { loadNotes, notesBusy, notesError, notesState, buildLabel } from './build-notes'
import { loadProgress } from '../cheats/progress'
import { readinessAll, VERDICT_LABEL, type Boss, type Readiness, type Verdict } from './boss-readiness'

const UBER_KEY = 'deathloom.boss-readiness.uber.v1'
const uber = ref((() => { try { return localStorage.getItem(UBER_KEY) === '1' } catch { return false } })())
function setUber (v: boolean) {
  uber.value = v
  try { localStorage.setItem(UBER_KEY, v ? '1' : '0') } catch {}
}
const open = ref('')

if (!notesState.value) loadNotes()
// the active build changed in another panel or window
const lsBuilds = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => { if (e.ok) loadNotes() })
onUnmounted(() => { lsBuilds.abort() })

// a build never saved in PoB has no stats
const stats = computed(() => {
  const s = notesState.value?.profile?.stats
  return s && Object.keys(s).length ? s : null
})
const buildName = computed(() => notesState.value ? buildLabel(notesState.value.build) : '')
const rows = computed<Readiness[]>(() => stats.value ? readinessAll(stats.value, uber.value) : [])

// "beaten" ticks from the league checklist (read only)
const leagues = useLeagues()
const ticks = ref(loadProgress(leagues.selectedId.value ?? ''))
watch(() => leagues.selectedId.value, (l) => { ticks.value = loadProgress(l ?? '') })
const onStorage = (e: StorageEvent) => { if (e.key === 'deathloom.endgame-progress.v1') ticks.value = loadProgress(leagues.selectedId.value ?? '') }
window.addEventListener('storage', onStorage)
onUnmounted(() => { window.removeEventListener('storage', onStorage) })
const beaten = (b: Boss) => b.progressId != null && ticks.value.has(b.progressId)

const VERDICT_CLASS: Record<Verdict, string> = { ready: 'text-green-400', close: 'text-yellow-400', not: 'text-red-400', unknown: 'text-gray-500' }
const failing = (r: Readiness) => r.checks.filter(c => c.ok === false).map(c => `${c.label}: ${c.have} (want ${c.want})`).join('\n')
</script>
