<template>
  <!-- Deathloom fork (20 Nov): sell list — what you plan to sell, its value now and whether to wait -->
  <div class="flex flex-col h-full min-h-0 text-xs">
    <div class="px-2 py-1 shrink-0">
      <div class="flex items-center gap-2">
        <input v-model="query" class="flex-1 min-w-0 bg-gray-900 rounded px-1 py-0.5" placeholder="Add an item: type its name (currency, unique, gem, fragment…)" spellcheck="false"
          @keydown.enter="suggestions[0] && add(suggestions[0])">
      </div>
      <div v-if="suggestions.length" class="mt-1 rounded bg-gray-900">
        <button v-for="s of suggestions" :key="s.category + s.name + (s.variant ?? '')" class="w-full flex items-center gap-2 px-2 py-0.5 text-left hover:bg-gray-700" @click="add(s)">
          <span class="flex-1 truncate">{{ s.name }}<span v-if="s.variant" class="text-gray-500"> · {{ s.variant }}</span></span>
          <span class="text-gray-500">{{ s.category.replace(/-/g, ' ') }}</span>
          <span class="text-yellow-300 w-14 text-right">{{ money(s.chaos) }}</span>
        </button>
      </div>
    </div>
    <div class="flex items-baseline gap-2 px-2 pb-1 shrink-0">
      <span class="text-gray-300">Worth now:</span>
      <span class="text-yellow-300 text-sm">{{ money(total.chaos) }}</span>
      <span v-if="total.missing" class="text-gray-500">({{ total.missing }} without a price)</span>
      <button v-if="list.length" class="ui-btn ui-btn-quiet ml-auto" :class="{ 'ui-btn-danger': confirmClear }" @click="clearAll">
        {{ confirmClear ? 'Clear all? Click again' : 'Clear' }}</button>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto px-2">
      <div v-if="!list.length" class="text-gray-500 py-1">
        Nothing on your sell list. Add what you want to sell: it shows today's value, a week of prices, and whether the price is falling (sell soon) or climbing (you can wait).
      </div>
      <div v-for="r of rows" :key="r.key" class="flex items-center gap-2 py-0.5 border-t border-gray-800">
        <span class="flex-1 min-w-0 truncate" :title="r.label">{{ r.label }}</span>
        <input :value="r.qty" type="number" min="1" class="w-12 bg-gray-900 rounded px-1 text-right" title="How many"
          @change="setQty(r.key, ($event.target as HTMLInputElement).valueAsNumber)">
        <price-spark :item="r.listing" />
        <span class="w-14 text-right" :class="r.listing ? 'text-yellow-300' : 'text-gray-600'" :title="r.listing ? `1 = ${money(r.listing.chaos)}` : 'No poe.ninja price'">
          {{ r.listing ? money(r.listing.chaos * r.qty) : '–' }}</span>
        <span class="w-24 truncate" :class="r.hint?.tone === 'sell' ? 'text-red-400' : r.hint?.tone === 'wait' ? 'text-green-400' : 'text-gray-500'">{{ r.hint?.text ?? '' }}</span>
        <button class="ui-btn ui-btn-quiet" :disabled="!r.listing" :title="r.listing ? `Copies '${note(r.listing.chaos)}' for a premium stash tab or item note` : ''"
          @click="r.listing && copy(note(r.listing.chaos), r.key)">
          <i :class="copiedKey === r.key ? 'fas fa-check text-green-400' : 'far fa-copy'" /></button>
        <ui-menu :items="rowMenu(r)" align-right button-class="ui-btn-quiet" title="More" />
      </div>
    </div>
    <div class="px-2 py-1 text-gray-500 shrink-0">
      <i class="fas fa-info-circle mr-1" />Prices are poe.ninja's. Copy puts a price note on the clipboard: right-click the item in a premium stash tab and paste it.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { NinjaListing } from '@/web/background/Prices'
import PriceSpark from './PriceSpark.vue'
import UiMenu, { type UiMenuItem } from '../ui/UiMenu.vue'
import { useMarket } from './use-market'
import { useCopyFeedback } from '../pob/market'
import { loadSellList, saveSellList, sellHint, sellTotal, priceNote, SELL_KEY, type SellEntry } from './market-tools'

const { all, divine, money, open, ninja } = useMarket()
const { copiedKey, copy } = useCopyFeedback()
ninja.queuePricesFetch()

const list = ref<SellEntry[]>(loadSellList())
function onStorage (e: StorageEvent) { if (e.key === SELL_KEY) list.value = loadSellList() }
onMounted(() => window.addEventListener('storage', onStorage))
onUnmounted(() => window.removeEventListener('storage', onStorage))
function save () { saveSellList(list.value) }
const keyOf = (e: { ns: string, name: string, variant?: string }) => `${e.ns}|${e.name}|${e.variant ?? ''}`

const query = ref('')
const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (q.length < 2) return []
  return all.value.filter(it => it.name.toLowerCase().includes(q))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || b.chaos - a.chaos)
    .slice(0, 8)
})
function add (it: NinjaListing) {
  const e: SellEntry = { ns: it.ns, name: it.name, variant: it.variant, label: [it.name, it.variant].filter(Boolean).join(' · '), qty: 1 }
  const k = keyOf(e)
  const have = list.value.find(x => keyOf(x) === k)
  if (have) have.qty += 1
  else list.value.push(e)
  list.value = [...list.value]
  save()
  query.value = ''
}
function setQty (key: string, n: number) {
  list.value = list.value.map(e => keyOf(e) === key ? { ...e, qty: Number.isFinite(n) && n > 0 ? Math.round(n) : 1 } : e)
  save()
}
function remove (key: string) {
  list.value = list.value.filter(e => keyOf(e) !== key)
  save()
}
const confirmClear = ref(false)
function clearAll () {
  if (!confirmClear.value) { confirmClear.value = true; setTimeout(() => { confirmClear.value = false }, 3000); return }
  list.value = []
  save()
  confirmClear.value = false
}

function listingOf (e: SellEntry): NinjaListing | null {
  return all.value.find(it => it.ns === e.ns && it.name === e.name && (it.variant ?? '') === (e.variant ?? '')) ?? null
}
const rows = computed(() => list.value.map(e => {
  const listing = listingOf(e)
  return { ...e, key: keyOf(e), listing, hint: sellHint(listing) }
}))
const total = computed(() => sellTotal(list.value, e => listingOf(e)?.chaos ?? null))
function note (chaos: number) { return priceNote(chaos, divine.value) }
function rowMenu (r: { key: string, listing: NinjaListing | null }): UiMenuItem[] {
  return [
    { label: 'Open on poe.ninja', icon: 'fas fa-external-link-alt', disabled: !r.listing, action: () => { if (r.listing) open(r.listing.url) } },
    { label: 'Copy ~b/o note instead', icon: 'far fa-copy', disabled: !r.listing, action: () => { if (r.listing) copy(priceNote(r.listing.chaos, divine.value, '~b/o'), r.key) } },
    { divider: true },
    { label: 'Remove (sold)', icon: 'fas fa-check', action: () => remove(r.key) }
  ]
}
</script>
