<template>
  <!-- Deathloom fork (20 Nov): crafting costs — crafting currency prices with a week's trend, and a
       quick "what does this craft cost" sum. Odds and cost per hit: Craft tab → Crafting simulator. -->
  <div class="flex flex-col h-full min-h-0 text-xs">
    <div class="flex-1 min-h-0 overflow-y-auto px-2 py-1 space-y-2">
      <div>
        <div class="flex items-baseline gap-2">
          <span class="text-gray-300">My craft:</span>
          <span class="text-yellow-300 text-sm">{{ money(total.chaos) }}</span>
          <span v-if="divine && total.chaos >= divine" class="text-gray-500">({{ Math.round(total.chaos) }} c)</span>
          <span v-if="total.missing.length" class="text-gray-500">· no price: {{ total.missing.join(', ') }}</span>
          <button v-if="rows.length" class="ui-btn ui-btn-quiet ml-auto" @click="setRows([])"><i class="fas fa-undo mr-1" />Clear</button>
        </div>
        <div v-for="(r, i) of rows" :key="r.name" class="flex items-center gap-2 py-0.5">
          <span class="flex-1 truncate">{{ r.name }}</span>
          <input :value="r.count" type="number" min="0" class="w-16 bg-gray-900 rounded px-1 text-right"
            @input="setCount(i, ($event.target as HTMLInputElement).valueAsNumber)">
          <span class="w-16 text-right text-gray-400 font-mono">{{ itemPrice(r.name) != null ? money(itemPrice(r.name)! * r.count) : '–' }}</span>
          <button class="ui-btn ui-btn-quiet px-1" title="Remove" @click="setRows(rows.filter((_, j) => j !== i))"><i class="fas fa-times" /></button>
        </div>
        <div class="text-gray-500 pt-0.5">{{ rows.length ? 'Click + on a currency below to add more.' : 'Click + on a currency below to add it, then type how many you expect to use.' }}</div>
      </div>
      <table class="w-full">
        <tr class="text-gray-500 sticky top-0 bg-gray-800">
          <th class="text-left font-normal">Crafting currency</th>
          <th class="font-normal">Week</th>
          <th class="text-right font-normal pr-2">Each</th>
          <th class="text-right font-normal pr-2" title="How many you get for 1 divine">Per div</th>
          <th />
        </tr>
        <tr v-for="c of currency" :key="c.name" class="border-t border-gray-800">
          <td class="truncate max-w-0 w-full">{{ c.name }}</td>
          <td class="px-1"><price-spark :item="c.listing" /></td>
          <td class="text-right pr-2 font-mono text-yellow-300">{{ c.chaos != null ? money(c.chaos) : '–' }}</td>
          <td class="text-right pr-2 font-mono text-gray-400">{{ c.chaos && divine ? Math.floor(divine / c.chaos) : '–' }}</td>
          <td><button class="ui-btn ui-btn-quiet px-1" :title="`Add ${c.name} to my craft`" @click="addRow(c.name)"><i class="fas fa-plus" /></button></td>
        </tr>
      </table>
    </div>
    <div class="px-2 py-1 text-gray-500 shrink-0">
      <i class="fas fa-info-circle mr-1" />poe.ninja prices. For odds and the average cost until you hit a mod, use Craft → Crafting simulator.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import PriceSpark from './PriceSpark.vue'
import { useMarket } from './use-market'
import { CRAFT_CURRENCY, craftTotal, loadCraftRows, saveCraftRows, type CraftRow } from './market-tools'

const { itemIndex, itemPrice, money, divine, ninja } = useMarket()
ninja.queuePricesFetch()
const rows = ref<CraftRow[]>(loadCraftRows())
function setRows (r: CraftRow[]) { rows.value = r; saveCraftRows(r) }
function setCount (i: number, n: number) {
  setRows(rows.value.map((r, j) => j === i ? { ...r, count: Number.isFinite(n) && n > 0 ? n : 0 } : r))
}
function addRow (name: string) {
  if (rows.value.some(r => r.name === name)) return
  setRows([...rows.value, { name, count: 1 }])
}
const total = computed(() => craftTotal(rows.value, itemPrice))
const currency = computed(() => CRAFT_CURRENCY.map(name => {
  const listing = itemIndex.value.get(name) ?? null
  return { name, listing, chaos: name === 'Chaos Orb' ? 1 : listing?.chaos ?? null }
}))
</script>
