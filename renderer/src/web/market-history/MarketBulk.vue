<template>
  <!-- Deathloom fork (Q16, 27 Nov): bulk sell pricing — poe.ninja vs the Currency Exchange ratio you see, copy a WTS line -->
  <div class="flex flex-col h-full min-h-0 text-xs">
    <div class="px-2 py-1 shrink-0">
      <input v-model="query" class="w-full bg-gray-900 rounded px-1 py-0.5" placeholder="Add a stack: type its name (currency, fragment, essence, card…)" spellcheck="false"
        @keydown.enter="suggestions[0] && add(suggestions[0])">
      <div v-if="suggestions.length" class="mt-1 rounded bg-gray-900">
        <button v-for="s of suggestions" :key="s.category + s.name + (s.variant ?? '')" class="w-full flex items-center gap-2 px-2 py-0.5 text-left hover:bg-gray-700" @click="add(s)">
          <span class="flex-1 truncate">{{ s.name }}<span v-if="s.variant" class="text-gray-500"> · {{ s.variant }}</span></span>
          <span class="text-gray-500">{{ s.category.replace(/-/g, ' ') }}</span>
          <span class="text-yellow-300 w-14 text-right">{{ money(s.chaos) }}</span>
        </button>
      </div>
    </div>
    <div class="flex items-baseline gap-2 px-2 pb-1 shrink-0">
      <span class="text-gray-300">Worth:</span>
      <span class="text-yellow-300 text-sm">{{ money(total) }}</span>
      <button v-if="rows.length" class="ui-btn ui-btn-quiet ml-auto" :disabled="!allLine" title="Copy one WTS line with every stack, for trade chat" @click="copy(allLine, 'all')">
        <i :class="copiedKey === 'all' ? 'fas fa-check text-green-400 mr-1' : 'far fa-copy mr-1'" />Copy all</button>
      <button v-if="rows.length" class="ui-btn ui-btn-quiet" :class="{ 'ui-btn-danger': confirmClear }" @click="clearAll">
        {{ confirmClear ? 'Clear all? Click again' : 'Clear' }}</button>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto px-2">
      <div v-if="!rows.length" class="text-gray-500 py-1">
        Nothing to sell in bulk yet. Add a stack and how many you have: it shows poe.ninja's price as a bulk ratio. Type the ratio the in-game Currency Exchange offers (like 12c, 8/div or 40:3) to see which pays more, then copy a WTS line.
      </div>
      <div v-for="r of rows" :key="r.key" class="py-0.5 border-t border-gray-800">
        <div class="flex items-center gap-2">
          <span class="flex-1 min-w-0 truncate" :title="r.label">{{ r.label }}</span>
          <input :value="r.qty" type="number" min="1" class="w-14 bg-gray-900 rounded px-1 text-right" title="How many you have"
            @change="edit(r.key, { qty: ($event.target as HTMLInputElement).valueAsNumber })">
          <span class="w-40 truncate text-right" :class="r.ninja != null ? 'text-yellow-300' : 'text-gray-600'" :title="r.ninja != null ? `poe.ninja: ${money(r.ninja)} each` : 'No poe.ninja price'">
            {{ r.ninja != null ? bulkRatio(r.ninja, divine) : '–' }}</span>
          <input :value="r.exchange ?? ''" class="w-20 bg-gray-900 rounded px-1" placeholder="Exchange"
            :class="r.exchange && r.exch == null ? 'text-red-400' : ''"
            title="What the in-game Currency Exchange offers: 12c, 0.5 div, 8/div, 5/c or 40:3 (40 items for 3 chaos)"
            @change="edit(r.key, { exchange: ($event.target as HTMLInputElement).value.trim() || undefined })">
          <button class="ui-btn ui-btn-quiet" :disabled="!r.line" :title="r.line ? `Copies: ${r.line}` : ''" @click="copy(r.line, r.key)">
            <i :class="copiedKey === r.key ? 'fas fa-check text-green-400' : 'far fa-copy'" /></button>
          <ui-menu :items="rowMenu(r)" align-right button-class="ui-btn-quiet" title="More" />
        </div>
        <div v-if="r.cmp || (r.exchange && r.exch == null)" class="flex gap-2 pl-1 text-gray-500">
          <span v-if="r.exchange && r.exch == null" class="text-red-400">Can't read "{{ r.exchange }}": try 12c, 8/div or 40:3</span>
          <template v-else-if="r.cmp">
            <span :class="r.cmp.tone === 'exchange' ? 'text-green-400' : r.cmp.tone === 'ninja' ? 'text-red-400' : ''">{{ r.cmp.text }}</span>
            <span>Exchange {{ bulkRatio(r.exch!, divine) }}</span>
            <span class="ml-auto">{{ bulkTotal(r.ask! * r.qty, divine) }} for all</span>
          </template>
        </div>
      </div>
    </div>
    <div class="px-2 py-1 text-gray-500 shrink-0">
      <i class="fas fa-info-circle mr-1" />Prices are poe.ninja's; Exchange is what you type. Copy uses the better of the two. Paste the line in trade chat yourself.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { NinjaListing } from '@/web/background/Prices'
import UiMenu, { type UiMenuItem } from '../ui/UiMenu.vue'
import { useMarket } from './use-market'
import { useCopyFeedback } from '../pob/market'
import { loadBulk, saveBulk, parseExchange, bulkRatio, bulkTotal, compareExchange, askEach, wtsLine, BULK_KEY, type BulkEntry } from './bulk-sell'

const { all, divine, money, open, ninja } = useMarket()
const { copiedKey, copy } = useCopyFeedback()
ninja.queuePricesFetch()

// stackable things: currency-like items and divination cards
const BULK_NS = new Set(['ITEM', 'DIVINATION_CARD'])

const list = ref<BulkEntry[]>(loadBulk())
function onStorage (e: StorageEvent) { if (e.key === BULK_KEY) list.value = loadBulk() }
onMounted(() => window.addEventListener('storage', onStorage))
onUnmounted(() => window.removeEventListener('storage', onStorage))
function setList (l: BulkEntry[]) { list.value = l; saveBulk(l) }
const keyOf = (e: { ns: string, name: string, variant?: string }) => `${e.ns}|${e.name}|${e.variant ?? ''}`

const query = ref('')
const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (q.length < 2) return []
  return all.value.filter(it => BULK_NS.has(it.ns) && it.name.toLowerCase().includes(q))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || b.chaos - a.chaos)
    .slice(0, 8)
})
function add (it: NinjaListing) {
  const e: BulkEntry = { ns: it.ns, name: it.name, variant: it.variant, label: [it.name, it.variant].filter(Boolean).join(' · '), qty: 10 }
  if (!list.value.some(x => keyOf(x) === keyOf(e))) setList([...list.value, e])
  query.value = ''
}
function edit (key: string, patch: Partial<BulkEntry>) {
  setList(list.value.map(e => {
    if (keyOf(e) !== key) return e
    const next = { ...e, ...patch }
    if (!Number.isFinite(next.qty) || next.qty < 1) next.qty = e.qty
    next.qty = Math.round(next.qty)
    if (next.exchange) next.exchange = next.exchange.slice(0, 40)
    return next
  }))
}
function remove (key: string) { setList(list.value.filter(e => keyOf(e) !== key)) }
const confirmClear = ref(false)
function clearAll () {
  if (!confirmClear.value) { confirmClear.value = true; setTimeout(() => { confirmClear.value = false }, 3000); return }
  setList([])
  confirmClear.value = false
}

function listingOf (e: BulkEntry): NinjaListing | null {
  if (e.ns === 'ITEM' && e.name === 'Chaos Orb') return null
  return all.value.find(it => it.ns === e.ns && it.name === e.name && (it.variant ?? '') === (e.variant ?? '')) ?? null
}
const rows = computed(() => list.value.map(e => {
  const listing = listingOf(e)
  const ninjaEach = listing?.chaos ?? null
  const exch = parseExchange(e.exchange, divine.value)
  const ask = askEach(exch, ninjaEach)
  return {
    ...e,
    key: keyOf(e),
    listing,
    ninja: ninjaEach,
    exch,
    ask,
    cmp: compareExchange(exch, ninjaEach),
    line: wtsLine([{ label: e.label, qty: e.qty, each: ask }], divine.value)
  }
}))
const total = computed(() => rows.value.reduce((a, r) => a + (r.ask ?? 0) * r.qty, 0))
const allLine = computed(() => wtsLine(rows.value.map(r => ({ label: r.label, qty: r.qty, each: r.ask })), divine.value))
function rowMenu (r: { key: string, listing: NinjaListing | null }): UiMenuItem[] {
  return [
    { label: 'Open on poe.ninja', icon: 'fas fa-external-link-alt', disabled: !r.listing, action: () => { if (r.listing) open(r.listing.url) } },
    { divider: true },
    { label: 'Remove (sold)', icon: 'fas fa-check', action: () => remove(r.key) }
  ]
}
</script>
