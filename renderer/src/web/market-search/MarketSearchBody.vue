<template>
  <!-- Deathloom fork: search the market by item name and contact a seller.
       Whisper / Hideout: one chat message per click, never automatic. -->
  <div class="flex flex-col min-h-0 h-full text-sm" style="min-width: 28rem;">
    <div class="flex gap-x-1 p-1 shrink-0">
      <div class="relative flex-1">
        <input ref="inputEl" v-model="text" type="text" spellcheck="false"
          class="w-full rounded bg-gray-900 px-2 py-0.5" placeholder="Item name (unique, base type, gem, card…)"
          @keydown.down.prevent="move(1)" @keydown.up.prevent="move(-1)" @keydown.enter.prevent="pickHighlighted"
          @focus="showSuggest = true">
        <div v-if="showSuggest && suggestions.length && !picked"
          class="absolute z-10 left-0 right-0 mt-px bg-gray-800 border border-gray-600 rounded max-h-72 overflow-y-auto">
          <button v-for="(s, i) of suggestions" :key="s.namespace + s.refName"
            class="flex items-center gap-x-2 w-full text-left px-2 py-0.5"
            :class="i === highlight ? 'bg-gray-600' : 'hover:bg-gray-700'"
            @mousedown.prevent="pick(s)">
            <img :src="s.icon" class="w-5 h-5 object-contain">
            <span class="flex-1 truncate">{{ s.name }}</span>
            <span class="text-xs text-gray-500">{{ kind(s) }}</span>
          </button>
        </div>
      </div>
      <button class="btn" :disabled="!picked || busy" @click="run"><i class="fas fa-search" /> Search</button>
    </div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pb-1 shrink-0 text-xs text-gray-400">
      <label>Sellers
        <select v-model="status" class="rounded bg-gray-900 px-1 ml-1">
          <option value="online">Online (whisper)</option>
          <option value="securable">Instant buyout</option>
          <option value="available">Online + instant buyout</option>
          <option value="any">Any</option>
        </select>
      </label>
      <label>Max price
        <input v-model.number="maxPrice" type="number" min="0" step="any" class="rounded bg-gray-900 px-1 w-16 ml-1">
        <select v-model="maxCurrency" class="rounded bg-gray-900 px-1">
          <option value="chaos">chaos</option>
          <option value="divine">divine</option>
        </select>
      </label>
      <span class="ml-auto">{{ league || 'no league' }}</span>
    </div>

    <div v-if="error" class="px-2 py-1 text-red-400">{{ error }}</div>
    <div v-if="result" class="flex items-center gap-x-2 px-2 pb-1 text-xs text-gray-400 shrink-0">
      <span>{{ result.total }} listed · showing {{ listings.length }}</span>
      <button class="ml-auto hover:text-gray-100" title="Open this search on the trade site" @click="openSite">
        <i class="fas fa-store mr-1" />Trade site</button>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto">
      <div v-for="l of listings" :key="l.id" class="px-2 py-1 border-t border-gray-700">
        <div class="flex items-center gap-x-2">
          <img v-if="l.icon" :src="l.icon" class="w-6 h-6 object-contain shrink-0">
          <button class="flex-1 min-w-0 text-left truncate" :title="l.mods.join('\n') || undefined"
            @click="toggle(l.id)">
            <span class="text-gray-100">{{ l.name || l.typeLine }}</span>
            <span v-if="l.name" class="text-gray-500"> {{ l.typeLine }}</span>
            <span v-if="l.corrupted" class="text-red-400 text-xs"> corrupted</span>
          </button>
          <span class="font-mono whitespace-nowrap" :class="l.priceAmount == null ? 'text-gray-500' : 'text-yellow-300'">
            {{ l.priceAmount != null ? `${l.priceAmount} ${l.priceCurrency}` : 'no price' }}</span>
        </div>
        <div class="flex items-center gap-x-2 text-xs mt-0.5">
          <span :class="{ 'text-green-400': l.status === 'online', 'text-yellow-400': l.status === 'afk', 'text-gray-500': l.status === 'offline' }">●</span>
          <span class="text-gray-300 truncate" :title="l.accountName">{{ l.ign }}</span>
          <span class="text-gray-500">{{ l.relativeDate }}</span>
          <span v-if="l.instantBuyout" class="px-1 rounded bg-indigo-800 text-indigo-200">instant buyout</span>
          <span class="ml-auto flex gap-x-1">
            <template v-if="l.instantBuyout">
              <button class="px-2 rounded bg-gray-700 hover:bg-gray-600" title="Opens this search in the Trade site tab: click GGG's own &quot;Travel to Hideout&quot; there (needs your trade site sign-in)"
                @click="openSite"><i class="fas fa-door-open mr-1" />Hideout (trade site)</button>
            </template>
            <template v-else>
              <button class="px-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40" :disabled="!whisperText(l)"
                :title="`${mode === 'send' ? 'Sends' : 'Copies'} GGG's buy message to ${l.ign} (one chat message)`"
                @click="chat(whisperText(l))"><i class="fas fa-comment-dots mr-1" />Whisper</button>
              <button class="px-2 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40" :disabled="!hideoutCommand(l)"
                :title="`${mode === 'send' ? 'Sends' : 'Copies'} /hideout ${l.ign} (one chat command). Works when the seller lets visitors in; most sellers invite you to their party first.`"
                @click="chat(hideoutCommand(l))"><i class="fas fa-door-open mr-1" />Hideout</button>
            </template>
          </span>
        </div>
        <div v-if="open.has(l.id) && l.mods.length" class="mt-1 pl-8 text-xs text-blue-200 whitespace-pre-line">{{ l.mods.join('\n') }}</div>
      </div>
      <div v-if="result && !listings.length" class="px-2 py-2 text-gray-500">Nothing listed with these filters.</div>
      <div v-if="!result && !busy && !error" class="px-2 py-2 text-gray-500">
        Type an item name, pick it from the list and press Search. Whisper and Hideout
        {{ mode === 'send' ? 'send one chat message per click' : 'copy the chat message (paste it in chat with Ctrl+V)' }};
        nothing is ever sent by itself. Change this in Settings → Path of Building → Chat buttons.
      </div>
      <button v-if="result && moreIds.length" class="w-full py-1 text-gray-400 hover:text-gray-100"
        :disabled="busy" @click="more">Show more</button>
      <div v-if="busy" class="px-2 py-2 text-gray-500"><i class="fas fa-circle-notch fa-spin mr-1" />Searching (rate-limited like price checks)…</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { BaseType } from '@/assets/data'
import { useLeagues } from '@/web/background/Leagues'
import { runChat, chatMode } from '@/web/companion/chat'
import { openTradeLink } from '@/web/desktop/trade-tab'
import {
  findMarketItems, searchMarket, moreListings, whisperText, hideoutCommand,
  type ListingStatus, type MarketListing, type MarketResult
} from './market-api'

const leagues = useLeagues()
const league = computed(() => leagues.selectedId.value ?? '')
const mode = computed(() => chatMode())

const inputEl = ref<HTMLInputElement>()
const text = ref('')
const picked = shallowRef<BaseType | null>(null)
const showSuggest = ref(false)
const highlight = ref(0)
const suggestions = computed(() => picked.value ? [] : findMarketItems(text.value))
watch(text, (t) => {
  if (picked.value && t !== picked.value.name) picked.value = null
  highlight.value = 0
})

function kind (b: BaseType) {
  switch (b.namespace) {
    case 'UNIQUE': return 'unique'
    case 'GEM': return 'gem'
    case 'DIVINATION_CARD': return 'card'
    case 'CAPTURED_BEAST': return 'beast'
    default: return 'base / item'
  }
}
function move (d: number) {
  if (!suggestions.value.length) return
  highlight.value = (highlight.value + d + suggestions.value.length) % suggestions.value.length
}
function pickHighlighted () {
  if (picked.value) { run().catch(() => {}); return }
  const s = suggestions.value[highlight.value]
  if (s) pick(s)
}
function pick (s: BaseType) {
  picked.value = s
  text.value = s.name
  showSuggest.value = false
  run().catch(() => {})
}

const status = ref<ListingStatus>('online')
const maxPrice = ref<number | null>(null)
const maxCurrency = ref<'chaos' | 'divine'>('chaos')

const busy = ref(false)
const error = ref('')
const result = shallowRef<MarketResult | null>(null)
const listings = shallowRef<MarketListing[]>([])
const moreIds = ref<string[]>([])
const open = ref(new Set<string>())

async function run () {
  if (!picked.value || busy.value) return
  if (!league.value) { error.value = 'Pick a league first (Settings → Price check).'; return }
  busy.value = true
  error.value = ''
  try {
    const it = picked.value
    const r = await searchMarket({
      item: { name: it.name, refName: it.refName, namespace: it.namespace, icon: it.icon, base: it.unique?.base },
      status: status.value,
      maxPrice: maxPrice.value ?? undefined,
      maxCurrency: maxCurrency.value
    }, league.value)
    result.value = r
    listings.value = r.listings
    moreIds.value = r.rest
  } catch (e) {
    error.value = `Search failed: ${(e as Error).message}`
  } finally {
    busy.value = false
  }
}

async function more () {
  if (!moreIds.value.length || busy.value) return
  busy.value = true
  try {
    const page = moreIds.value.slice(0, 10)
    const got = await moreListings(result.value!.queryId, page)
    listings.value = [...listings.value, ...got]
    moreIds.value = moreIds.value.slice(page.length)
  } catch (e) {
    error.value = `Couldn't load more: ${(e as Error).message}`
  } finally {
    busy.value = false
  }
}

function toggle (id: string) {
  const s = new Set(open.value)
  if (s.has(id)) s.delete(id); else s.add(id)
  open.value = s
}

function chat (t: string | undefined) {
  if (t) runChat(t)
}

function openSite () {
  if (result.value) openTradeLink(result.value.url)
}

defineExpose({ focus: () => inputEl.value?.focus() })
</script>
