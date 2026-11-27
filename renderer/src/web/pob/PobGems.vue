<template>
  <!-- Deathloom fork (Gerhard 19 Nov 2026): one Gems view. Was two tabs ("For my level",
       "Whole build"). Top bar → Change now → gear pieces → Coming up. -->
  <div class="overflow-y-auto min-h-0 p-1 text-sm">
    <!-- top bar: level, stage, where "equipped" comes from -->
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 pb-1 text-xs text-gray-400">
      <span v-if="char">{{ char.name }} · level</span>
      <span v-else>Level</span>
      <input type="number" min="1" max="100" class="w-12 bg-gray-700 rounded px-1" :value="level"
        :title="char?.manual ? 'Typed in. The next level-up in game replaces it.' : 'From the game log (Client.txt). Type to change.'"
        @change="setLevel(($event.target as HTMLInputElement).value)">
      <span v-if="stageTitle" class="truncate text-gray-300" :title="stagesTitle">stage: {{ stageTitle }}</span>
      <span v-else-if="plan?.skillSet && plan.phases.length > 1" class="truncate text-gray-500" :title="`The build's skill set for this level`">skill set "{{ plan.skillSet }}"</span>
      <span class="ml-auto flex items-center gap-x-1">
        <span class="text-gray-500">Equipped from</span>
        <button class="ui-btn" :class="{ 'ui-btn-on': source === 'ticks', 'ui-btn-quiet': source !== 'ticks' }"
          title="Gems you ticked yourself (click a gem to tick it)" @click="setSource('ticks')">my ticks</button>
        <button class="ui-btn" :class="{ 'ui-btn-on': source === 'mine', 'ui-btn-quiet': source !== 'mine' }"
          title="Your character's file in Path of Building (Import character → Items and Skills)" @click="setSource('mine')">my character</button>
        <button class="ui-btn ui-btn-quiet" title="Read the build and your character file again" :disabled="loading" @click="request()">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading || me.reading.value }" /></button>
      </span>
    </div>
    <div v-if="!levelKnown && plan" class="px-1 pb-1 text-xs text-yellow-500">No level-up seen yet. Type your level above, or level up once in game.</div>

    <!-- my character: set-up / status -->
    <div v-if="source === 'mine'" class="mx-1 mb-1 rounded bg-gray-900 px-2 py-1 text-xs text-gray-400">
      <template v-if="me.minePath.value && mineReady">
        <div class="flex items-center gap-x-2">
          <span class="text-green-400 truncate flex-1" :title="me.minePath.value">
            <i class="fas fa-user-check mr-1" />{{ fileLabel(me.minePath.value) }}<template v-if="me.level.value"> · lvl {{ me.level.value }}</template></span>
          <button class="ui-btn ui-btn-quiet" @click="openPob" title="Opens this file in Path of Building on the Import tab. There: pick your character → Items and Skills (tick Delete equipment and Delete skills), Ctrl+S. Then ↻ here.">Update in PoB</button>
          <button class="ui-btn ui-btn-quiet" @click="pickOpen = !pickOpen">Change file</button>
        </div>
        <div v-if="mineEmpty" class="text-yellow-500">No gems in it yet: import your character's Items and Skills in Path of Building and save.</div>
      </template>
      <template v-else-if="me.minePath.value && me.readError.value">
        <div class="text-yellow-500">{{ me.readError.value }}</div>
      </template>
      <template v-else-if="!me.minePath.value">
        <div class="text-gray-300 pb-px">Your character isn't set up yet (once per character, about 2 minutes).</div>
        <div v-if="!me.charName.value" class="flex items-center gap-x-1 py-px">
          <span>Character name:</span>
          <input v-model="nameDraft" class="bg-gray-700 rounded px-1 w-36" placeholder="as in game" @keydown.enter="me.setTypedName(nameDraft)">
          <button class="ui-btn" :disabled="!nameDraft.trim()" @click="me.setTypedName(nameDraft)">OK</button>
          <span class="text-gray-500">(the game log hasn't seen a level-up yet)</span>
        </div>
        <div v-if="me.resolved.value.legacy" class="flex items-center gap-x-2 py-px">
          <span class="truncate">Found an older copy: <b class="text-gray-300">{{ fileLabel(me.resolved.value.legacy) }}</b></span>
          <button class="ui-btn ui-btn-primary" :disabled="!me.charName.value" @click="useFile(me.resolved.value.legacy)">Use it</button>
        </div>
        <div v-if="me.charName.value" class="flex flex-wrap items-center gap-x-2 py-px">
          <button class="ui-btn" :class="{ 'ui-btn-primary': !me.resolved.value.legacy }" :disabled="me.busy.value || !me.planPath.value"
            :title="`Copies the build you follow to '${fileLabel(me.targetPath.value)}' and opens Path of Building. Your build is never changed.`"
            @click="makeFile">Make {{ fileLabel(me.targetPath.value) }}</button>
          <button v-if="me.files.value.length" class="ui-btn ui-btn-quiet" @click="pickOpen = !pickOpen">Pick an existing file</button>
        </div>
        <ol class="list-decimal pl-4 pt-px text-gray-500">
          <li>Make the file (button above). Path of Building opens.</li>
          <li>PoB opens <b class="text-gray-300">{{ fileLabel(me.targetPath.value) || 'My characters/<your character>' }}</b> on the Import tab (with an older PoB: open it yourself → Import/Export Build). Import character: Tick Delete equipment and Delete skills, click <b class="text-gray-300">Items and Skills</b> (not the tree).</li>
          <li>Ctrl+S in PoB, then ↻ here. Any build you follow compares against this file, so renaming or updating the build is fine.</li>
        </ol>
      </template>
      <div v-if="me.manageError.value" class="text-red-400">{{ me.manageError.value }}</div>
      <div v-if="pickOpen" class="flex items-center gap-x-1 pt-px">
        <span>File for {{ me.charName.value || 'this character' }}:</span>
        <select class="bg-gray-700 rounded px-1 max-w-[16rem]" :value="me.minePath.value ?? ''" @change="useFile(($event.target as HTMLSelectElement).value || null)">
          <option value="">(none)</option>
          <option v-for="f of me.files.value" :key="f" :value="f">{{ fileLabel(f) }}</option>
        </select>
      </div>
    </div>

    <div v-if="error" class="p-1 text-gray-400">{{ error }}</div>
    <div v-else-if="!groups && loading" class="p-1 text-gray-500 lg-loading">Loading from Path of Building…</div>
    <template v-else-if="groups">
      <!-- Change now: only when there's something to do -->
      <div v-if="change.total" class="rounded px-1 py-1 mb-1 bg-gray-900 border-l-2" style="border-color: rgb(var(--accent))">
        <div class="lg-head text-gray-200">Change now ({{ change.total }})</div>
        <div v-if="change.takeOut.length" class="flex flex-wrap items-baseline gap-x-2">
          <span class="w-16 shrink-0 text-xs text-red-300">take out {{ change.takeOut.length }}</span>
          <button v-for="n of change.takeOut" :key="'t' + n" type="button" class="line-through text-red-300"
            :disabled="source !== 'ticks'" :title="source === 'ticks' ? 'Click once you\'ve taken it out' : 'Your character still has it'"
            @click="source === 'ticks' && toggleGem(n)">{{ n }}</button>
        </div>
        <div v-if="change.socket.length" class="flex flex-wrap items-baseline gap-x-2">
          <span class="w-16 shrink-0 text-xs text-green-400">socket {{ change.socket.length }}</span>
          <button v-for="g of change.socket" :key="'s' + g.name" type="button" :class="colourClass(g.colour, g.support)"
            :disabled="source !== 'ticks'" :title="(g.slot ? `In ${g.slot}. ` : '') + (source === 'ticks' ? 'Click when you have it equipped' : 'Not on your character yet')"
            @click="source === 'ticks' && toggleGem(g.name)">{{ g.name }}</button>
        </div>
        <div v-if="change.levelUp.length" class="flex flex-wrap items-baseline gap-x-2">
          <span class="w-16 shrink-0 text-xs text-yellow-500">level up {{ change.levelUp.length }}</span>
          <span v-for="g of change.levelUp" :key="'l' + g.name" class="text-yellow-200" :title="`You have ${g.have}, the build uses ${g.want} (level/quality)`">
            {{ g.name }} <span class="text-xs text-gray-500">{{ g.have }} → {{ g.want }}</span></span>
        </div>
      </div>
      <div v-else-if="statusKnown && counts.have" class="px-1 pb-1 text-xs text-green-500"><i class="fas fa-check mr-1" />Nothing to change at level {{ level }}.</div>

      <!-- gear pieces -->
      <div v-for="sv of view.slots" :key="sv.slot" class="rounded px-1 py-1 mb-1 bg-gray-900">
        <div class="flex items-center gap-x-2 text-xs">
          <span class="text-gray-300 shrink-0">{{ sv.slot }}</span>
          <span class="text-gray-500 truncate flex-1" :title="sv.item?.baseName">{{ sv.item?.name ?? '' }}</span>
          <span v-if="sv.rows.length" class="text-gray-500 shrink-0"
            :title="`Sockets the gems in this slot need and the biggest link. Any gem fits any socket; a socket of the gem's colour adds 10% quality. Gem colours: ${coloursText(sv.needs) || 'none'}`">{{ needsText(sv.needs) }}</span>
          <span v-else class="text-gray-600 shrink-0">no gems</span>
        </div>
        <div v-if="sv.slot === NO_SLOT" class="text-xs text-gray-500 py-px">No gear piece set in PoB for these: put them wherever you have the sockets.</div>
        <template v-if="sv.slot !== NO_SLOT && sv.rows.length">
          <div class="flex items-center gap-x-2 text-xs py-px">
            <span class="w-14 shrink-0 text-gray-500">build</span>
            <socket-row :sockets="sv.item?.sockets" :none="!sv.item ? 'no item in PoB' : 'no sockets'" />
            <span v-if="sv.item && !sv.buildCheck.ok" class="text-yellow-600">{{ checkText(sv.buildCheck, sv.needs) }}</span>
          </div>
          <div v-if="sv.liveCheck" class="flex items-center gap-x-2 text-xs py-px">
            <span class="w-14 shrink-0 text-gray-500" :title="sv.liveItem?.name">yours</span>
            <socket-row :sockets="sv.liveItem?.sockets" :none="!sv.liveItem ? 'nothing equipped there' : 'no sockets'" />
            <span v-if="sv.liveItem" :class="sv.liveCheck.ok ? 'text-green-500' : 'text-red-400'">{{ sv.liveCheck.ok ? 'fits' : checkText(sv.liveCheck, sv.needs) }}</span>
            <span v-if="sv.liveItem && sv.liveCheck.coloured" class="text-gray-500" title="Gems in a socket of their colour get +10% quality">{{ bonusText(sv.liveCheck) }}</span>
          </div>
        </template>
        <div v-for="row of sv.rows" :key="row.group.index" class="mt-1 pl-1 border-l-2"
          :class="row.group.main ? 'border-yellow-600' : 'border-gray-700'">
          <div v-if="sv.rows.length > 1 || row.group.main || row.liveSlot" class="flex items-baseline gap-x-2 text-xs text-gray-500">
            <span class="text-gray-400 truncate min-w-0 flex-1">{{ linkTitle(row) }}</span>
            <span v-if="row.group.main" class="text-yellow-500 shrink-0">main skill</span>
            <span v-if="row.liveSlot" class="shrink-0">yours: {{ row.liveSlot }}</span>
          </div>
          <div v-for="g of statusOf(row)" :key="g.name" class="flex items-baseline gap-x-2" :class="{ hidden: !g.enabled }">
            <button type="button" class="w-4 shrink-0 text-center" :class="statusClass(g.status)" :title="statusTitle(g)"
              :disabled="source !== 'ticks'" @click="source === 'ticks' && toggleGem(g.name)">{{ statusIcon(g.status) }}</button>
            <span class="flex-1 truncate" :class="colourClass(g.colour, g.support)">{{ g.name }}</span>
            <span class="text-gray-500 shrink-0 text-xs" title="Level / quality the build uses">{{ g.level ?? '?' }}/{{ g.quality ?? 0 }}</span>
            <span class="w-24 text-right shrink-0 text-xs truncate" :class="statusClass(g.status)">{{ statusText(g) }}</span>
          </div>
        </div>
      </div>
      <div v-if="view.granted.length" class="px-1 pb-1 text-xs text-gray-500">
        From items: {{ view.granted.map(r => r.group.gems.map(g => g.name).join(', ')).join(' · ') }}
      </div>

      <!-- Coming up: collapsed -->
      <div v-if="later.length || swap" class="rounded px-1 py-1 mb-1 bg-gray-900">
        <button class="ui-btn ui-btn-quiet lg-head w-full text-left" @click="setUpOpen(!upOpen)">
          <i class="fas mr-1" :class="upOpen ? 'fa-caret-down' : 'fa-caret-right'" />Coming up
          <span class="normal-case tracking-normal text-gray-500">{{ swap ? `· next stage at level ${swap.level}` : `· ${later.length} gem${later.length > 1 ? 's' : ''} later` }}</span>
        </button>
        <template v-if="upOpen">
          <div v-for="g of later" :key="'l' + g.name" class="flex items-baseline gap-x-2">
            <span class="w-12 text-xs text-gray-500 shrink-0">🔒 {{ g.reqLevel }}</span>
            <span :class="colourClass(g.colour, g.support)">{{ g.name }}</span>
            <span v-if="g.group || g.slot" class="text-xs text-gray-600 truncate">{{ g.group ?? g.slot }}</span>
          </div>
          <div v-if="swap" class="pt-1 text-xs">
            <div class="text-gray-400">At level {{ swap.level }}<template v-if="swap.title"> ("{{ swap.title }}")</template>:</div>
            <div v-if="swap.add.length" class="flex flex-wrap gap-x-3 pl-2"><span class="text-green-500">add</span>
              <span v-for="g of swap.add" :key="'s+' + g.name" :class="colourClass(g.colour, g.support)">{{ g.name }}</span></div>
            <div v-if="swap.drop.length" class="flex flex-wrap gap-x-3 pl-2"><span class="text-red-400">take out</span>
              <span v-for="g of swap.drop" :key="'s-' + g.name" class="text-gray-500 line-through">{{ g.name }}</span></div>
            <div v-if="!swap.add.length && !swap.drop.length" class="pl-2 text-gray-500">Same gems.</div>
          </div>
        </template>
      </div>

      <div v-if="view.hidden.length" class="px-1 pb-1 text-xs text-gray-500">
        <button class="ui-btn ui-btn-quiet" @click="showHidden = !showHidden">
          <i class="fas" :class="showHidden ? 'fa-caret-down' : 'fa-caret-right'" />
          {{ view.hidden.length }} group{{ view.hidden.length > 1 ? 's' : '' }} switched off in PoB
        </button>
        <div v-if="showHidden">
          <div v-for="row of view.hidden" :key="row.group.index" class="text-gray-600">
            {{ pobText(row.group.label) || row.group.gems[0]?.name }}{{ row.group.slot ? ` (${row.group.slot}, off)` : '' }}:
            {{ row.group.gems.map(g => g.name).join(', ') }}
          </div>
        </div>
      </div>
      <div v-if="source === 'mine' && comparison?.unmatched.length" class="px-1 pt-1 text-xs text-gray-500">
        On your character but not in the build:
        <div v-for="g of comparison.unmatched" :key="g.index">{{ g.slot ?? 'No slot' }}: {{ g.gems.map(x => x.name).join(', ') }}</div>
      </div>
      <button class="px-1 pt-1 text-xs text-gray-600 hover:text-gray-300" @click="helpOpen = !helpOpen"><i class="fas fa-question-circle mr-1" />What the marks mean</button>
      <div v-if="helpOpen" class="px-1 text-xs text-gray-500">
        ✓ have · ◐ you have it lower (level/quality) · ○ missing · 🔒 your level is too low yet.
        Each bar on the left is one link group: link those gems together. build = sockets of the item in PoB, yours = your character's.
        <template v-if="stages.length"> Only the current stage's groups show; later ones are under Coming up.</template>
        With <b>my ticks</b>, click a mark or a gem in Change now to tick it.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onUnmounted, ref, shallowRef, watch } from 'vue'
import { saveShared } from './build-progress'
import type { PobPlan, PobPlanGem, PobSocketGroup, PobSocketedItem } from '@ipc/types'
import { pobText } from './labels'
import { Host } from '@/web/background/IPC'
import { CHAR_LEVELS_KEY, loadCharLevels, saveCharLevels, currentChar, type CharLevels } from '@/web/companion/char-level'
import { gemStages, stageFor } from './gem-stages'
import { NO_SLOT, compareGems, bySlot, parseSockets, needsText, checkText, coloursText, bonusText, type GroupRow } from './gems'
import { mergedRows, changeNow, countStatus, gemKey, gemStatus, type MergedGem, type MergedStatus, type Source } from './gems-merged'
import { useMyCharacter, fileLabel } from './use-my-character'

// --- level (Client.txt, or typed in) ---
const levels = ref<CharLevels>(loadCharLevels())
const onStorage = (e: StorageEvent) => { if (e.key === CHAR_LEVELS_KEY) levels.value = loadCharLevels() }
window.addEventListener('storage', onStorage)
const char = computed(() => currentChar(levels.value))
const levelKnown = computed(() => char.value != null)
const level = computed(() => char.value?.level ?? 1)
function setLevel (text: string) {
  const n = Math.round(Number(text))
  if (!Number.isFinite(n) || n < 1 || n > 100) return
  const v = { ...levels.value, manual: { name: char.value?.name ?? '', level: n } }
  levels.value = v
  saveCharLevels(v)
}

// --- source of "equipped": ticks (shared with the Next tab) or your character's file ---
const SOURCE_KEY = 'deathloom.gems-source.v1'
const source = ref<Source>((() => { try { return localStorage.getItem(SOURCE_KEY) === 'mine' || localStorage.getItem('deathloom.gems-mine.v1') === '1' ? 'mine' : 'ticks' } catch { return 'ticks' } })())
function setSource (s: Source) {
  source.value = s
  try { localStorage.setItem(SOURCE_KEY, s) } catch {}
  if (s === 'mine') me.reload()
}
const TICKS_KEY = 'deathloom.gem-ticks.v1'
function loadTicks (): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(TICKS_KEY) ?? '{}') ?? {} } catch { return {} }
}
const ticks = ref<Record<string, string[]>>(loadTicks())
const onTicks = (e: StorageEvent) => { if (e.key === TICKS_KEY) ticks.value = loadTicks() }
window.addEventListener('storage', onTicks)
const tickSet = computed(() => new Set(ticks.value[char.value?.name ?? ''] ?? []))
function toggleGem (name: string) {
  const owner = char.value?.name ?? ''
  const list = new Set(ticks.value[owner] ?? [])
  if (list.has(name)) list.delete(name)
  else list.add(name)
  ticks.value = { ...ticks.value, [owner]: [...list] }
  saveShared(TICKS_KEY, ticks.value)
}

const me = useMyCharacter()
const nameDraft = ref('')
const pickOpen = ref(false)
const mineReady = computed(() => !!me.minePath.value && me.groups.value != null)
const mineEmpty = computed(() => mineReady.value && !me.groups.value!.length)
function useFile (p: string | null) { me.link(p); pickOpen.value = false; me.read() }
function makeFile () { me.makeFile(() => { openPob(); me.read() }) }
// opens PoB on the Import tab with your character's file (PoB fork); the import itself is yours to start
function openPob () { Host.sendEvent({ name: 'CLIENT->MAIN::user-action', payload: { action: 'open-pob', build: me.minePath.value ?? undefined } }) }

// --- the build's socket groups + items (loadout picked in the Build tab) ---
const loading = ref(false)
const error = ref<string | null>(null)
const groups = shallowRef<PobSocketGroup[] | null>(null)
const items = shallowRef<PobSocketedItem[]>([])
let gemsId = 800_000
const lsGems = Host.onEvent('MAIN->CLIENT::pob-gems', (e) => {
  if (e.requestId !== gemsId) return
  loading.value = false
  if (!e.ok) { error.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, ''); return }
  error.value = null
  groups.value = e.groups ?? []
  items.value = e.items ?? []
})
const lsChar = Host.onEvent('MAIN->CLIENT::pob-character', () => { request() })

// --- levelling plan (skill set for this level) ---
const plan = shallowRef<PobPlan | null>(null)
let planId = 500_000
const lsPlan = Host.onEvent('MAIN->CLIENT::pob-plan', (e) => {
  if (e.requestId !== planId) return
  plan.value = e.ok ? (e.plan ?? null) : null
})
function requestPlan () {
  planId += 1
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-plan', payload: { requestId: planId, level: level.value, questPoints: levels.value.questPoints ?? 0 } })
}
function request (refreshGear = false) {
  loading.value = true
  gemsId += 1
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-gems', payload: { requestId: gemsId, refreshGear } })
  requestPlan()
  if (source.value === 'mine') me.reload()
}
defineExpose({ request })
request()
watch(level, () => requestPlan())
onUnmounted(() => {
  lsGems.abort(); lsChar.abort(); lsPlan.abort()
  window.removeEventListener('storage', onStorage)
  window.removeEventListener('storage', onTicks)
})

// --- stages (labels in PoB's skill list) ---
function unique (list: PobPlanGem[]) {
  const map = new Map<string, PobPlanGem>()
  for (const g of list) {
    const prev = map.get(g.name)
    if (!prev || g.reqLevel < prev.reqLevel) map.set(g.name, g)
  }
  return [...map.values()]
}
const stages = computed(() => {
  const planGems = (plan.value?.gems ?? []).filter(g => g.groupId != null)
  if (!groups.value || !planGems.length) return []
  const byIndex = new Map(groups.value.map(g => [g.index, new Set(g.gems.map(x => x.name))]))
  const matched = planGems.filter(g => byIndex.get(g.groupId!)?.has(g.name)).length
  if (matched < planGems.length * 0.8) return []
  return gemStages(groups.value)
})
const stageIdx = computed(() => stages.value.length ? stageFor(stages.value, level.value) : -1)
const stageTitle = computed(() => stages.value[stageIdx.value]?.title ?? '')
const stagesTitle = computed(() => 'The build\'s stages (level-range labels in PoB): ' + stages.value.map((s, i) => (i === stageIdx.value ? `[${s.title}]` : s.title)).join(' → '))
const stageOfGroup = computed(() => {
  const m = new Map<number, number>()
  stages.value.forEach((s, i) => { for (const id of s.groups) m.set(id, i) })
  return m
})
function stageGems (i: number) {
  return (plan.value?.gems ?? []).filter(g => (g.groupId != null ? stageOfGroup.value.get(g.groupId) ?? -1 : -1) === i)
}
const planNow = computed(() => {
  const all = plan.value?.gems ?? []
  if (!stages.value.length) return all
  return [...stageGems(-1), ...(stageIdx.value >= 0 ? stageGems(stageIdx.value) : [])]
})
const nowNames = computed(() => new Set(planNow.value.map(g => g.name)))
const drop = computed(() => {
  if (stages.value.length) {
    const earlier = stages.value.flatMap((_, i) => i < stageIdx.value ? stageGems(i) : [])
    return unique(earlier).filter(g => !nowNames.value.has(g.name))
  }
  return unique(plan.value?.previousGems ?? []).filter(g => !nowNames.value.has(g.name))
})
const reqLevels = computed(() => {
  const m = new Map<string, number>()
  for (const g of [...(plan.value?.gems ?? []), ...(plan.value?.nextGems ?? [])]) {
    const k = gemKey(g.name)
    const prev = m.get(k)
    if (prev == null || g.reqLevel < prev) m.set(k, g.reqLevel)
  }
  return m
})
const later = computed(() => unique(planNow.value).filter(g => g.reqLevel > level.value).sort((a, b) => a.reqLevel - b.reqLevel || a.name.localeCompare(b.name)))
const swap = computed(() => {
  const cur = unique(planNow.value)
  const curNames = new Set(cur.map(g => g.name))
  let nxt: PobPlanGem[]; let lvl: number; let title = ''
  if (stages.value.length) {
    const next = stages.value[stageIdx.value + 1]
    if (!next) return null
    nxt = unique([...stageGems(-1), ...stageGems(stageIdx.value + 1)]); lvl = next.from; title = next.title
  } else {
    const p = plan.value
    if (!p?.nextGems || !p.phases[p.phase]) return null
    nxt = unique(p.nextGems); lvl = (p.phases[p.phase - 1]?.level ?? 0) + 1; title = p.nextSkillSet ?? ''
  }
  const nextNames = new Set(nxt.map(g => g.name))
  return { level: lvl, title, add: nxt.filter(g => !curNames.has(g.name)), drop: cur.filter(g => !nextNames.has(g.name)) }
})
const UP_KEY = 'deathloom.gems-coming-up.v1'
const upOpen = ref((() => { try { return localStorage.getItem(UP_KEY) === '1' } catch { return false } })())
function setUpOpen (v: boolean) { upOpen.value = v; try { localStorage.setItem(UP_KEY, v ? '1' : '0') } catch {} }

// --- gear pieces: the stage's groups compared with what you have ---
const shownGroups = computed(() => {
  if (!groups.value) return []
  if (!stages.value.length) return groups.value
  return groups.value.filter(g => { const s = stageOfGroup.value.get(g.index); return s == null || s === stageIdx.value })
})
const live = computed(() => source.value === 'mine' && mineReady.value ? me.groups.value : undefined)
const comparison = computed(() => groups.value ? compareGems(shownGroups.value, live.value) : null)
const mergeInput = computed(() => ({
  rows: comparison.value?.groups ?? [],
  level: level.value,
  reqLevels: reqLevels.value,
  source: source.value,
  ticks: tickSet.value,
  mineReady: mineReady.value
}))
const view = computed(() => {
  const empty = { slots: [], hidden: [], granted: [] as GroupRow[] }
  if (!comparison.value) return empty
  const granted = comparison.value.groups.filter(r => r.group.source && r.group.enabled)
  const rest = { ...comparison.value, groups: comparison.value.groups.filter(r => !(r.group.source && r.group.enabled)) }
  return { ...bySlot(rest, items.value, live.value ? me.items.value : undefined), granted }
})
const charGems = computed(() => new Set((me.groups.value ?? []).flatMap(g => g.gems.map(x => gemKey(x.name)))))
const change = computed(() => changeNow(mergeInput.value, { now: planNow.value, drop: drop.value, charGems: charGems.value }))
const counts = computed(() => countStatus(mergedRows(mergeInput.value)))
const statusKnown = computed(() => source.value === 'ticks' || mineReady.value)
function statusOf (row: GroupRow): MergedGem[] { return row.gems.map(g => gemStatus(g, mergeInput.value)) }

// --- display helpers ---
const SocketRow = defineComponent({
  props: { sockets: String, none: String },
  setup (props) {
    const colour = (c: string) => ({ R: '#c0392b', G: '#27ae60', B: '#2e86de', W: '#eeeeee', A: '#444', D: '#888' } as Record<string, string>)[c] ?? '#888'
    return () => {
      const grps = parseSockets(props.sockets)
      if (!grps.length) return h('span', { class: 'text-gray-600' }, props.none)
      const out: ReturnType<typeof h>[] = []
      grps.forEach((grp, gi) => {
        if (gi) out.push(h('span', { class: 'w-2' }))
        grp.forEach((c, ci) => {
          if (ci) out.push(h('span', { class: 'inline-block w-1.5 h-0.5 bg-gray-400' }))
          out.push(h('span', { class: 'inline-block w-3 h-3 rounded-full border border-black', style: { background: colour(c) } }))
        })
      })
      return h('span', { class: 'flex items-center' }, out)
    }
  }
})
function linkTitle (row: GroupRow) {
  const active = row.group.gems.filter(g => g.enabled && !g.support).map(g => g.name)
  const n = row.group.gems.filter(g => g.enabled).length
  return `${pobText(row.group.label) || active.join(' + ') || 'Supports'} · ${n}L`
}
function colourClass (c: number | undefined, support: boolean) {
  const cls = c === 1 ? 'text-red-300' : c === 2 ? 'text-green-300' : c === 3 ? 'text-blue-300' : 'text-gray-300'
  return support ? `${cls} opacity-80` : cls
}
function statusIcon (s: MergedStatus) { return { have: '✓', low: '◐', missing: '○', locked: '🔒', unknown: '·' }[s] }
function statusClass (s: MergedStatus) {
  return { have: 'text-green-500', low: 'text-yellow-500', missing: 'text-red-400', locked: 'text-gray-500', unknown: 'text-gray-600' }[s]
}
function statusText (g: MergedGem) {
  switch (g.status) {
    case 'have': return g.have?.slot ? `have · ${g.have.slot}` : 'have'
    case 'low': return `have ${g.have?.level ?? '?'}/${g.have?.quality ?? 0}`
    case 'missing': return 'missing'
    case 'locked': return `at lvl ${g.reqLevel}`
    default: return ''
  }
}
function statusTitle (g: MergedGem) {
  const tick = source.value === 'ticks' ? '\nClick to tick / untick' : ''
  switch (g.status) {
    case 'have': return (g.have?.slot ? `You have it, but in ${g.have.slot}` : 'You have it') + tick
    case 'low': return `You have it at ${g.have?.level ?? '?'}/${g.have?.quality ?? 0}, lower than the build`
    case 'missing': return 'Not equipped yet' + tick
    case 'locked': return `Usable from character level ${g.reqLevel}` + tick
    default: return source.value === 'mine' ? 'Set up your character file above to compare' : ''
  }
}
const showHidden = ref(false)
const helpOpen = ref(false)
</script>

<style scoped>
.lg-head {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 0.125rem;
}
</style>
