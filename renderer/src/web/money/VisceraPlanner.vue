<template>
  <!-- Deathloom fork (Q12): Viscera planner (3.30). The active PoB build's Wickerman
       with the cheapest way to get each part, plus a searchable list of every Viscera. -->
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="flex-1 min-h-0 overflow-y-auto px-2">
      <div class="flex items-baseline gap-2 pt-1">
        <span class="text-gray-300">Your build's Wickerman</span>
        <span v-if="steps.length" class="text-gray-500" title="poe.ninja prices of what the build plans (unpriced ones left out)">
          buy all ≈ <span class="text-yellow-300">{{ money(cost.chaos) }}</span><span v-if="cost.unpriced"> + {{ cost.unpriced }} to farm</span></span>
        <button class="ui-btn ui-btn-quiet ml-auto" title="Read the active build again" @click="request"><i class="fas fa-sync-alt" /></button>
      </div>
      <div v-if="!steps.length" class="text-gray-500 py-1">
        {{ noBuild ? 'No active build (Build tab).' : 'The active build has no Viscera. Add them in Path of Building (Items → Viscera) or pick from the list below.' }}
      </div>
      <div v-for="s of steps" :key="s.slot" class="py-0.5 border-b border-gray-700">
        <div class="flex items-baseline gap-2">
          <span class="text-gray-500 w-8 shrink-0">{{ slotLabel(s.slot) }}</span>
          <span class="truncate" :title="s.want?.mods.join('\n')">{{ s.wantName }}</span>
          <span class="ml-auto whitespace-nowrap font-mono" :class="s.how === 'buy' ? 'text-gray-300' : 'text-gray-500'">
            {{ s.want?.chaos != null ? money(s.want.chaos) : '–' }}</span>
        </div>
        <div class="pl-10 text-gray-500">
          <template v-if="s.how === 'buy'">Cheapest: buy it.</template>
          <template v-else-if="s.how === 'farm'">Not on poe.ninja: farm {{ s.want!.boss }} with a Fate<span v-if="s.want!.tier === 3"> (endgame version)</span>.</template>
          <template v-else>Not in Path of Building's Viscera list.</template>
          <span v-for="o of cheaperOthers(s)" :key="o.name" class="ml-1" :title="o.mods.join('\n')">
            · {{ TIER_LABEL[o.tier] }} {{ money(o.chaos!) }}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-1 pt-2 pb-1 sticky top-0 bg-gray-800">
        <button v-for="t of SLOT_TABS" :key="t.id" class="ui-tab" :class="{ 'ui-tab-on': slot === t.id }" @click="slot = t.id">{{ t.label }}</button>
        <input v-model="query" class="flex-1 min-w-[6rem] bg-gray-900 rounded px-1" placeholder="Search mods or boss (life, ignite…)" spellcheck="false">
      </div>
      <table class="w-full">
        <tr v-for="v of list" :key="v.name + v.mods.join()" class="hover:bg-gray-700 align-top" :class="{ 'text-yellow-200': planned.has(v.name) }">
          <td class="w-full max-w-0 pr-2">
            <div class="truncate">{{ v.name }} <span class="text-gray-500">· {{ v.boss }}</span></div>
            <div v-for="m of v.mods" :key="m" class="text-gray-400 truncate">{{ m }}</div>
          </td>
          <td class="text-right whitespace-nowrap font-mono" :class="v.chaos == null ? 'text-gray-500' : ''"
            :title="v.chaos == null ? 'Not on poe.ninja: farm the boss with a Fate' : 'poe.ninja'">{{ v.chaos == null ? 'farm' : money(v.chaos) }}</td>
        </tr>
      </table>
      <div v-if="!list.length" class="text-gray-500 py-1">No Viscera match.</div>
    </div>
    <div class="px-2 py-1 text-gray-500 shrink-0">
      <i class="fas fa-info-circle mr-1" />Viscera from Path of Building 2.69; boss names are read from PoB's data (guess where unclear). Lesser / Greater tiers come from different versions of the boss.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { Host } from '@/web/background/IPC'
import type { PobBuildSummary } from '@ipc/types'
import { wickermanOf } from '@/web/pob/loadout-steps'
import type { NinjaListing } from '@/web/background/Prices'
import DATA from './viscera-data.json'
import { SLOTS, TIER_LABEL, browse, planSteps, planCost, priceIndex, type PlanStep, type Viscera, type VisceraSlot } from './viscera'

const props = defineProps<{ items: NinjaListing[], money: (chaos: number) => string }>()
const money = props.money
const data = DATA as Viscera[]

const prices = computed(() => priceIndex(props.items))
const priceOf = (name: string) => prices.value.get(name) ?? null

const SLOT_TABS: Array<{ id: VisceraSlot | 'all', label: string }> = [{ id: 'all', label: 'All' }, ...SLOTS]
const slot = ref<VisceraSlot | 'all'>('all')
const query = ref('')
const list = computed(() => browse(data, slot.value, query.value, priceOf))
function slotLabel (s: VisceraSlot) { return SLOTS.find(x => x.id === s)?.label ?? s }

// the active build (read from its file, no PoB command needed)
const summary = shallowRef<PobBuildSummary | null>(null)
const noBuild = ref(false)
const planned = computed(() => new Set(wickermanOf(summary.value).map(v => v.name)))
const steps = computed(() => planSteps(wickermanOf(summary.value), data, priceOf))
const cost = computed(() => planCost(steps.value))
function cheaperOthers (s: PlanStep) {
  const want = s.want?.chaos
  return s.others.filter(o => o.chaos != null && (want == null || o.chaos < want)).slice(0, 2)
}

let reqId = (Date.now() & 0x3ffffff) * 8 + 6
let buildsId = 0
let compareId = 0
const lsBuilds = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => {
  if (e.requestId !== buildsId) return
  const active = e.ok ? e.list?.active : null
  noBuild.value = !active
  if (!active) { summary.value = null; return }
  compareId = ++reqId
  const sel = e.loadouts?.active ? { spec: e.loadouts.active.spec, itemSet: e.loadouts.active.itemSet, skillSet: e.loadouts.active.skillSet } : undefined
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-compare', payload: { requestId: compareId, a: active, b: active, selA: sel, selB: sel } })
})
const lsCompare = Host.onEvent('MAIN->CLIENT::pob-compare', (e) => {
  if (e.requestId !== compareId) return
  summary.value = e.ok ? (e.a ?? null) : null
})
onUnmounted(() => { lsBuilds.abort(); lsCompare.abort() })
function request () {
  buildsId = ++reqId
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: buildsId } })
}
request()
</script>
