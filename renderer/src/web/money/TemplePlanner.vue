<template>
  <!-- Deathloom fork (Q13): Temple of Atzoatl planner (3.30). Set each room's tier
       as you see it in the Incursion menu; get what to upgrade next and what the
       temple is worth as an Itemised Temple on poe.ninja. -->
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="flex-1 min-h-0 overflow-y-auto px-2">
      <div class="pt-1 text-gray-300">Upgrade next</div>
      <div v-if="!order.length" class="text-gray-500">Set the tiers of the rooms you have below (from the Incursion map or the Temple's room list).</div>
      <div v-for="(s, i) of order.slice(0, 5)" :key="s.line.id" class="flex items-baseline gap-2">
        <span class="text-gray-500 w-4 shrink-0">{{ i + 1 }}.</span>
        <span class="truncate" :title="doesText(s.line)">{{ s.line.names[s.tier - 1] }} → <span class="text-yellow-200">{{ s.next }}</span></span>
        <span class="ml-auto text-gray-500 whitespace-nowrap">{{ GROUP_LABEL[s.line.group] }}</span>
      </div>
      <div v-if="missing.length" class="text-gray-500 pt-0.5">
        Not in your temple yet (swap a weak room for one of these when an Architect offers it): {{ missing.map(l => l.names[0]).join(', ') }}.
      </div>

      <div class="flex items-baseline gap-2 pt-2">
        <span class="text-gray-300">Value as an Itemised Temple</span>
        <span v-if="value" class="text-yellow-300 font-mono">{{ money(value.chaos) }}</span>
        <span v-else class="text-gray-500">no poe.ninja listing matches your tier 3 rooms</span>
      </div>
      <div v-if="value" class="text-gray-500 truncate" :title="listingText(value)">like: {{ listingText(value) }}</div>
      <details class="text-gray-500">
        <summary class="cursor-pointer">Dearest itemised temples on poe.ninja ({{ priced.length }})</summary>
        <div v-for="p of priced.slice(0, 15)" :key="p.url" class="flex items-baseline gap-2 hover:bg-gray-700 cursor-pointer" :class="{ 'text-green-400': p.matches }"
          :title="`Open on poe.ninja${p.matches ? ' (you have all its tier 3 rooms)' : ''}`" @click="open(p.url)">
          <span class="truncate">{{ listingText(p) }}</span>
          <span class="ml-auto font-mono whitespace-nowrap">{{ money(p.chaos) }}</span>
        </div>
        <div v-if="!priced.length">poe.ninja has no temple prices for this league.</div>
      </details>

      <div class="flex items-center gap-2 pt-2 sticky top-0 bg-gray-800">
        <span class="text-gray-300">Your temple</span>
        <button class="ui-btn ui-btn-quiet ml-auto" title="Set every room to 'not in temple'" @click="clear"><i class="fas fa-undo mr-1" />Clear</button>
      </div>
      <table class="w-full">
        <tr v-for="l of ROOM_LINES" :key="l.id" class="hover:bg-gray-700">
          <td class="w-full max-w-0 pr-2 truncate" :title="doesText(l)">
            <span :class="tierOf(l.id) ? 'text-gray-200' : 'text-gray-500'">{{ tierOf(l.id) ? l.names[tierOf(l.id) - 1] : l.names[0] }}</span>
            <span class="text-gray-500"> · {{ l.does }}<span v-if="l.guess"> (guess)</span></span>
          </td>
          <td class="whitespace-nowrap">
            <button v-for="t of [0, 1, 2, 3] as const" :key="t" class="px-1 rounded"
              :class="tierOf(l.id) === t ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'"
              :title="t ? l.names[t - 1] : 'Not in your temple'" @click="setTier(l.id, t)">{{ t || '–' }}</button>
          </td>
        </tr>
      </table>
    </div>
    <div class="px-2 py-1 text-gray-500 shrink-0">
      <i class="fas fa-info-circle mr-1" />In each Incursion, kill the Architect who upgrades the top room here. Explosives Room only if a good room is behind a blocked door. 3.30: Architect-only rooms drop an Itemised Temple of your layout.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { NinjaListing } from '@/web/background/Prices'
import { ROOM_LINES, GROUP_LABEL, PLAN_KEY, loadPlan, savePlan, upgradeOrder, missingGoodRooms, priceTemples, templeValue, type RoomLine, type TemplePlan, type PricedTemple } from './temple'

const props = defineProps<{ items: NinjaListing[], money: (chaos: number) => string }>()
const money = props.money

const plan = ref<TemplePlan>(loadPlan())
const onStorage = (e: StorageEvent) => { if (e.key === PLAN_KEY) plan.value = loadPlan() }
window.addEventListener('storage', onStorage)
onUnmounted(() => { window.removeEventListener('storage', onStorage) })

function tierOf (id: string) { return plan.value[id] ?? 0 }
function setTier (id: string, t: 0 | 1 | 2 | 3) {
  const p: TemplePlan = Object.fromEntries(Object.entries(loadPlan()).filter(([k]) => k !== id))
  if (t) p[id] = t
  savePlan(p)
  plan.value = p
}
function clear () { savePlan({}); plan.value = {} }

const order = computed(() => upgradeOrder(plan.value))
const missing = computed(() => missingGoodRooms(plan.value))
const priced = computed(() => priceTemples(props.items, plan.value))
const value = computed(() => templeValue(priced.value))

function doesText (l: RoomLine) { return `${l.names.join(' → ')}\nTier 3: ${l.does}${l.guess ? ' (guess)' : ''}` }
function listingText (p: PricedTemple) { return p.variant ? `${p.name} (${p.variant})` : p.name }
function open (url: string) { window.open(url) }
</script>
