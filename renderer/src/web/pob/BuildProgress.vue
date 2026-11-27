<template>
  <!-- Deathloom fork (Q17, 27 Nov 2026): build progress in one view. Tree step from
       the levelling planner, gem ticks per character and gear "got it" ticks per
       build, all from Path of Building and your own ticks. No character data is fetched.
       Q18: the next 3 unique upgrades by PoB impact per chaos (poe.ninja prices only). -->
  <div class="widget-default-style text-gray-200 leading-tight text-sm flex flex-col h-full min-h-0">
    <div class="flex items-center gap-x-2 px-2 py-1 bg-gray-900 rounded-t">
      <span class="text-gray-500 shrink-0"><i class="fas fa-tasks mr-1" />Build progress</span>
      <span class="text-xs text-gray-400 truncate min-w-0" :title="buildTitle">{{ buildTitle }}</span>
      <span v-if="overall != null" class="ml-auto shrink-0 text-xs" :class="overall >= 100 ? 'text-green-400' : 'text-gray-300'"
        title="Tree, gems and gear count the same">{{ overall }}%</span>
      <button class="ui-btn ui-btn-quiet shrink-0" :class="{ 'ml-auto': overall == null }" :disabled="loading" title="Reload gear from Path of Building" @click="requestGear">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /></button>
    </div>
    <div v-if="overall != null" class="h-1 bg-gray-800"><div class="h-1 bg-green-600" :style="{ width: overall + '%' }" /></div>

    <div class="p-1 overflow-y-auto min-h-0 flex-1">
      <!-- tree step -->
      <div class="rounded px-2 py-1.5 mb-2 bg-gray-900">
        <div class="lg-head flex items-baseline"><i class="fas fa-shoe-prints mr-1 text-gray-500" />
          <span>Tree</span>
          <span v-if="tree" class="ml-2 text-gray-600 normal-case">step {{ tree.step }} of {{ tree.steps }}<template v-if="tree.title"> · {{ tree.title }}</template></span>
          <span v-if="tree" class="ml-auto normal-case" :class="tree.taken >= tree.total ? 'text-green-400' : 'text-gray-300'">{{ tree.taken }} / {{ tree.total }}</span>
        </div>
        <div v-if="!tree" class="text-xs text-gray-500">Waiting for the levelling planner (Path of Building)…</div>
        <template v-else>
          <div v-if="!tree.next.length" class="text-xs text-green-500">All passives of this step should be taken.</div>
          <div v-else class="text-xs"><span class="text-gray-500">Next:</span>
            <span v-for="(n, i) of tree.next" :key="n.id + ':' + i" class="ml-2" :class="nodeClass(n)" :title="[n.name, n.effect ?? n.stats].filter(Boolean).join('\n')">{{ n.name }}</span>
          </div>
          <div v-if="unspent > 0" class="text-xs text-yellow-400">{{ unspent }} point{{ unspent === 1 ? '' : 's' }} to spend at level {{ level }}</div>
        </template>
      </div>

      <!-- gems -->
      <div class="rounded px-2 py-1.5 mb-2 bg-gray-900">
        <div class="lg-head flex items-baseline"><i class="fas fa-gem mr-1 text-gray-500" />
          <span>Gems</span>
          <span v-if="charName" class="ml-2 text-gray-600 normal-case">{{ charName }}</span>
          <span v-if="gems" class="ml-auto normal-case" :class="gems.have >= gems.total ? 'text-green-400' : 'text-gray-300'">{{ gems.have }} / {{ gems.total }}</span>
          <button v-if="gems && gems.total" class="ml-2 ui-btn ui-btn-quiet text-xs" @click="allGems = !allGems">{{ allGems ? 'missing only' : 'all' }}</button>
        </div>
        <div v-if="!gems" class="text-xs text-gray-500">Waiting for the levelling planner…</div>
        <template v-else>
          <div v-if="!shownGems.length" class="text-xs" :class="gems.missing.length ? 'text-gray-500' : 'text-green-500'">
            {{ gems.total ? 'Every gem you can use at this level is ticked.' : 'This step has no gems.' }}</div>
          <div v-else class="flex flex-wrap gap-x-2 gap-y-px text-xs">
            <button v-for="g of shownGems" :key="g.name" type="button" class="gem-chip flex items-center gap-1"
              :class="hasGem(g.name) ? 'gem-chip-on' : 'gem-chip-off'" :title="hasGem(g.name) ? 'You have it (click to untick)' : `Click when you have it · needs level ${g.reqLevel}`"
              @click="toggleGem(g.name)">
              <i class="fas text-xs" :class="hasGem(g.name) ? 'fa-check-square text-green-400' : 'fa-square text-gray-600'" />
              <span :class="gemClass(g)">{{ g.name }}</span>
            </button>
          </div>
          <div v-if="!charName" class="lg-sub">No character seen in the game log yet: ticks are kept without a name until it is.</div>
        </template>
      </div>

      <!-- gear -->
      <div class="rounded px-2 py-1.5 mb-2 bg-gray-900">
        <div class="lg-head flex items-baseline"><i class="fas fa-shield-alt mr-1 text-gray-500" />
          <span>Gear</span>
          <span v-if="itemSet" class="ml-2 text-gray-600 normal-case">item set "{{ itemSet }}"</span>
          <span v-if="gear" class="ml-auto normal-case" :class="gear.have >= gear.total ? 'text-green-400' : 'text-gray-300'">{{ gear.have }} / {{ gear.total }}</span>
        </div>
        <div v-if="error" class="text-xs text-gray-400">{{ error }}</div>
        <div v-else-if="!gear" class="text-xs text-gray-500">Loading from Path of Building…</div>
        <div v-else-if="!gear.total" class="text-xs text-gray-500">This build has no items.</div>
        <div v-for="r of gear?.items ?? []" v-else :key="r.item.slot" class="flex items-baseline gap-x-2 py-px">
          <button type="button" class="ui-tick shrink-0" :class="{ on: r.owned }"
            :title="r.owned ? 'You have this (click to undo)' : 'Got it: tick when you have this item or one as good'" @click="toggleOwned(r.item)" />
          <span class="w-20 shrink-0 text-xs text-gray-500 truncate">{{ r.item.label }}</span>
          <span class="truncate min-w-0" :class="r.owned ? 'opacity-50' : ''" :style="{ color: rarityColour(r.item.rarity) }"
            :title="r.item.baseName && r.item.baseName !== (r.item.title || r.item.name) ? r.item.baseName : ''">{{ r.item.title || r.item.name }}</span>
        </div>
      </div>

      <!-- Q18: next upgrades by PoB impact per chaos (uniques, poe.ninja prices) -->
      <div class="rounded px-2 py-1.5 mb-2 bg-gray-900">
        <div class="lg-head flex items-baseline"><i class="fas fa-arrow-up mr-1 text-gray-500" />
          <span>Next upgrades</span>
          <span class="ml-2 text-gray-600 normal-case">PoB impact per chaos</span>
          <button class="ml-auto ui-btn ui-btn-quiet text-xs" :disabled="ranking || !candidates.uniques.length"
            :title="`Path of Building compares each unique of the build you haven't ticked with your character file (${candidates.uniques.length} to check, one at a time)`"
            @click="rank"><i class="fas fa-sort-amount-down mr-1" :class="{ 'fa-spin': ranking }" />{{ ranking ? `${rankDone} / ${candidates.uniques.length}` : (ranked ? 'Rank again' : 'Rank') }}</button>
        </div>
        <div v-if="rankError" class="text-xs text-gray-400">{{ rankError }}</div>
        <div v-else-if="!ranked && !ranking" class="text-xs text-gray-500">
          <template v-if="candidates.uniques.length">Click Rank: the {{ candidates.uniques.length }} unique{{ candidates.uniques.length === 1 ? '' : 's' }} you haven't ticked, best gain per chaos first.</template>
          <template v-else-if="gear">No unticked uniques to rank.</template>
        </div>
        <template v-else-if="ranked">
          <div v-if="!ranked.length" class="text-xs text-gray-500">None of them beats your character's gear{{ unpriced ? ` (${unpriced} without a poe.ninja price)` : '' }}.</div>
          <div v-for="(u, i) of ranked" :key="u.item.slot" class="flex items-baseline gap-x-2 py-px">
            <span class="w-4 text-right text-xs text-gray-600 shrink-0">{{ i + 1 }}</span>
            <span class="truncate min-w-0" :style="{ color: rarityColour(u.item.rarity) }" :title="`${u.item.label} · compared in ${u.impact.slot}`">{{ u.item.searchText }}</span>
            <span v-if="u.impact.dpsPct" class="text-xs shrink-0" :class="u.impact.dpsPct > 0 ? 'text-green-400' : 'text-red-400'">{{ pct(u.impact.dpsPct) }} DPS</span>
            <span v-if="u.impact.ehpPct" class="text-xs shrink-0" :class="u.impact.ehpPct > 0 ? 'text-green-400' : 'text-red-400'">{{ pct(u.impact.ehpPct) }} eHP</span>
            <span class="ml-auto text-xs text-yellow-200 shrink-0" title="Cheapest listing on poe.ninja">{{ fmtChaos(u.chaos) }}c</span>
            <button class="ui-btn ui-btn-quiet text-xs shrink-0" :title="`Copy '${u.item.searchText}': press / in game, then Ctrl+V`" @click="copy(u.item.searchText, u.item.slot)">
              <i class="far" :class="copiedKey === u.item.slot ? 'fa-check' : 'fa-copy'" /></button>
          </div>
          <div v-if="ranked.length && unpriced" class="lg-sub">{{ unpriced }} without a poe.ninja price left out.</div>
        </template>
        <div v-if="candidates.rares.length" class="lg-sub">{{ candidates.rares.length }} rare/magic item{{ candidates.rares.length === 1 ? '' : 's' }} not ranked (no poe.ninja price): Build → Gear → Trade.</div>
      </div>

      <div class="px-1 text-xs text-gray-600">
        Ticks are shared with Build → Gear (got it), Build → Gems and Levelling → Your gems. Passives come from the
        levelling planner (game log or your level).
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { PobBuildInfo, PobGearItem, PobImpactResult, PobPlanGem, PobPlanNode } from '@ipc/types'
import { usePoeninja } from '@/web/background/Prices'
import { myCharacterHint } from './use-my-character'
import { useCopyFeedback } from './market'
import { Host } from '@/web/background/IPC'
import { CHAR_LEVELS_KEY, currentChar, loadCharLevels } from '../companion/char-level'
import { currentPlan, planStep } from './plan-store'
import {
  GEAR_OWNED_KEY, GEM_TICKS_KEY, gearOwnedKey, gearProgress, gemProgress, overallPercent, parseGearOwned,
  parseGemTicks, saveShared, toggleGearOwned, toggleGemTick, treeProgress,
  cheapestUnique, impactScore, rankUpgrades, upgradeCandidates, type PricedUpgrade
} from './build-progress'

const levels = ref(loadCharLevels())
const gemTicks = shallowRef(parseGemTicks(localStorage.getItem(GEM_TICKS_KEY)))
const owned = shallowRef(parseGearOwned(localStorage.getItem(GEAR_OWNED_KEY)))
const onStorage = (e: StorageEvent) => {
  if (e.key === CHAR_LEVELS_KEY) levels.value = loadCharLevels()
  if (e.key === GEM_TICKS_KEY) gemTicks.value = parseGemTicks(localStorage.getItem(GEM_TICKS_KEY))
  if (e.key === GEAR_OWNED_KEY) owned.value = parseGearOwned(localStorage.getItem(GEAR_OWNED_KEY))
}
window.addEventListener('storage', onStorage)

const char = computed(() => currentChar(levels.value))
const charName = computed(() => char.value?.name ?? '')
const level = computed(() => char.value?.level ?? currentPlan.value?.level ?? 1)

// tree: the same step the Next tab and the tree map use (arrows only, no
// automatic tracking: Gerhard 27 Nov 2026)
const tree = computed(() => {
  const p = currentPlan.value
  if (!p) return null
  return treeProgress(p, planStep.value?.pos ?? 0)
})
const unspent = computed(() => {
  const p = currentPlan.value; const t = tree.value
  return p && t ? Math.max(0, Math.min(p.available, t.total) - t.taken) : 0
})

// gems of the current step, ticked per character
const ticked = computed(() => gemTicks.value[charName.value] ?? [])
const gems = computed(() => currentPlan.value ? gemProgress(currentPlan.value.gems, ticked.value, level.value) : null)
const allGems = ref(false)
const shownGems = computed(() => !gems.value ? [] : allGems.value ? gems.value.gems : gems.value.missing)
function hasGem (name: string) { return ticked.value.includes(name) }
function toggleGem (name: string) {
  gemTicks.value = toggleGemTick(gemTicks.value, charName.value, name)
  saveShared(GEM_TICKS_KEY, gemTicks.value)
}

// gear: the active build's item set
const loading = ref(false)
const error = ref<string | null>(null)
const build = shallowRef<PobBuildInfo | null>(null)
const items = shallowRef<PobGearItem[] | null>(null)
const itemSet = ref('')
// request ids apart from the Build panel's (it answers only its own)
let requestId = ((Date.now() & 0x00ffffff) | 0x30000000) | 0
const lsGear = Host.onEvent('MAIN->CLIENT::pob-gear', (e) => {
  if (e.requestId !== requestId) return
  loading.value = false
  if (!e.ok) { error.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, ''); return }
  error.value = null
  build.value = e.build ?? null
  itemSet.value = e.itemSet ?? ''
  items.value = e.items ?? []
})
function requestGear () {
  loading.value = true
  requestId = (requestId + 1) | 0
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-gear', payload: { requestId } })
}
requestGear()
// the build, loadout or character changed in another panel or window
const lsBuilds = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => { if (e.ok) requestGear() })
const ownedKey = computed(() => gearOwnedKey(build.value?.name, itemSet.value))
const gear = computed(() => items.value ? gearProgress(items.value, owned.value[ownedKey.value]) : null)
function toggleOwned (item: PobGearItem) {
  owned.value = toggleGearOwned(owned.value, ownedKey.value, item)
  saveShared(GEAR_OWNED_KEY, owned.value)
}

onUnmounted(() => {
  lsGear.abort()
  lsBuilds.abort()
  window.removeEventListener('storage', onStorage)
})

// ---- Q18: next upgrades ----
const ninja = usePoeninja()
ninja.queuePricesFetch()
const { copiedKey, copy } = useCopyFeedback()
const candidates = computed(() => upgradeCandidates(gear.value?.items ?? []))
const ranking = ref(false)
const rankDone = ref(0)
const rankError = ref('')
const ranked = shallowRef<Array<PricedUpgrade<PobGearItem>> | null>(null)
const unpriced = ref(0)
let impactId = ((Date.now() & 0x00ffffff) | 0x38000000) | 0
const waiting = new Map<number, (e: { ok: boolean, error?: string, result?: PobImpactResult }) => void>()
const lsImpact = Host.onEvent('MAIN->CLIENT::pob-impact', (e) => {
  const done = waiting.get(e.requestId)
  if (done) { waiting.delete(e.requestId); done(e) }
})
onUnmounted(() => { lsImpact.abort(); waiting.clear() })
function impactOf (itemText: string) {
  impactId = (impactId + 1) | 0
  const requestId = impactId
  return new Promise<{ ok: boolean, error?: string, result?: PobImpactResult }>((resolve) => {
    waiting.set(requestId, resolve)
    Host.sendEvent({ name: 'CLIENT->MAIN::pob-impact', payload: { requestId, itemText, myCharacter: myCharacterHint() } })
  })
}
async function rank () {
  if (ranking.value) return
  ranking.value = true
  rankDone.value = 0
  rankError.value = ''
  ranked.value = null
  ninja.queuePricesFetch()
  const listings = ninja.allItems()
  const out: Array<PricedUpgrade<PobGearItem>> = []
  let noPrice = 0
  try {
    for (const item of candidates.value.uniques) {
      const chaos = cheapestUnique(listings, item.searchText)
      if (chaos == null) { noPrice++; rankDone.value++; continue }
      const e = await impactOf(item.text)
      rankDone.value++
      if (!e.ok) {
        // a price check started meanwhile (PoB does one item at a time): skip this one
        if ((e.error ?? '').includes('newer item')) continue
        rankError.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '')
        return
      }
      if (!e.result?.equipped) {
        rankError.value = e.result?.equippedError ??
          "Needs your character's file to compare with: Build → Gems → Your character (Path of Building's Import character)."
        return
      }
      const impact = impactScore(e.result.equipped.compares)
      if (impact) out.push({ item, chaos, impact })
    }
    if (!listings.length) {
      rankError.value = 'No poe.ninja prices yet (they load for the selected trade league). Try again in a minute.'
      return
    }
    unpriced.value = noPrice
    ranked.value = rankUpgrades(out, 3)
  } finally {
    ranking.value = false
  }
}
// a different build or item set: old ranking no longer fits
watch(ownedKey, () => { ranked.value = null; rankError.value = '' })
function pct (v: number) { return `${v > 0 ? '+' : ''}${Math.abs(v) >= 10 ? Math.round(v) : v.toFixed(1)}%` }
function fmtChaos (c: number) { return c >= 100 ? String(Math.round(c)) : c >= 10 ? c.toFixed(0) : c.toFixed(1) }

const overall = computed(() => overallPercent([tree.value ? { have: tree.value.taken, total: tree.value.total } : null, gems.value, gear.value]))
const buildTitle = computed(() => {
  const b = build.value
  if (!b) return ''
  return [b.name, b.ascendancy ?? b.className, b.mainSkill].filter(Boolean).join(' · ')
})

function nodeClass (n: PobPlanNode) {
  if (n.type === 'Keystone') return 'text-orange-300'
  if (n.type === 'Notable') return 'text-yellow-200'
  if (n.type === 'Mastery') return 'text-purple-300'
  if (n.type === 'Socket') return 'text-teal-300'
  return 'text-gray-300'
}
// PoB gem colours: 1 = str, 2 = dex, 3 = int
function gemClass (g: PobPlanGem) {
  const c = g.colour === 1 ? 'text-red-300' : g.colour === 2 ? 'text-green-300' : g.colour === 3 ? 'text-blue-300' : 'text-gray-300'
  return g.support ? `${c} opacity-80` : c
}
function rarityColour (rarity: string) {
  switch (rarity) {
    case 'Unique': return '#af6025'
    case 'Rare': return '#ffff77'
    case 'Magic': return '#8888ff'
    default: return '#c8c8c8'
  }
}
</script>
