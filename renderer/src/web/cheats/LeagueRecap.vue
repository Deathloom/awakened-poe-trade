<template>
  <!-- Deathloom fork (Q29, 27 Nov 2026): league recap card. One summary of what
       Orbhoarder kept on this PC for a league; Copy gives plain text for friends.
       Nothing is read from GGG's site, API or the game. -->
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-gray-400">League</span>
      <select v-model="picked" class="ui-input px-1 rounded bg-gray-900 border border-gray-700">
        <option v-for="l of leagueList" :key="l" :value="l">{{ l }}</option>
      </select>
      <button class="ui-btn ml-auto" :disabled="recap.empty" title="Copy the recap as text (for Discord or a chat with friends)" @click="copy(recapText(recap), 'recap')">
        <i class="far mr-1" :class="copiedKey === 'recap' ? 'fa-check' : 'fa-copy'" />Copy</button>
    </div>
    <div v-if="!leagueList.length" class="text-gray-500">No league picked and nothing kept yet.</div>
    <div v-else-if="recap.empty" class="text-gray-500">Nothing kept for {{ recap.league }} on this PC yet. Maps with loot typed in (This session), trades, the league checklist and challenge ticks all count.</div>
    <template v-else>
      <div v-if="recap.from" class="text-gray-400">{{ fmtDate(recap.from) }} to {{ fmtDate(recap.to) }} · {{ recap.days }} day{{ recap.days === 1 ? '' : 's' }}</div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div v-for="t of tiles" :key="t.label" class="rounded bg-gray-900 px-2 py-1">
          <div class="text-xs text-gray-500">{{ t.label }}</div>
          <div class="text-gray-100 text-base">{{ t.value }}</div>
          <div v-if="t.sub" class="text-xs text-gray-500">{{ t.sub }}</div>
        </div>
      </div>
      <div v-if="recap.characters.length">
        <div class="text-gray-100 font-semibold mb-0.5">Characters</div>
        <div v-for="c of recap.characters" :key="c.name" class="flex items-baseline gap-x-2 text-gray-300">
          <span>{{ c.name }}</span><span class="text-gray-500">{{ c.cls }}</span>
          <span class="ml-auto">level {{ c.level }}</span>
          <span class="w-20 text-right text-gray-500">{{ c.deaths }} death{{ c.deaths === 1 ? '' : 's' }}</span>
          <span class="w-20 text-right text-gray-500" title="Campaign time (acts 1–10)">{{ c.campaignMs ? fmtHours(c.campaignMs) : '' }}</span>
        </div>
      </div>
      <div v-if="recap.maps">
        <div class="text-gray-100 font-semibold mb-0.5">Mapping</div>
        <div class="text-gray-300">{{ recap.maps }} maps in {{ recap.mapHours.toFixed(1) }} h · {{ fmt(recap.profit) }}c profit · {{ fmt(recap.perHour) }}c an hour</div>
        <div v-if="recap.bestStrategy" class="text-gray-300">Best strategy: <span class="text-green-400">{{ recap.bestStrategy.name }}</span>
          <span class="text-gray-500"> · {{ fmt(recap.bestStrategy.perHour) }}c/h over {{ recap.bestStrategy.maps }} maps</span></div>
        <div v-if="recap.topMechanic" class="text-gray-400">Most seen mechanic: {{ recap.topMechanic.name }} ({{ recap.topMechanic.maps }} maps)</div>
      </div>
      <div v-if="recap.sales || recap.purchases">
        <div class="text-gray-100 font-semibold mb-0.5">Trades</div>
        <div class="text-gray-300">{{ recap.sales }} sold · {{ recap.purchases }} bought</div>
        <div v-if="recap.sold.length" class="text-gray-400">Sold for {{ recap.sold.slice(0, 4).map(s => `${fmtAmount(s.amount)} ${s.currency}`).join(', ') }}</div>
      </div>
      <div v-if="recap.pinnacles.length || recap.voidstones">
        <div class="text-gray-100 font-semibold mb-0.5">Endgame</div>
        <div v-if="recap.pinnacles.length" class="text-gray-300">Bosses: {{ recap.pinnacles.join(', ') }}</div>
        <div v-if="recap.voidstones" class="text-gray-300">Voidstones: {{ recap.voidstones }}/4</div>
      </div>
    </template>
    <div class="text-gray-500"><i class="fas fa-info-circle mr-1" />Only what Orbhoarder kept on this PC: map runs with loot typed in, trades seen in the game log, characters followed from level 2, and your own ticks. Names are in the copied text; nothing else about you is.</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLeagues } from '@/web/background/Leagues'
import { AppConfig, type Config } from '@/web/Config'
import { useCopyFeedback } from '../pob/market'
import { loadFarmRuns } from '../market-history/market-tools'
import { loadLedger } from '../companion/ledger'
import { loadPaceStore } from '../companion/pace-log'
import { PROGRESS, loadProgress } from './progress'
import { CHALLENGES, CHALLENGE_TOTAL, challengeLeague, doneCount, loadChallengeTicks } from './challenges'
import { leagueRecap, recapText, fmtHours } from './league-recap'

const leagues = useLeagues()
const current = computed(() => challengeLeague(leagues.selectedId.value, (AppConfig() as Config | null)?.leagueId))

// stored once on open (the card is a look back, not live)
const farmRuns = loadFarmRuns()
const ledger = loadLedger()
const paceRuns = loadPaceStore().runs

// the current league first, then other leagues seen in farming runs or trades
const leagueList = computed(() => {
  const seen = new Set<string>()
  if (current.value) seen.add(current.value)
  for (const r of farmRuns) if (r.league) seen.add(r.league)
  for (const t of ledger) if (t.league) seen.add(t.league)
  return [...seen].slice(0, 20)
})
const picked = ref(current.value || leagueList.value[0] || '')
watch(current, (l) => { if (l && !picked.value) picked.value = l })

const recap = computed(() => {
  const league = picked.value
  return leagueRecap({
    league,
    farmRuns,
    ledger,
    paceRuns,
    progress: PROGRESS,
    progressTicks: loadProgress(league),
    challengesDone: doneCount(loadChallengeTicks(league), CHALLENGES),
    challengesTotal: league ? CHALLENGE_TOTAL : 0
  })
})

const fmt = (n: number) => Math.abs(n) >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(Math.round(n))
const fmtAmount = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1)
const fmtDate = (ms: number) => new Date(ms).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })

const tiles = computed(() => {
  const r = recap.value
  const top = r.characters[0]
  return [
    { label: 'Highest level', value: top ? String(top.level) : '–', sub: top?.name },
    { label: 'Maps', value: String(r.maps), sub: r.maps ? `${fmt(r.perHour)}c an hour` : undefined },
    { label: 'Deaths', value: String(r.deaths), sub: r.characters.length ? `${r.characters.length} character${r.characters.length === 1 ? '' : 's'}` : undefined },
    { label: 'Challenges', value: `${r.challengesDone}/${r.challengesTotal}`, sub: r.pinnacles.length ? `${r.pinnacles.length} boss${r.pinnacles.length === 1 ? '' : 'es'} beaten` : undefined }
  ]
})

const { copiedKey, copy } = useCopyFeedback()
</script>
