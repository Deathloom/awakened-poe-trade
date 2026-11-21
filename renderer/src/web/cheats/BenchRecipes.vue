<template>
  <!-- Deathloom fork (Q9): crafting bench recipe unlocks (Cheat sheets → Bench recipes).
       Places come from the campaign route; ticks are manual and account-wide, on this PC. -->
  <div class="space-y-2">
    <div class="flex flex-wrap items-center gap-1">
      <span class="text-gray-100 mr-1" title="Recipes ticked / recipes on the campaign route">{{ done }}/{{ spots.length }}</span>
      <button class="ui-tab" :class="{ 'ui-tab-on': !hideDone }" @click="setHideDone(false)">All</button>
      <button class="ui-tab" :class="{ 'ui-tab-on': hideDone }" @click="setHideDone(true)">Still to find</button>
      <button class="ui-btn ui-btn-quiet ml-auto" :class="{ 'text-gray-100': helpOpen }" title="About this list" @click="helpOpen = !helpOpen">?</button>
      <UiMenu :items="menu" align-right title="More" />
    </div>
    <div v-if="helpOpen" class="text-gray-500 space-y-1">
      <div>Crafting bench recipes you pick up on the campaign (a "Crafting Recipe" you click in the zone). Recipes are account-wide in game,
        so once you have one every character and league has it: tick it once. The game doesn't tell the app when you pick one up, so ticks are yours.</div>
      <div>The places are the ones the campaign guide's route lists (Exile Leveling's data), so the guide shows the same "crafting recipe" lines.
        Click a recipe in the guide to tick it there too. Recipes not on the route (side areas the route skips) aren't listed.</div>
      <div>Not sure what you have? In game the crafting bench lists every recipe you've unlocked.</div>
    </div>
    <div v-if="confirmClear" class="flex flex-wrap items-center gap-1 text-gray-300">
      Untick every bench recipe?
      <button class="ui-btn" @click="clearAll">Untick all</button>
      <button class="ui-btn ui-btn-quiet" @click="confirmClear = false">Keep</button>
    </div>
    <div v-if="!loaded" class="text-gray-500"><i class="fas fa-spinner fa-spin mr-1" />Loading the campaign route…</div>
    <template v-else>
      <div v-if="next" class="text-gray-300">
        <i class="fas fa-route mr-1 text-gray-500" />Next on your guide: <span class="text-gray-100">{{ next.recipe }}</span>
        <span class="text-gray-500">· {{ actLabel(next.act) }}, {{ next.zone }}</span>
      </div>
      <div v-else-if="done < spots.length" class="text-gray-500"><i class="fas fa-route mr-1" />No unticked recipe ahead of the guide's step.</div>
      <div v-if="passed.length" class="text-gray-500" :title="passed.map(s => `${s.recipe} (${s.zone})`).join('\n')">
        <i class="fas fa-info-circle mr-1" />{{ passed.length }} unticked in zones the guide is past: picked up but not ticked, or missed.</div>
      <div v-for="g of groups" :key="g.act">
        <div class="text-gray-100 font-semibold mb-0.5">{{ g.label }} <span class="text-gray-500">{{ g.spots.filter(s => ticks.has(s.recipe)).length }}/{{ g.spots.length }}</span></div>
        <label v-for="s of g.spots.filter(s => !hideDone || !ticks.has(s.recipe))" :key="s.recipe" class="flex items-baseline gap-x-1.5 cursor-pointer"
          :class="ticks.has(s.recipe) ? 'text-gray-500 line-through' : 'text-gray-300'">
          <input type="checkbox" :checked="ticks.has(s.recipe)" @change="toggle(s.recipe)">
          <span>{{ s.recipe }}</span><span class="text-gray-600 no-underline">· {{ s.zone }}</span>
          <span v-if="s.step === guideStep" class="text-gray-400 no-underline" title="The campaign guide is on this zone">· <i class="fas fa-map-marker-alt" /> you are here</span>
        </label>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import UiMenu, { type UiMenuItem } from '../ui/UiMenu.vue'
import { CAMPAIGN_STEP_KEY, STEPS, loadCampaignStep, loadRoute, routeLoaded } from '../companion/campaign-route'
import { BENCH_KEY, actLabel, benchRecipeSpots, loadBenchTicks, nextUnfound, passedUnfound, saveBenchTicks, spotsByAct, toggleBenchTick, type BenchRecipeSpot } from '../companion/bench-recipes'

const loaded = ref(routeLoaded())
const spots = ref<BenchRecipeSpot[]>(loaded.value ? benchRecipeSpots(STEPS) : [])
const guideStep = ref(loadCampaignStep())
loadRoute().then(() => {
  spots.value = benchRecipeSpots(STEPS)
  guideStep.value = loadCampaignStep()
  loaded.value = true
}, () => {})

const ticks = ref(loadBenchTicks())
// the guide (overlay / HUD / window) can tick too, and moves the step
const onStorage = (e: StorageEvent) => {
  if (e.key === BENCH_KEY) ticks.value = loadBenchTicks()
  if (e.key === CAMPAIGN_STEP_KEY) guideStep.value = loadCampaignStep()
}
window.addEventListener('storage', onStorage)
onUnmounted(() => { window.removeEventListener('storage', onStorage) })
function toggle (recipe: string) { ticks.value = toggleBenchTick(recipe) }

const done = computed(() => spots.value.filter(s => ticks.value.has(s.recipe)).length)
const groups = computed(() => spotsByAct(spots.value))
const next = computed(() => nextUnfound(spots.value, ticks.value, guideStep.value))
const passed = computed(() => passedUnfound(spots.value, ticks.value, guideStep.value))

const HIDE_KEY = 'deathloom.bench-recipes.hide-done.v1'
const hideDone = ref((() => { try { return localStorage.getItem(HIDE_KEY) === '1' } catch { return false } })())
function setHideDone (v: boolean) {
  hideDone.value = v
  try { localStorage.setItem(HIDE_KEY, v ? '1' : '0') } catch {}
}
const helpOpen = ref(false)
const confirmClear = ref(false)
function clearAll () {
  saveBenchTicks(new Set())
  ticks.value = loadBenchTicks()
  confirmClear.value = false
}
const menu = computed<UiMenuItem[]>(() => [
  { label: 'Tick everything up to the guide\'s step', icon: 'fas fa-check-double', hint: 'Recipes in zones the guide is past', action: tickPassed },
  { divider: true },
  { label: 'Untick all…', icon: 'fas fa-undo', action: () => { confirmClear.value = true } }
])
function tickPassed () {
  const t = loadBenchTicks()
  for (const s of passedUnfound(spots.value, t, guideStep.value)) t.add(s.recipe)
  saveBenchTicks(t)
  ticks.value = loadBenchTicks()
}
</script>
