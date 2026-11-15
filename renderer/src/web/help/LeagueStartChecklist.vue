<template>
  <!-- Deathloom fork (idea 14): league-start checklist, from Gerhard's league-start
       playbook; ticks are kept per league (this computer only) -->
  <section>
    <h2>League-start checklist <span class="text-gray-500 text-xs font-normal">· {{ league || 'no league picked' }}</span></h2>
    <p class="hint">Ticks are saved per league, so a new league starts with an empty list. {{ done }}/{{ ITEMS.length }} done.</p>
    <div v-for="g of GROUPS" :key="g.id" class="mt-2">
      <div class="text-gray-400 text-xs uppercase tracking-wide">{{ g.label }}</div>
      <label v-for="it of ITEMS.filter(i => i.group === g.id)" :key="it.id" class="flex items-start gap-2 py-0.5 cursor-pointer">
        <input type="checkbox" class="mt-1" :checked="ticked.includes(it.id)" @change="toggle(it.id)" />
        <span :class="ticked.includes(it.id) ? 'text-gray-500 line-through' : 'text-gray-200'">
          {{ it.text }} <span v-if="it.where" class="text-gray-500">({{ it.where }})</span></span>
      </label>
    </div>
    <button class="btn mt-2" :disabled="!ticked.length" @click="clear">Untick all for {{ league || 'this league' }}</button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLeagues } from '@/web/background/Leagues'

const GROUPS = [
  { id: 'before', label: 'Before launch' },
  { id: 'launch', label: 'At launch' },
  { id: 'during', label: 'First days' }
]
const ITEMS: Array<{ id: string, group: string, text: string, where?: string }> = [
  { id: 'notes', group: 'before', text: 'Read the patch notes: is your skill, its supports, your ascendancy or key unique buffed, nerfed or not mentioned?' },
  { id: 'pick', group: 'before', text: 'Pick a cheap starter build and a backup that fit how you play', where: 'Help → Get a build' },
  { id: 'pob', group: 'before', text: 'Make or import the build in Path of Building once it has the new league data; levelling trees for about level 30, 60 and 90', where: 'Build panel → import' },
  { id: 'push', group: 'before', text: 'Push the build so friends get it', where: 'Build panel → cloud' },
  { id: 'route', group: 'before', text: 'Check the campaign route still matches (lab timing, gem rewards, campaign changes)', where: 'Levelling tab' },
  { id: 'league', group: 'launch', text: 'Pick the new league for prices and trade', where: 'Settings → Price check → League' },
  { id: 'theme', group: 'launch', text: 'Optional: Settings → Appearance → Follow the current league' },
  { id: 'filter', group: 'launch', text: "Get a loot filter for the new league (NeverSink's on FilterBlade), tune it for your build and pick it in game", where: 'Options → UI → Loot filter' },
  { id: 'buildnotes', group: 'launch', text: "Put the filter link and the map mods you can't run in the build's notes", where: 'Build panel → Notes' },
  { id: 'atlas', group: 'during', text: 'Plan one low-effort atlas strategy that suits the build', where: 'Atlas tab → ready-made tree' },
  { id: 'sell', group: 'during', text: 'Sell early what is worth most at league start, while prices are high', where: 'Market overview' },
  { id: 'resist', group: 'during', text: 'After acts 5 and 10, fix resistances (Kitava)', where: 'Build panel → Gear' },
  { id: 'friends', group: 'during', text: 'Post spare uniques and bases for friends', where: "Friends' board" }
]

const KEY = 'deathloom.league-start.v1'
const leagues = useLeagues()
const league = computed(() => leagues.selectedId.value ?? '')
function load (): Record<string, string[]> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}')
    return v && typeof v === 'object' ? v : {}
  } catch { return {} }
}
const store = ref<Record<string, string[]>>(load())
const ticked = computed(() => (store.value[league.value] ?? []).filter(id => ITEMS.some(i => i.id === id)))
const done = computed(() => ticked.value.length)
function save () { try { localStorage.setItem(KEY, JSON.stringify(store.value)) } catch {} }
function toggle (id: string) {
  const list = ticked.value.includes(id) ? ticked.value.filter(x => x !== id) : [...ticked.value, id]
  store.value = { ...store.value, [league.value]: list }
  save()
}
function clear () {
  store.value = { ...store.value, [league.value]: [] }
  save()
}
</script>

<style scoped>
h2 { @apply text-base text-gray-100 mb-1; }
.hint { @apply text-xs text-gray-500; }
</style>
