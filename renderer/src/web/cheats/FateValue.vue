<template>
  <!-- Deathloom fork (Q5): Fate value helper (Covens cheat sheet). Outcomes from
       fates.ts, prices from the shared poe.ninja download (no other requests). -->
  <div class="space-y-1">
    <div class="flex items-center gap-1">
      <span class="text-gray-100 font-semibold">Fate rewards at poe.ninja prices</span>
      <button class="ui-btn ui-btn-quiet ml-auto" :class="{ 'text-gray-100': helpOpen }" title="How this is worked out" @click="helpOpen = !helpOpen">?</button>
    </div>
    <div v-if="helpOpen" class="text-gray-500">
      Reward types are the ones the game lists for the Promised Profits challenge; prices are poe.ninja's for the league picked in Settings, per item.
      GGG only states the count for the single Divine Orb / Orb of Annulment outcomes; for the rest "per item" is all we know, so a high per-item price
      isn't a promise the Fate pays more. Random drops (currency, uniques, gems, …) have no single price. {{ COPIES_RULE }}
    </div>
    <div v-if="best" class="text-gray-300">
      Worth taking: <b class="text-gray-100">{{ best.outcome.label }}</b> ({{ money(best.low!) }}<template v-if="best.outcome.qty !== 'single'"> per item; how many is not stated by GGG</template>).
    </div>
    <div v-else class="text-gray-500">No poe.ninja prices yet{{ ninja.isLoading.value ? ' (loading…)' : '' }}.</div>
    <table class="w-full">
      <tbody>
        <tr v-for="r of rows" :key="r.outcome.id" class="border-t border-gray-700 align-baseline">
          <td class="py-0.5 pr-2" :class="r.best ? 'text-gray-100 font-semibold' : 'text-gray-300'">
            <i v-if="r.best" class="fas fa-star mr-1 text-gray-400" title="Highest value per item" />{{ r.outcome.label }}
            <span v-if="r.outcome.note" class="text-gray-500 font-normal">· {{ r.outcome.note }}</span>
          </td>
          <td class="py-0.5 text-right whitespace-nowrap">
            <span v-if="r.varies" class="text-gray-500">random drop</span>
            <span v-else-if="r.low == null" class="text-gray-500">no price</span>
            <span v-else class="text-gray-100">{{ money(r.low) }}<template v-if="r.high !== r.low"> – {{ money(r.high!) }}</template></span>
          </td>
          <td class="py-0.5 pl-2 text-right whitespace-nowrap text-gray-500" :title="r.outcome.copies === 2 ? 'Copies of this Fate that guarantee it' : 'Copies of the same Fate that pay'">
            {{ r.outcome.copies === 2 ? '2 copies' : '1 or 3' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { usePoeninja, displayRounding } from '@/web/background/Prices'
import { FATE_OUTCOMES, COPIES_RULE, valueFates } from './fates'

const helpOpen = ref(false)

// prices: the app's shared poe.ninja download (main /proxy cache), like the Thread planner
const ninja = usePoeninja()
ninja.queuePricesFetch()
const timer = setInterval(() => { ninja.queuePricesFetch() }, 10 * 60_000)
onUnmounted(() => clearInterval(timer))

const rows = computed(() => {
  if (ninja.dbVersion.value < 0) return valueFates(FATE_OUTCOMES, () => null)
  return valueFates(FATE_OUTCOMES, p => ninja.findPriceByQuery({ ns: p.ns, name: p.name, variant: undefined })?.chaos ?? null)
})
const best = computed(() => rows.value.find(r => r.best) ?? null)

function money (chaos: number) {
  const div = ninja.xchgRate.value
  if (div && div > 0 && chaos >= div * 0.94) return `${displayRounding(chaos / div, true)} div`
  return `${displayRounding(chaos)} c`
}
</script>
