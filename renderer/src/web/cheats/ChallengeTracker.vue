<template>
  <!-- Deathloom fork (Q2): league challenges (Cheat sheets → Challenges). List from
       challenges.ts; ticks are manual, per league, on this PC (nothing read from GGG). -->
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-1">
      <span class="text-gray-100 mr-1" :title="`Challenges ticked for ${leagueKey || 'no league picked'}`">{{ done }}/{{ CHALLENGE_TOTAL }}</span>
      <button v-for="f of FILTERS" :key="f.id" class="ui-tab" :class="{ 'ui-tab-on': filter === f.id }" @click="setFilter(f.id)">{{ f.label }}</button>
      <button class="ui-btn ui-btn-quiet ml-auto" :class="{ 'text-gray-100': helpOpen }" title="About this list" @click="helpOpen = !helpOpen">?</button>
      <UiMenu :items="menu" align-right title="More" />
    </div>
    <div v-if="helpOpen" class="text-gray-500 space-y-1">
      <div>{{ CHALLENGE_LEAGUE_LABEL }} challenges. Tick what you've done: the game doesn't tell the app, and nothing is read from your account.
        Ticks are saved on this PC for the league picked in Settings ({{ leagueKey || 'none' }}); a new league starts empty.
        Softcore, Hardcore and SSF share one list (like in game); Ruthless has its own.</div>
      <div>Click a name for the steps and a tip; tick steps to keep count. <i class="fas fa-arrow-right" /> opens the cheat sheet with the matching facts.</div>
      <div>List cross-checked on {{ CHALLENGES_CHECKED }} between
        <template v-for="(s, k, i) in CHALLENGE_SOURCES" :key="k"><template v-if="i">, </template><a :href="s.url" target="_blank" rel="noopener noreferrer" class="underline">{{ s.label }}</a></template>.
        Tips are ours. GGG can change challenges; their own challenge page in game wins.</div>
    </div>
    <div v-if="confirmClear" class="flex flex-wrap items-center gap-1 text-gray-300">
      Untick every challenge and step for {{ leagueKey || 'this league' }}?
      <button class="ui-btn" @click="clearLeague">Untick all</button>
      <button class="ui-btn ui-btn-quiet" @click="confirmClear = false">Keep</button>
    </div>
    <div v-if="otherLeague" class="text-gray-500"><i class="fas fa-info-circle mr-1" />These are the {{ CHALLENGE_LEAGUE }} challenges; ticks are saved for {{ leagueKey }}.</div>
    <div v-if="missing" class="text-gray-500"><i class="fas fa-info-circle mr-1" />{{ missing }} of the {{ CHALLENGE_TOTAL }} challenges aren't in this list yet.</div>

    <div v-for="c of shown" :key="c.id" class="border-t border-gray-700 pt-1">
      <div class="flex items-baseline gap-x-1.5">
        <input type="checkbox" :checked="ticks.has(c.id)" :title="ticks.has(c.id) ? 'Done (click to untick)' : 'Tick when done'" @change="toggle(c.id)">
        <button class="text-left flex-1" :class="ticks.has(c.id) ? 'text-gray-500 line-through' : 'text-gray-100'" :aria-expanded="open.has(c.id)" @click="flip(c.id)">
          <span class="text-gray-500 no-underline">{{ CHALLENGES.indexOf(c) + 1 }}.</span> {{ c.name }}
        </button>
        <span v-if="c.steps?.length" class="text-gray-500" title="Steps ticked / needed">{{ Math.min(stepsDone(ticks, c), stepsNeeded(c)) }}/{{ stepsNeeded(c) }}</span>
        <i class="fas text-gray-600 text-xs" :class="open.has(c.id) ? 'fa-chevron-up' : 'fa-chevron-down'" />
      </div>
      <div v-if="open.has(c.id)" class="pl-5 space-y-0.5">
        <div class="text-gray-300">{{ c.req }}</div>
        <label v-for="(s, i) of c.steps ?? []" :key="i" class="flex items-baseline gap-x-1.5 cursor-pointer"
          :class="ticks.has(stepId(c, i)) ? 'text-gray-500 line-through' : 'text-gray-400'">
          <input type="checkbox" :checked="ticks.has(stepId(c, i))" @change="toggle(stepId(c, i))">
          <span>{{ s }}</span>
        </label>
        <div v-if="c.tip" class="text-gray-400"><i class="fas fa-lightbulb mr-1 text-gray-500" />{{ c.tip }}</div>
        <div v-if="c.tab || c.where" class="flex flex-wrap items-center gap-1">
          <button v-if="c.tab" class="ui-btn ui-btn-quiet" @click="emit('open-tab', c.tab)"><i class="fas fa-arrow-right mr-1" />{{ tabLabel(c.tab) }}</button>
          <span v-if="c.where" class="text-gray-500">· {{ c.where }}</span>
        </div>
      </div>
    </div>
    <div v-if="!shown.length" class="text-gray-500">{{ filter === 'done' ? 'Nothing ticked yet for this league.' : 'All done. Well played!' }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UiMenu, { type UiMenuItem } from '../ui/UiMenu.vue'
import { useLeagues } from '@/web/background/Leagues'
import { SHEETS, OWN_TABS } from './sheets'
import {
  CHALLENGES, CHALLENGE_TOTAL, CHALLENGE_LEAGUE, CHALLENGE_LEAGUE_LABEL, CHALLENGE_SOURCES, CHALLENGES_CHECKED,
  type ChallengeFilter, challengeLeagueKey, challengesMissing, doneCount, filterChallenges,
  loadChallengeTicks, saveChallengeTicks, stepId, stepsDone, stepsNeeded, toggleTick
} from './challenges'

const emit = defineEmits<{ (e: 'open-tab', id: string): void }>()

const FILTERS: Array<{ id: ChallengeFilter, label: string }> = [{ id: 'all', label: 'All' }, { id: 'todo', label: 'To do' }, { id: 'done', label: 'Done' }]
const FILTER_KEY = 'deathloom.cheats.challenges-filter.v1'
const filter = ref<ChallengeFilter>((() => {
  try { const f = localStorage.getItem(FILTER_KEY); return FILTERS.some(x => x.id === f) ? f as ChallengeFilter : 'todo' } catch { return 'todo' }
})())
function setFilter (f: ChallengeFilter) {
  filter.value = f
  try { localStorage.setItem(FILTER_KEY, f) } catch {}
}
const helpOpen = ref(false)

const leagues = useLeagues()
const league = computed(() => leagues.selectedId.value ?? '')
const leagueKey = computed(() => challengeLeagueKey(league.value))
const otherLeague = computed(() => !!leagueKey.value && leagueKey.value !== CHALLENGE_LEAGUE)
const ticks = ref(loadChallengeTicks(league.value))
watch(league, (l) => { ticks.value = loadChallengeTicks(l) })
function toggle (id: string) {
  // re-read first: another window (overlay / desktop) may have ticked something
  ticks.value = toggleTick(loadChallengeTicks(league.value), id)
  saveChallengeTicks(league.value, ticks.value)
}

const done = computed(() => doneCount(ticks.value))
const shown = computed(() => filterChallenges(ticks.value, filter.value))
const missing = challengesMissing()

const open = ref(new Set<string>())
function flip (id: string) {
  const s = new Set(open.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  open.value = s
}

const tabLabel = (id: string) => [...SHEETS, ...OWN_TABS].find(t => t.id === id)?.label ?? id

const confirmClear = ref(false)
function clearLeague () {
  confirmClear.value = false
  ticks.value = new Set()
  saveChallengeTicks(league.value, ticks.value)
}
const menu = computed<UiMenuItem[]>(() => [
  { label: 'Open all', icon: 'fas fa-folder-open', action: () => { open.value = new Set(shown.value.map(c => c.id)) } },
  { label: 'Close all', icon: 'fas fa-folder', action: () => { open.value = new Set() } },
  { divider: true },
  { label: 'Untick all for this league', icon: 'fas fa-undo', disabled: !ticks.value.size, action: () => { confirmClear.value = true } }
])
</script>
