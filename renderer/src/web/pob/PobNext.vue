<template>
  <!-- Deathloom fork: levelling planner ("Next" tab of the Loot Goblin window).
       Level from Client.txt, quest points from the campaign guide, the rest from
       the active build in Path of Building. No character data is fetched. -->
  <div class="widget-default-style text-gray-200 leading-tight text-sm flex flex-col h-full min-h-0">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 bg-gray-900 rounded-t">
      <span class="text-gray-500"><i class="fas fa-shoe-prints mr-1" />Next steps</span>
      <label v-if="levels.chars.length > 1" class="text-xs text-gray-400">Character
        <select class="bg-gray-700 rounded px-1 ml-1" :value="levels.selected" @change="pickChar(($event.target as HTMLSelectElement).value)">
          <option value="">Last levelled ({{ levels.chars[0].name }})</option>
          <option v-for="c of levels.chars" :key="c.name" :value="c.name">{{ c.name }} ({{ c.cls }} {{ c.level }})</option>
        </select>
      </label>
      <span v-else-if="char" class="text-xs text-gray-400">{{ char.name }} <span class="text-gray-600">{{ char.cls }}</span></span>
      <label class="text-xs text-gray-400" :title="char?.manual ? 'Typed in. The next level-up in game replaces it.' : 'From Client.txt (\'is now level\'). Type to change.'">Level
        <input type="number" min="1" max="100" class="w-12 bg-gray-700 rounded px-1 ml-1" :value="level" @change="setLevel(($event.target as HTMLInputElement).value)">
      </label>
      <label class="text-xs text-gray-400" :title="levels.questPoints == null ? (loggedPoints != null ? 'From the game log: quest passive points received since level 2.' : 'From the campaign guide (optional quests counted as done). Type /passives in game for the exact number.') : 'Typed in. Clear the box to follow the campaign guide again.'">Quest points
        <input type="number" min="0" max="30" class="w-10 bg-gray-700 rounded px-1 ml-1" :placeholder="String(loggedPoints ?? guidePoints)"
          :value="levels.questPoints ?? ''" @change="setQuestPoints(($event.target as HTMLInputElement).value)">
      </label>
      <span v-if="plan" class="text-xs text-gray-500">{{ plan.available }} passive points</span>
      <button class="ml-auto text-gray-500 hover:text-gray-200" title="Reload from Path of Building" @click="request">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /></button>
    </div>

    <div class="p-1 overflow-y-auto min-h-0 flex-1">
      <div v-if="error" class="p-1 text-gray-400">{{ error }}</div>
      <div v-else-if="!plan && loading" class="p-1 text-gray-500">Loading from Path of Building…</div>
      <template v-else-if="plan">
        <div v-if="!levelKnown" class="px-1 pb-1 text-xs text-yellow-500">
          No level-up seen yet. Type your level above, or level up once in game (Client.txt).
        </div>

        <!-- levelling trees -->
        <div class="flex flex-wrap items-center gap-1 px-1 pb-1 text-xs">
          <template v-for="(ph, i) of plan.phases" :key="i">
            <i v-if="i" class="fas fa-angle-right text-gray-600" />
            <span class="px-1 rounded" :class="i + 1 === plan.phase ? 'bg-gray-700 text-gray-100' : (i + 1 < plan.phase ? 'text-gray-600' : 'text-gray-400')"
              :title="ph.level ? `Followed up to level ${ph.level}` : 'End goal: the loadout picked in the Build tab'">{{ ph.title }}</span>
          </template>
        </div>
        <div v-if="plan.phases.length === 1" class="px-1 pb-1 text-xs text-gray-600">
          One tree only. Name extra trees in Path of Building after a level ("Level 12", "Level 30", …) to plan step by step.
        </div>

        <!-- passives -->
        <div class="rounded px-1 py-1 mb-1 bg-gray-900">
          <div class="lg-head flex items-baseline"><i class="fas fa-shoe-prints mr-1 text-gray-500" />
            <span>Next passives</span>
            <span class="ml-2 text-gray-600">{{ Math.min(plan.taken, plan.order.length) + plan.kept }} / {{ plan.order.length + plan.kept }} of this tree by now</span>
            <button class="ml-auto text-gray-500 hover:text-gray-200" @click="showAll = !showAll">{{ showAll ? 'Next only' : 'Whole order' }}</button>
          </div>
          <div v-if="!plan.order.length" class="text-gray-500">This tree adds no passives over the previous one.</div>
          <div v-else-if="!showAll && plan.taken >= plan.order.length" class="text-green-500">All passives of this tree should be taken by now.</div>
          <div v-for="row of passiveRows" :key="row.i" class="flex items-baseline gap-x-2"
            :class="isTaken(row.i) ? 'opacity-40' : ''">
            <span class="w-6 text-right text-xs text-gray-600 shrink-0">{{ row.i + 1 + plan.kept }}</span>
            <i v-if="takenByLog?.has(row.i)" class="fas fa-check text-green-500 text-xs" title="Taken (game log)" />
            <span class="min-w-0 truncate" :class="nodeClass(row.node)" :title="nodeTitle(row.node)">{{ row.node.name }}</span>
            <span v-if="row.node.type !== 'Normal'" class="text-xs text-gray-600 shrink-0">{{ typeLabel(row.node) }}</span>
            <span v-if="row.node.stats" class="text-xs text-gray-600 truncate">{{ row.node.stats }}</span>
          </div>
        </div>

        <div v-if="plan.refund.length" class="rounded px-1 py-1 mb-1 bg-gray-900">
          <div class="lg-head"><i class="fas fa-undo mr-1 text-gray-500" />Refund when you switch to this tree ({{ plan.refund.length }})</div>
          <div class="text-xs text-gray-500">{{ plan.refund.map(n => n.name).join(', ') }}</div>
        </div>

        <div v-if="plan.ascendancy.length" class="rounded px-1 py-1 mb-1 bg-gray-900">
          <div class="lg-head"><i class="fas fa-crown mr-1 text-gray-500" />Ascendancy in this tree{{ plan.ascendancyClass ? ` (${plan.ascendancyClass})` : '' }}</div>
          <div class="text-blue-300">{{ plan.ascendancy.map(a => a.name).join(', ') }}</div>
        </div>

        <!-- gems: swap at the next step -->
        <div v-if="swap" class="rounded px-1 py-1 mb-1 bg-gray-900">
          <div class="lg-head"><i class="fas fa-exchange-alt mr-1 text-gray-500" />At level {{ swap.level }} (next tree "{{ swap.title }}"<template v-if="plan.nextSkillSet">, skill set "{{ plan.nextSkillSet }}"</template>)</div>
          <div v-if="swap.add.length" class="flex flex-wrap gap-x-3"><span class="text-xs text-green-500 w-10">add</span>
            <span v-for="g of swap.add" :key="'s+' + g.name" :class="gemClass(g)" :title="gemTitle(g)">{{ g.name }}</span></div>
          <div v-if="swap.drop.length" class="flex flex-wrap gap-x-3"><span class="text-xs text-red-400 w-10">drop</span>
            <span v-for="g of swap.drop" :key="'s-' + g.name" class="text-gray-500 line-through" :title="gemTitle(g)">{{ g.name }}</span></div>
          <div v-if="!swap.add.length && !swap.drop.length" class="text-xs text-gray-500">Same gems.</div>
        </div>

        <!-- gems the build keeps below max level -->
        <div v-if="holds.length" class="rounded px-1 py-1 mb-1 bg-gray-900">
          <div class="lg-head"><i class="fas fa-hand-paper mr-1 text-gray-500" />Hold gem levels</div>
          <div v-for="g of holds" :key="'h' + g.name" class="flex items-baseline gap-x-2 text-xs">
            <span :class="gemClass(g)">{{ g.name }}</span>
            <span class="text-yellow-300">stop at level {{ g.level }}</span>
            <span class="text-gray-600">(max {{ g.maxLevel }}<template v-if="g.levelReq">, needs character level {{ g.levelReq }}</template>)</span>
          </div>
          <div class="lg-sub">Don't click the gem's level-up arrow past this (e.g. lower reservation). From the build's gem levels in Path of Building.</div>
        </div>

        <!-- gems from quests and vendors -->
        <div v-if="questGems" class="rounded px-1 py-1 mb-1 bg-gray-900">
          <div class="lg-head flex items-baseline"><i class="fas fa-gem mr-1 text-gray-500" />
            <span>Quest gems for this build ({{ questGems.className }})</span>
            <span class="ml-2 text-gray-600">act {{ guideAct }}</span>
            <button class="ml-auto text-gray-500 hover:text-gray-200" @click="allActs = !allActs">{{ allActs ? 'This act' : 'All acts' }}</button>
          </div>
          <div v-if="!questRows.length" class="text-xs text-gray-500">Nothing to pick up from quests {{ allActs ? '' : 'in this act' }}.</div>
          <div v-for="(q, i) of questRows" :key="i" class="pb-px" :class="q.act < guideAct ? 'opacity-50' : ''">
            <div class="text-xs text-gray-500">{{ allActs ? `A${q.act} · ` : '' }}{{ q.quest }} <span class="text-gray-600">({{ q.npc }})</span></div>
            <div class="flex flex-wrap items-baseline gap-x-3 pl-2">
              <span v-if="q.take"><span class="text-xs text-yellow-500">take</span> <span :class="gemClass(q.take)" :title="gemTitle(q.take)">{{ q.take.name }}</span></span>
              <span v-if="q.buy.length"><span class="text-xs text-gray-500">buy</span>
                <span v-for="g of q.buy" :key="g.name" class="ml-2" :class="gemClass(g)" :title="`${gemTitle(g)}\nSold by ${g.vendor}`">{{ g.name }}</span></span>
            </div>
          </div>
          <div v-if="questGems.notFromQuests.length" class="text-xs text-gray-600 pt-px" :title="questGems.notFromQuests.map(g => g.name).join(', ')">
            Not from quests: {{ questGems.notFromQuests.length }} (drops, trade or transfigured)</div>
        </div>

        <!-- gems -->
        <div class="rounded px-1 py-1 mb-1 bg-gray-900">
          <div class="lg-head"><i class="fas fa-gem mr-1 text-gray-500" />Gems<span v-if="plan.skillSet" class="text-gray-600"> · skill set "{{ plan.skillSet }}"</span></div>
          <div v-if="newGems.length" class="pb-1">
            <div class="lg-sub">New in this step</div>
            <div class="flex flex-wrap gap-x-3">
              <span v-for="g of newGems" :key="'n' + g.name" :class="gemClass(g)" :title="gemTitle(g)">{{ g.name }}
                <span class="text-xs text-gray-600">{{ g.reqLevel > level ? `lvl ${g.reqLevel}` : '' }}</span></span>
            </div>
          </div>
          <div v-if="upcoming.length" class="pb-1">
            <div class="lg-sub">Coming up</div>
            <div v-for="g of upcoming" :key="'u' + g.name" class="flex items-baseline gap-x-2">
              <span class="w-12 text-xs text-gray-500 shrink-0">lvl {{ g.reqLevel }}</span>
              <span :class="gemClass(g)" :title="gemTitle(g)">{{ g.name }}</span>
              <span v-if="g.group || g.slot" class="text-xs text-gray-600 truncate">{{ g.group ?? g.slot }}</span>
            </div>
          </div>
          <!-- manual "have it" ticks (the game log has no gem info) -->
          <div class="lg-sub flex items-baseline">
            <span>Your gems<template v-if="char"> ({{ char.name }})</template>: {{ haveCount }} of {{ uniqueGems.length }}</span>
            <button class="ml-auto text-gray-500 hover:text-gray-200" @click="showTicks = !showTicks">{{ showTicks ? 'hide' : 'tick what you have' }}</button>
          </div>
          <div v-if="showTicks" class="flex flex-wrap gap-x-3 gap-y-px text-xs pb-1">
            <label v-for="g of uniqueGems" :key="'t' + g.name" class="flex items-center gap-1 cursor-pointer">
              <input type="checkbox" :checked="hasGem(g.name)" @change="toggleGem(g.name)">
              <span :class="[gemClass(g), hasGem(g.name) ? '' : 'underline decoration-dotted']">{{ g.name }}</span>
            </label>
          </div>
          <div v-else-if="missingGems.length" class="text-xs pb-1"><span class="text-red-300">Missing:</span>
            <span v-for="g of missingGems" :key="'m' + g.name" class="ml-2" :class="gemClass(g)" :title="gemTitle(g)">{{ g.name }}</span></div>
          <div class="text-xs text-gray-500" title="Gems of this step's skill set you can socket at your level (level-1 requirement). Changes when you reach the next gem's level or the next levelling tree.">
            Gems in this step usable at level {{ level }}: {{ usableNow.length }} of {{ uniqueGems.length }}<template v-if="upcoming.length">
              · next: {{ upcoming[0].name }} at {{ upcoming[0].reqLevel }}</template>
            <button class="ml-1 hover:text-gray-200" @click="showUsable = !showUsable">{{ showUsable ? 'hide' : 'show' }}</button>
          </div>
          <div v-if="showUsable" class="flex flex-wrap gap-x-3">
            <span v-for="g of usableNow" :key="'a' + g.name" :class="gemClass(g)" :title="gemTitle(g)">{{ g.name }}</span>
          </div>
        </div>

        <!-- vendor recipes for this point of the campaign -->
        <div class="rounded px-1 py-1 mb-1 bg-gray-900 text-xs">
          <div class="lg-head flex items-baseline"><i class="fas fa-store mr-1 text-gray-500" />
            <span>Vendor recipes (act {{ guideAct }})</span>
            <button class="ml-auto text-gray-500 hover:text-gray-200" @click="showRecipes = !showRecipes">{{ showRecipes ? 'hide' : `show ${recipes.length}` }}</button>
          </div>
          <template v-if="showRecipes">
            <div v-for="r of recipes" :key="r.name" class="pb-1">
              <div><span class="text-gray-200">{{ r.name }}</span>
                <span v-for="t of r.tags" :key="t" class="ml-1 px-1 rounded bg-gray-800 text-gray-500">{{ t }}</span></div>
              <div class="text-gray-400 pl-2">{{ r.give }} → <span class="text-green-300">{{ r.get }}</span></div>
              <div v-if="r.note" class="text-gray-600 pl-2">{{ r.note }}</div>
            </div>
            <div class="text-gray-600">Sell the items together to any vendor. League challenges often ask for some of these.</div>
          </template>
        </div>

        <!-- character stats from the game log -->
        <div class="rounded px-1 py-1 mb-1 bg-gray-900 text-xs">
          <div class="lg-head flex items-baseline"><i class="fas fa-scroll mr-1 text-gray-500" />
            <span>From the game log<template v-if="char"> · {{ char.name }}</template></span>
            <button class="ml-auto text-gray-500 hover:text-gray-200" :disabled="rebuilding"
              title="Read the whole Client.txt again and rebuild every character's quests, passives, deaths and act times"
              @click="rebuild"><i class="fas fa-history mr-1" :class="{ 'fa-spin': rebuilding }" />Rebuild from game log</button>
          </div>
          <div v-if="rebuildNote" class="text-gray-500">{{ rebuildNote }}</div>
          <template v-if="progress">
            <div class="flex flex-wrap gap-x-4 text-gray-300">
              <span :title="progress.questsExact ? 'From /passives' : 'Passive points received from quests (type /passives in game for the exact list)'">
                Quest passives: {{ progress.passives }}<span class="text-gray-500">{{ progress.questsExact ? ' (/passives)' : '' }}</span></span>
              <span v-if="logAllocated != null" title="Passives taken minus refunded, counted from the game log">
                Passives taken: {{ logAllocated }}<span v-if="plan.available - logAllocated > 0" class="text-yellow-400"> · {{ plan.available - logAllocated }} unspent</span></span>
              <span>Deaths: {{ progress.deaths ?? 0 }}<span v-if="guideAct && progress.deathsByAct?.[guideAct]" class="text-gray-500"> ({{ progress.deathsByAct[guideAct] }} in act {{ guideAct }})</span></span>
              <span v-if="campaignTime" :title="actTimes">Campaign time: {{ campaignTime }}</span>
              <span v-if="progress.kitava?.length" :class="progress.kitava.includes('merciless') ? 'text-red-300' : 'text-orange-300'"
                title="Kitava's resistance penalty (act 5: -30%, act 10: -60% total). Fix your resistances!">
                Kitava: {{ progress.kitava.includes('merciless') ? '-60% res' : '-30% res' }}</span>
              <span v-if="progress.atlasPoints">Atlas points: {{ progress.atlasPoints }}</span>
            </div>
            <div v-if="!progress.questsExact" class="text-gray-600">Type <b>/passives</b> in game once to sync the exact list of passive quests done.</div>
          </template>
          <div v-else class="text-gray-600">Nothing yet for this character. Level up once, or Rebuild from game log.</div>
        </div>

        <div class="px-1 pt-1 text-xs text-gray-600">
          Assumes you took the passives in this order. Order: nearest notable, keystone or jewel socket first, with the
          small passives on the way. Points = level − 1 + quest points. Gem levels are the level-1 requirements.
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { PobPlan, PobPlanGem, PobPlanNode } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { CHAR_LEVELS_KEY, currentChar, loadCharLevels, progressOf, rebuildFromLog, saveCharLevels, type CharLevels } from '../companion/char-level'
import { AppConfig } from '@/web/Config'
import { VENDOR_RECIPES } from '../companion/vendor-recipes'
import { CAMPAIGN_STEP_KEY, STEPS, banditFromPob, loadCampaignStep, questPassivesBefore, saveBandit } from '../companion/campaign-route'
import { planQuestGems } from '../companion/quest-gems'
import { currentPlan } from './plan-store'

const levels = ref<CharLevels>(loadCharLevels())
const guideStep = ref(loadCampaignStep())
const onStorage = (e: StorageEvent) => {
  if (e.key === CHAR_LEVELS_KEY) levels.value = loadCharLevels()
  if (e.key === CAMPAIGN_STEP_KEY) guideStep.value = loadCampaignStep()
}
window.addEventListener('storage', onStorage)

const char = computed(() => currentChar(levels.value))
const levelKnown = computed(() => char.value != null)
const level = computed(() => char.value?.level ?? 1)
const guidePoints = computed(() => questPassivesBefore(guideStep.value))
// exact count from the game log when the character was followed from level 2
const loggedPoints = computed(() => {
  const p = progressOf(levels.value, char.value?.name)
  return p && p.firstLevel <= 2 ? p.passives : null
})
const questPoints = computed(() => levels.value.questPoints ?? loggedPoints.value ?? guidePoints.value)

function update (v: CharLevels) {
  levels.value = v
  saveCharLevels(v)
}
function pickChar (name: string) { update({ ...levels.value, selected: name }) }
function setLevel (text: string) {
  const n = Math.floor(Number(text))
  if (!Number.isFinite(n) || n < 1 || n > 100) return
  const name = char.value?.name ?? ''
  update({ ...levels.value, manual: { name, level: n } })
}
function setQuestPoints (text: string) {
  const n = Math.floor(Number(text))
  update({ ...levels.value, questPoints: text.trim() === '' || !Number.isFinite(n) ? null : Math.min(30, Math.max(0, n)) })
}

const loading = ref(false)
const error = ref<string | null>(null)
const plan = shallowRef<PobPlan | null>(null)
const showAll = ref(false)
const showUsable = ref(false)
let lastRequestId = 0

const listener = Host.onEvent('MAIN->CLIENT::pob-plan', (e) => {
  if (e.requestId !== lastRequestId) return
  loading.value = false
  if (!e.ok) {
    error.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '')
    return
  }
  error.value = null
  plan.value = e.plan ?? null
  currentPlan.value = plan.value
  // the guide (every window) follows the build's bandit choice
  if (e.plan) saveBandit(banditFromPob(e.plan.bandit))
})
// the build or loadout changed in another panel
const buildsListener = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => { if (e.ok) request() })

function request () {
  loading.value = true
  lastRequestId += 1
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-plan',
    payload: { requestId: lastRequestId, level: level.value, questPoints: questPoints.value }
  })
}
defineExpose({ request })
watch([level, questPoints], () => { request() }, { immediate: true })

onUnmounted(() => {
  listener.abort()
  buildsListener.abort()
  window.removeEventListener('storage', onStorage)
})

// Passives actually taken (game log, characters followed from level 2): match
// the plan's nodes by name, in order (small passives with the same name are approximate)
const progress = computed(() => progressOf(levels.value, char.value?.name))
const logAllocated = computed(() => {
  const a = progress.value?.alloc
  if (!a || (progress.value?.firstLevel ?? 99) > 2) return null
  return Object.values(a).reduce((n, c) => n + c, 0)
})
const takenByLog = computed(() => {
  const p = plan.value; const a = progress.value?.alloc
  if (!p || !a || logAllocated.value == null) return null
  const left = { ...a }
  const taken = new Set<number>()
  p.order.forEach((node, i) => {
    if ((left[node.name] ?? 0) > 0) { taken.add(i); left[node.name]-- }
  })
  return taken
})
function isTaken (i: number) {
  return takenByLog.value ? takenByLog.value.has(i) : i < (plan.value?.taken ?? 0)
}
const passiveRows = computed(() => {
  const p = plan.value
  if (!p) return []
  const rows = p.order.map((node, i) => ({ node, i }))
  if (showAll.value) return rows
  if (takenByLog.value) return rows.filter(r => !takenByLog.value!.has(r.i)).slice(0, 5)
  return rows.slice(p.taken, p.taken + 5)
})

function fmtMs (ms: number) {
  const m = Math.round(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}
const campaignTime = computed(() => {
  const t = progress.value?.actMs
  if (!t) return ''
  const total = Object.entries(t).filter(([a]) => Number(a) >= 1 && Number(a) <= 10).reduce((n, [, ms]) => n + ms, 0)
  return total ? fmtMs(total) : ''
})
const actTimes = computed(() => Object.entries(progress.value?.actMs ?? {})
  .filter(([a]) => Number(a) >= 1 && Number(a) <= 10)
  .map(([a, ms]) => `Act ${a}: ${fmtMs(ms)}`).join('\n'))

// gems the build keeps below their normal max level
const holds = computed(() => uniqueGems.value.filter(g => g.level != null && g.maxLevel != null && g.level < g.maxLevel))

// manual ticks per character: which of the build's gems you have
const TICKS_KEY = 'deathloom.gem-ticks.v1'
function loadTicks (): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(TICKS_KEY) ?? '{}') ?? {} } catch { return {} }
}
const ticks = ref<Record<string, string[]>>(loadTicks())
const showTicks = ref(false)
const tickOwner = computed(() => char.value?.name ?? '')
function hasGem (name: string) { return (ticks.value[tickOwner.value] ?? []).includes(name) }
function toggleGem (name: string) {
  const list = new Set(ticks.value[tickOwner.value] ?? [])
  if (list.has(name)) list.delete(name)
  else list.add(name)
  ticks.value = { ...ticks.value, [tickOwner.value]: [...list] }
  try { localStorage.setItem(TICKS_KEY, JSON.stringify(ticks.value)) } catch {}
}
const haveCount = computed(() => uniqueGems.value.filter(g => hasGem(g.name)).length)
// usable at your level and not ticked
const missingGems = computed(() => (ticks.value[tickOwner.value]?.length ?? 0) ? usableNow.value.filter(g => !hasGem(g.name)) : [])

const showRecipes = ref(false)
const recipes = computed(() => VENDOR_RECIPES.filter(r => r.fromAct <= guideAct.value))

// whole Client.txt -> every character's progress
const rebuilding = ref(false)
const rebuildNote = ref('')
function rebuild () {
  rebuilding.value = true
  rebuildNote.value = ''
  const requestId = Date.now()
  const l = Host.onEvent('MAIN->CLIENT::read-game-log', (e) => {
    if (e.requestId !== requestId) return
    l.abort()
    rebuilding.value = false
    if (!e.ok || !e.lines) { rebuildNote.value = e.error ?? 'Could not read Client.txt'; return }
    const v = rebuildFromLog(levels.value, e.lines, AppConfig().language)
    update(v)
    rebuildNote.value = `Read ${e.lines.length} lines: ${v.chars.length} character${v.chars.length === 1 ? '' : 's'}.`
  })
  Host.sendEvent({ name: 'CLIENT->MAIN::read-game-log', payload: { requestId } })
}

function typeLabel (n: PobPlanNode) {
  return n.type === 'Socket' ? 'jewel socket' : n.type.toLowerCase()
}
function nodeClass (n: PobPlanNode) {
  if (n.type === 'Keystone') return 'text-orange-300'
  if (n.type === 'Notable') return 'text-yellow-200'
  if (n.type === 'Mastery') return 'text-purple-300'
  if (n.type === 'Socket') return 'text-teal-300'
  return 'text-gray-300'
}
function nodeTitle (n: PobPlanNode) {
  return [n.name, n.effect ?? n.stats].filter(Boolean).join('\n')
}

// one entry per gem name (the lowest requirement wins)
function unique (list: PobPlanGem[]) {
  const map = new Map<string, PobPlanGem>()
  for (const g of list) {
    const prev = map.get(g.name)
    if (!prev || g.reqLevel < prev.reqLevel) map.set(g.name, g)
  }
  return [...map.values()]
}
const uniqueGems = computed(() => unique(plan.value?.gems ?? []).sort((a, b) => a.reqLevel - b.reqLevel || a.name.localeCompare(b.name)))
const usableNow = computed(() => uniqueGems.value.filter(g => g.reqLevel <= level.value))
const upcoming = computed(() => uniqueGems.value.filter(g => g.reqLevel > level.value).slice(0, 5))
const newGems = computed(() => {
  const prev = plan.value?.previousGems
  if (!prev) return []
  const had = new Set(prev.map(g => g.name))
  return uniqueGems.value.filter(g => !had.has(g.name))
})

// gems that change when the character passes this step's level
const swap = computed(() => {
  const p = plan.value
  const next = p?.phases[p.phase]
  if (!p?.nextGems || !next) return null
  const cur = new Set(uniqueGems.value.map(g => g.name))
  const nxt = unique(p.nextGems)
  const nextNames = new Set(nxt.map(g => g.name))
  return {
    level: (p.phases[p.phase - 1]?.level ?? 0) + 1,
    title: next.title,
    add: nxt.filter(g => !cur.has(g.name)),
    drop: uniqueGems.value.filter(g => !nextNames.has(g.name))
  }
})

const guideAct = computed(() => STEPS[guideStep.value]?.act ?? 1)
const allActs = ref(false)
const questGems = computed(() => {
  const p = plan.value
  if (!p) return null
  const wanted = [...(p.previousGems ?? []), ...p.gems, ...(p.nextGems ?? [])]
  return planQuestGems(p.className, wanted)
})
const questRows = computed(() => {
  const q = questGems.value
  if (!q) return []
  return allActs.value ? q.steps : q.steps.filter(s => s.act === guideAct.value || s.act === guideAct.value + 1)
})

// PoB gem colours: 1 = str, 2 = dex, 3 = int
function gemClass (g: PobPlanGem) {
  const c = g.colour === 1 ? 'text-red-300' : g.colour === 2 ? 'text-green-300' : g.colour === 3 ? 'text-blue-300' : 'text-gray-300'
  return g.support ? `${c} opacity-80` : c
}
function gemTitle (g: PobPlanGem) {
  return [`${g.name}${g.support ? ' (support)' : ''}`, `Needs level ${g.reqLevel}`, g.level != null && g.maxLevel != null && g.level < g.maxLevel ? `Build keeps it at level ${g.level}` : '', g.group ?? g.slot].filter(Boolean).join('\n')
}
</script>

<style>
/* Deathloom fork: one look for section headers across the levelling pane */
.lg-head {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #9ca3af;
  border-bottom: 1px solid #374151;
  padding-bottom: 2px;
  margin-bottom: 3px;
}
.lg-head button, .lg-head .normal-case { text-transform: none; letter-spacing: 0; font-weight: 400; }
.lg-sub { font-size: 0.7rem; color: #6b7280; margin-top: 2px; }
</style>
