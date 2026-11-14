<template>
  <!-- Deathloom fork: the build's gems for the character's level (gear panel → Gems → For my level).
       Uses the levelling plan (skill sets named after a level, "Level 12", "Level 30", …). -->
  <div class="text-sm">
    <div class="flex items-center gap-x-2 px-1 pb-1 text-xs text-gray-400">
      <span v-if="char">{{ char.name }} · level</span>
      <span v-else>Level</span>
      <input type="number" min="1" max="100" class="w-12 bg-gray-700 rounded px-1" :value="level"
        :title="char?.manual ? 'Typed in. The next level-up in game replaces it.' : 'From the game log (Client.txt). Type to change.'"
        @change="setLevel(($event.target as HTMLInputElement).value)">
      <span v-if="plan?.skillSet" class="truncate text-gray-500" :title="`The build's skill set for this level: ${plan.skillSet}`">skill set "{{ plan.skillSet }}"</span>
      <span v-if="loading" class="ml-auto text-gray-600"><i class="fas fa-sync-alt fa-spin" /></span>
    </div>
    <div v-if="error" class="p-1 text-gray-400">{{ error }}</div>
    <div v-else-if="!plan && loading" class="p-1 text-gray-500">Loading from Path of Building…</div>
    <template v-else-if="plan">
      <div v-if="!levelKnown" class="px-1 pb-1 text-xs text-yellow-500">No level-up seen yet. Type your level above, or level up once in game.</div>

      <!-- take out -->
      <div v-if="drop.length" class="rounded px-1 py-1 mb-1 bg-gray-900">
        <div class="lg-head text-red-300"><i class="fas fa-minus-circle mr-1" />Take out ({{ drop.length }})</div>
        <div class="text-xs text-gray-500 pb-px">The previous levelling step used these; this one doesn't.</div>
        <div class="flex flex-wrap gap-x-3">
          <button v-for="g of drop" :key="'d' + g.name" type="button" class="line-through"
            :class="hasGem(g.name) ? 'text-red-300' : 'text-gray-600'"
            :title="gemTitle(g) + (hasGem(g.name) ? '\nTicked as equipped: click once you\'ve taken it out' : '\nTaken out')"
            @click="toggleGem(g.name)">{{ g.name }}</button>
        </div>
      </div>

      <!-- use now, by gear piece and link group -->
      <div class="rounded px-1 py-1 mb-1 bg-gray-900">
        <div class="lg-head text-green-400 flex items-baseline"><i class="fas fa-check-circle mr-1" />Socket now ({{ nowCount }})
          <span class="ml-auto normal-case tracking-normal text-gray-500">{{ equippedNow }} of {{ nowCount }} equipped</span></div>
        <div v-if="nowCount && !equippedNow" class="text-xs text-gray-500 pb-px">Click a gem to tick it as equipped.</div>
        <div v-if="!nowCount" class="text-xs text-gray-500">None of this step's gems can be used at level {{ level }} yet.</div>
        <div v-for="s of nowSlots" :key="s.slot" class="pb-1">
          <div class="text-xs text-gray-500">{{ s.slot }}</div>
          <div v-for="grp of s.groups" :key="grp.name" class="pl-1 border-l-2 border-gray-700 mb-px">
            <div class="flex flex-wrap items-baseline gap-x-2">
              <template v-for="(g, i) of grp.gems" :key="g.name">
                <span v-if="i" class="text-gray-600">+</span>
                <button type="button" class="text-left"
                  :class="[gemClass(g), isNew(g) ? 'underline decoration-green-500 underline-offset-2' : '', hasGem(g.name) ? '' : 'opacity-60']"
                  :title="gemTitle(g) + (isNew(g) ? '\nNew in this step' : '') + (hasGem(g.name) ? '\nEquipped (click to untick)' : '\nClick when you have it equipped')"
                  @click="toggleGem(g.name)"><i class="fas mr-0.5 text-xs" :class="hasGem(g.name) ? 'fa-check-square text-green-400' : 'fa-square text-gray-600'" />{{ g.name }}</button>
              </template>
              <span class="text-xs text-gray-600">{{ grp.gems.length }}L</span>
            </div>
          </div>
        </div>
        <div v-if="anyNew" class="text-xs text-gray-600">Underlined: new in this levelling step.</div>
      </div>

      <!-- later -->
      <div v-if="later.length || swap" class="rounded px-1 py-1 mb-1 bg-gray-900">
        <div class="lg-head text-gray-400"><i class="fas fa-hourglass-half mr-1" />Coming up</div>
        <div v-for="g of laterShown" :key="'l' + g.name" class="flex items-baseline gap-x-2">
          <span class="w-12 text-xs text-gray-500 shrink-0">lvl {{ g.reqLevel }}</span>
          <span :class="gemClass(g)" :title="gemTitle(g)">{{ g.name }}</span>
          <span v-if="g.group || g.slot" class="text-xs text-gray-600 truncate">{{ g.group ?? g.slot }}</span>
        </div>
        <button v-if="later.length > 5" class="text-xs text-gray-500 hover:text-gray-200" @click="allLater = !allLater">
          {{ allLater ? 'fewer' : `all ${later.length}` }}</button>
        <div v-if="swap" class="pt-1 text-xs">
          <div class="text-gray-400"><i class="fas fa-exchange-alt mr-1 text-gray-500" />At level {{ swap.level }}<template v-if="plan.nextSkillSet"> (skill set "{{ plan.nextSkillSet }}")</template>:</div>
          <div v-if="swap.add.length" class="flex flex-wrap gap-x-3 pl-2"><span class="text-green-500">add</span>
            <span v-for="g of swap.add" :key="'s+' + g.name" :class="gemClass(g)" :title="gemTitle(g)">{{ g.name }}</span></div>
          <div v-if="swap.drop.length" class="flex flex-wrap gap-x-3 pl-2"><span class="text-red-400">take out</span>
            <span v-for="g of swap.drop" :key="'s-' + g.name" class="text-gray-500 line-through" :title="gemTitle(g)">{{ g.name }}</span></div>
          <div v-if="!swap.add.length && !swap.drop.length" class="pl-2 text-gray-500">Same gems.</div>
        </div>
      </div>

      <div v-if="plan.phases.length <= 1" class="px-1 text-xs text-gray-500">
        This build has one skill set, so it shows the endgame gems you can already use. Name extra skill sets in Path of Building after a level
        ("Level 12", "Level 30", …) to get take-out and swap steps while levelling.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { PobPlan, PobPlanGem } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { CHAR_LEVELS_KEY, loadCharLevels, saveCharLevels, currentChar, type CharLevels } from '@/web/companion/char-level'

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

// "equipped" ticks per character, shared with the Next tab's "tick what you have"
const TICKS_KEY = 'deathloom.gem-ticks.v1'
function loadTicks (): Record<string, string[]> {
  try { return JSON.parse(localStorage.getItem(TICKS_KEY) ?? '{}') ?? {} } catch { return {} }
}
const ticks = ref<Record<string, string[]>>(loadTicks())
const onTicks = (e: StorageEvent) => { if (e.key === TICKS_KEY) ticks.value = loadTicks() }
window.addEventListener('storage', onTicks)
const tickOwner = computed(() => char.value?.name ?? '')
function hasGem (name: string) { return (ticks.value[tickOwner.value] ?? []).includes(name) }
function toggleGem (name: string) {
  const list = new Set(ticks.value[tickOwner.value] ?? [])
  if (list.has(name)) list.delete(name)
  else list.add(name)
  ticks.value = { ...ticks.value, [tickOwner.value]: [...list] }
  try { localStorage.setItem(TICKS_KEY, JSON.stringify(ticks.value)) } catch {}
}

const loading = ref(false)
const error = ref<string | null>(null)
const plan = shallowRef<PobPlan | null>(null)
// own id range: the Next tab asks for plans in the same window
let lastRequestId = 500_000
const listener = Host.onEvent('MAIN->CLIENT::pob-plan', (e) => {
  if (e.requestId !== lastRequestId) return
  loading.value = false
  if (!e.ok) {
    error.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '')
    return
  }
  error.value = null
  plan.value = e.plan ?? null
})
function request () {
  loading.value = true
  lastRequestId += 1
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-plan',
    payload: { requestId: lastRequestId, level: level.value, questPoints: levels.value.questPoints ?? 0 }
  })
}
defineExpose({ request })
watch(level, () => { request() }, { immediate: true })
onUnmounted(() => {
  listener.abort()
  window.removeEventListener('storage', onStorage)
  window.removeEventListener('storage', onTicks)
})

// one entry per gem name (the lowest requirement wins)
function unique (list: PobPlanGem[]) {
  const map = new Map<string, PobPlanGem>()
  for (const g of list) {
    const prev = map.get(g.name)
    if (!prev || g.reqLevel < prev.reqLevel) map.set(g.name, g)
  }
  return [...map.values()]
}

const gems = computed(() => plan.value?.gems ?? [])
const names = computed(() => new Set(gems.value.map(g => g.name)))
const prevNames = computed(() => plan.value?.previousGems ? new Set(plan.value.previousGems.map(g => g.name)) : null)

const drop = computed(() => {
  const prev = plan.value?.previousGems
  if (!prev) return []
  return unique(prev).filter(g => !names.value.has(g.name))
})
function isNew (g: PobPlanGem) {
  return prevNames.value != null && !prevNames.value.has(g.name)
}
const anyNew = computed(() => nowSlots.value.some(s => s.groups.some(grp => grp.gems.some(isNew))))

// usable now, grouped by gear piece then link group (skills before supports)
const nowSlots = computed(() => {
  const bySlot = new Map<string, Map<string, PobPlanGem[]>>()
  for (const g of gems.value) {
    if (g.reqLevel > level.value) continue
    const slot = g.slot ?? 'No gear piece set in PoB'
    const group = g.group ?? g.name
    if (!bySlot.has(slot)) bySlot.set(slot, new Map())
    const groups = bySlot.get(slot)!
    if (!groups.has(group)) groups.set(group, [])
    const list = groups.get(group)!
    if (!list.some(x => x.name === g.name)) list.push(g)
  }
  return [...bySlot.entries()].map(([slot, groups]) => ({
    slot,
    groups: [...groups.entries()].map(([name, list]) => ({
      name,
      gems: list.sort((a, b) => Number(a.support) - Number(b.support) || a.name.localeCompare(b.name))
    }))
  }))
})
const equippedNow = computed(() => unique(gems.value).filter(g => g.reqLevel <= level.value && hasGem(g.name)).length)
const nowCount = computed(() => unique(gems.value).filter(g => g.reqLevel <= level.value).length)

const later = computed(() => unique(gems.value).filter(g => g.reqLevel > level.value).sort((a, b) => a.reqLevel - b.reqLevel || a.name.localeCompare(b.name)))
const allLater = ref(false)
const laterShown = computed(() => allLater.value ? later.value : later.value.slice(0, 5))

const swap = computed(() => {
  const p = plan.value
  const next = p?.phases[p.phase]
  if (!p?.nextGems || !next) return null
  const cur = unique(gems.value)
  const curNames = new Set(cur.map(g => g.name))
  const nxt = unique(p.nextGems)
  const nextNames = new Set(nxt.map(g => g.name))
  return {
    level: (p.phases[p.phase - 1]?.level ?? 0) + 1,
    add: nxt.filter(g => !curNames.has(g.name)),
    drop: cur.filter(g => !nextNames.has(g.name))
  }
})

// PoB gem colours: 1 = str, 2 = dex, 3 = int
function gemClass (g: PobPlanGem) {
  const c = g.colour === 1 ? 'text-red-300' : g.colour === 2 ? 'text-green-300' : g.colour === 3 ? 'text-blue-300' : 'text-gray-300'
  return g.support ? `${c} opacity-80` : c
}
function gemTitle (g: PobPlanGem) {
  const parts = [g.support ? 'Support gem' : 'Skill gem', `usable from level ${g.reqLevel}`]
  if (g.level) parts.push(`build uses gem level ${g.level}${g.levelReq ? ` (needs character level ${g.levelReq})` : ''}`)
  if (g.group) parts.push(`link group: ${g.group}`)
  if (g.slot) parts.push(`in ${g.slot}`)
  return parts.join('\n')
}
</script>

<style scoped>
.lg-head {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding-bottom: 0.125rem;
}
</style>
