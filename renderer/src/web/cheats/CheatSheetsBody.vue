<template>
  <!-- Deathloom fork (idea 8): cheat sheets on a hotkey (overlay, in game, window) -->
  <div class="flex flex-col h-full min-h-0 rounded bg-gray-800 text-sm leading-snug">
    <div class="flex flex-wrap items-center gap-1 px-2 py-1 border-b border-gray-700 shrink-0">
      <span class="lg-head mr-1"><i class="fas fa-book mr-1 text-gray-500" />Cheat sheets</span>
      <button v-for="s of tabs" :key="s.id" class="ui-tab"
        :class="{ 'ui-tab-on': tab === s.id }" @click="setTab(s.id)">{{ s.label }}</button>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-3">
      <template v-if="tab === 'progress'">
        <div class="text-gray-400">League start, then endgame: tick what you've done this league ({{ league || 'no league picked' }}). Saved on this PC.</div>
        <div v-for="g of PROGRESS" :key="g.title">
          <div class="text-gray-100 font-semibold mb-0.5">{{ g.title }} <span class="text-gray-500">{{ g.items.filter(i => ticks.has(i.id)).length }}/{{ g.items.length }}</span></div>
          <label v-for="i of g.items" :key="i.id" class="flex items-baseline gap-x-1.5 cursor-pointer" :class="ticks.has(i.id) ? 'text-gray-500 line-through' : 'text-gray-300'">
            <input type="checkbox" :checked="ticks.has(i.id)" @change="toggle(i.id)">
            <span>{{ i.label }}</span><span v-if="i.hint" class="text-gray-600 no-underline">· {{ i.hint }}</span>
          </label>
        </div>
      </template>
      <template v-else-if="sheet">
        <div class="text-gray-300">{{ sheet.intro }}</div>
        <div v-if="sheet.focuses?.length" class="flex flex-wrap gap-1">
          <button v-for="f of sheet.focuses" :key="f.id" class="px-2 rounded border border-gray-600"
            :class="curFocus === f.id ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:bg-gray-700'" @click="setFocus(f.id)">{{ f.label }}</button>
        </div>
        <div v-for="sec of shownSections" :key="sec.title">
          <div class="text-gray-100 font-semibold mb-0.5">{{ sec.title }}</div>
          <ul class="list-disc pl-4 text-gray-300 space-y-1">
            <li v-for="l of sec.lines" :key="l">{{ l }}</li>
          </ul>
        </div>
        <div class="text-gray-500"><i class="fas fa-info-circle mr-1" />{{ sheet.check }} GGG changes mechanics now and then.</div>
      </template>
      <template v-else>
        <!-- Deathloom fork (20 Nov 2026): this league's vendor-recipe challenges first -->
        <div v-for="c of CHALLENGE_RECIPES" :key="c.name" class="rounded bg-gray-900 px-2 py-1.5">
          <div class="text-gray-100 font-semibold mb-0.5"><i class="fas fa-trophy mr-1 text-yellow-400" />{{ c.name }}
            <span class="text-gray-500 font-normal">· {{ c.league }} challenge</span></div>
          <div v-for="i of c.items" :key="i.want" class="pt-1">
            <div><span class="text-green-300">{{ i.want }}</span> <span class="text-gray-500">←</span> <span class="text-gray-300">{{ i.give }}</span></div>
            <div v-if="i.note" class="text-gray-500">{{ i.note }}</div>
          </div>
        </div>
        <div class="text-gray-300">Sell these together to any vendor.</div>
        <div v-for="r of VENDOR_RECIPES" :key="r.name" class="border-t border-gray-700 pt-1">
          <div class="text-gray-100">{{ r.name }} <span class="text-gray-500">· from act {{ r.fromAct }}</span></div>
          <div class="text-gray-400">{{ r.give }}</div>
          <div class="text-green-300">→ {{ r.get }}</div>
          <div v-if="r.note" class="text-gray-500">{{ r.note }}</div>
        </div>
        <div class="text-gray-500"><i class="fas fa-info-circle mr-1" />Recipes change now and then; re-check at league start.</div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLeagues } from '@/web/background/Leagues'
import { PROGRESS, loadProgress, saveProgress } from './progress'
import { SHEETS, sectionsFor } from './sheets'
import { VENDOR_RECIPES, CHALLENGE_RECIPES } from '../companion/vendor-recipes'

const tabs = [...SHEETS.map(s => ({ id: s.id, label: s.label })), { id: 'recipes', label: 'Vendor recipes' }, { id: 'progress', label: 'Checklist' }]
const KEY = 'deathloom.cheats.tab.v1'
const tab = ref((() => { try { return localStorage.getItem(KEY) ?? 'betrayal' } catch { return 'betrayal' } })())
function setTab (id: string) {
  tab.value = id
  try { localStorage.setItem(KEY, id) } catch {}
}
const sheet = computed(() => SHEETS.find(s => s.id === tab.value) ?? (tab.value === 'recipes' || tab.value === 'progress' ? null : SHEETS[0]))

// per-sheet focus switch (Covens: levelling / mapping profit / bosses)
const FOCUS_KEY = 'deathloom.cheats.focus.v1'
const focusBySheet = ref<Record<string, string>>((() => { try { return JSON.parse(localStorage.getItem(FOCUS_KEY) ?? '{}') ?? {} } catch { return {} } })())
const curFocus = computed(() => {
  const s = sheet.value
  if (!s?.focuses?.length) return null
  const f = focusBySheet.value[s.id]
  return s.focuses.some(x => x.id === f) ? f : s.focuses[0].id
})
const shownSections = computed(() => sheet.value ? sectionsFor(sheet.value, curFocus.value) : [])
function setFocus (id: string) {
  if (!sheet.value) return
  focusBySheet.value = { ...focusBySheet.value, [sheet.value.id]: id }
  try { localStorage.setItem(FOCUS_KEY, JSON.stringify(focusBySheet.value)) } catch {}
}

// Endgame progress (ticks per league)
const leagues = useLeagues()
const league = computed(() => leagues.selectedId.value ?? '')
const ticks = ref(loadProgress(league.value))
watch(league, (l) => { ticks.value = loadProgress(l) })
function toggle (id: string) {
  const t = loadProgress(league.value)
  if (t.has(id)) t.delete(id)
  else t.add(id)
  saveProgress(league.value, t)
  ticks.value = t
}
</script>
