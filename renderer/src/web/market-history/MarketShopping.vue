<template>
  <!-- Deathloom fork (20 Nov): build shopping list — the followed build's uniques and gems at poe.ninja prices -->
  <div class="flex flex-col h-full min-h-0 text-xs">
    <div class="flex items-center gap-2 px-2 py-1 shrink-0">
      <span class="truncate text-gray-300" :title="buildName">{{ buildName || 'Build' }}<span v-if="itemSet" class="text-gray-500"> · {{ itemSet }}</span></span>
      <button class="ui-btn ui-btn-quiet ml-auto" :disabled="loading" title="Read the build again from Path of Building" @click="request">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /></button>
      <ui-menu :items="listMenu" align-right button-class="ui-btn-quiet" title="More" />
    </div>
    <div v-if="error" class="px-2 pb-1 text-red-400">{{ error }}</div>
    <!-- Deathloom fork (Q10): loot filter add-on: pick his filter, Orbhoarder writes a copy with our Show blocks first -->
    <div v-if="lf.open" class="mx-2 mb-1 p-2 rounded border border-gray-700 bg-gray-900 shrink-0 space-y-1">
      <div class="flex items-center gap-2">
        <span class="text-gray-300">Loot filter add-on: pick your filter</span>
        <button class="ui-btn ui-btn-quiet ml-auto" :class="{ 'ui-btn-on': lf.help }" title="How it works" @click="lf.help = !lf.help"><i class="fas fa-question" /></button>
        <button class="ui-btn ui-btn-quiet" title="Close" @click="lf.open = false"><i class="fas fa-times" /></button>
      </div>
      <div v-if="lf.help" class="text-gray-400">
        Orbhoarder writes a new file next to your filter, <i>"your filter + Orbhoarder.filter"</i>: first a few Show blocks
        (big text, a coloured border, a beam and a minimap star) for what's still to buy here (uniques by their base type, the rares' bases, gems),
        then your filter copied unchanged. Your own file is never changed. Make it again after your list changes.
        Gems: PoE1 only. Filters from the website (online filters) can't be used: download the filter file into the folder first.
      </div>
      <div class="text-gray-500">{{ wantsLine }}</div>
      <div v-if="lf.busy" class="text-gray-500"><i class="fas fa-spinner fa-spin mr-1" />Working…</div>
      <div v-else-if="lf.error" class="text-red-400">{{ lf.error }}</div>
      <div v-if="lf.written" class="text-gray-200">
        Wrote <b>{{ lf.written }}</b>. In game: <b>Options → UI → Item filter</b>, pick <b>{{ lf.written.replace(/\.filter$/i, '') }}</b> (press the refresh button next to the list if it's not there yet).
        <span v-if="lf.refused.length" class="text-gray-500"> Left out (odd characters): {{ lf.refused.join(', ') }}.</span>
      </div>
      <div v-if="!lf.busy && !lf.written && lf.filters.length" class="flex flex-wrap gap-1">
        <button v-for="f of lf.filters" :key="f" class="ui-btn" :disabled="!wantsTotal" :title="`Make “${f.replace(/\.filter$/i, '')} + Orbhoarder” from this one`" @click="makeFilter(f)">{{ f.replace(/\.filter$/i, '') }}</button>
      </div>
      <div v-else-if="!lf.busy && !lf.written && !lf.error" class="text-gray-500">No .filter files in {{ lf.folder || 'the game folder' }}. Save your filter there first.</div>
      <div v-if="lf.folder" class="text-gray-600 truncate" :title="lf.folder">{{ lf.folder }}</div>
    </div>
    <div class="flex items-baseline gap-2 px-2 pb-1 shrink-0">
      <span class="text-gray-300">Still to buy:</span>
      <span class="text-yellow-300 text-sm">{{ money(shop.total) }}</span>
      <span class="text-gray-500">{{ toBuy }} item{{ toBuy === 1 ? '' : 's' }}<template v-if="shop.missing"> · {{ shop.missing }} without a price</template><template v-if="shop.rares"> · {{ shop.rares }} rare{{ shop.rares === 1 ? '' : 's' }} not counted</template></span>
      <label class="ml-auto flex items-center gap-1 text-gray-400" title="Show items you already have (ticked)">
        <input v-model="showOwned" type="checkbox">show ticked</label>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto px-2">
      <div v-if="!loading && !shop.rows.length && !error" class="text-gray-500 py-1">No uniques or gems in this build's gear. Pick a build in the Build panel first.</div>
      <div v-for="r of visible" :key="r.key" class="border-t border-gray-800" :class="{ 'opacity-50': r.owned }">
        <div class="flex items-center gap-2 py-0.5">
          <input type="checkbox" :checked="r.owned" :title="r.kind === 'gem' ? 'Got it' : 'Got it (same tick as the Build panel)'" @change="toggle(r)">
          <button class="w-4 text-center text-gray-500 hover:text-gray-200" :disabled="!gearOf(r)" :title="gearOf(r) ? 'Show the mods' : ''" @click="toggleOpen(r)">
            <i v-if="gearOf(r)" class="fas" :class="openRows.has(r.key) ? 'fa-chevron-down' : 'fa-chevron-right'" />
            <i v-else class="fas fa-gem" /></button>
          <button class="flex-1 min-w-0 truncate text-left" :class="r.kind === 'unique' ? 'text-orange-300' : (r.kind === 'rare' ? 'text-yellow-200' : 'text-teal-300')"
            :title="r.slots.join(', ')" @click="toggleOpen(r)">{{ r.label }}<span v-if="r.slots.length" class="text-gray-500"> · {{ r.slots.join(', ') }}</span></button>
          <price-spark v-if="r.kind !== 'rare'" :item="r.listing" />
          <span class="w-14 text-right" :class="r.listing ? 'text-yellow-300' : 'text-gray-600'"
            :title="r.kind === 'rare' ? 'Rares: price depends on the rolls, use Trade' : (r.listing ? `Cheapest on poe.ninja${r.listing.variant ? ': ' + r.listing.variant : ''}` : 'No poe.ninja price')">{{ r.listing ? money(r.listing.chaos) : (r.kind === 'rare' ? 'rolls' : '–') }}</span>
          <button class="ui-btn ui-btn-quiet" :title="tradeTitle(r)" @click="trade(r, false)"><i class="fas fa-search" />Trade</button>
          <button v-if="gearOf(r)" class="ui-btn ui-btn-quiet" :title="r.kind === 'unique' ? 'Trade: the same unique with at least these rolls' : 'Trade: any base of the same kind with at least these mods'" @click="trade(r, true)"><i class="fas fa-arrow-up" /></button>
          <ui-menu :items="rowMenu(r)" align-right button-class="ui-btn-quiet" title="More" />
        </div>
        <div v-if="tradeErr[r.key]" class="pl-12 pb-1 text-red-400">{{ tradeErr[r.key] }}</div>
        <price-alert-form v-if="alertOpen === r.key && r.listing" class="pl-12" :item="{ type: r.listing.type, name: r.listing.name, variant: r.listing.variant, label: r.listing.variant ? `${r.label} (${r.listing.variant})` : r.label }" :chaos="r.listing.chaos" />
        <div v-if="openRows.has(r.key) && gearOf(r)" class="pl-12 pb-1.5 space-y-px">
          <div class="text-gray-400">{{ gearOf(r)!.baseName }}<template v-if="gearOf(r)!.itemLevel"> · item level {{ gearOf(r)!.itemLevel }}</template><template v-if="gearOf(r)!.corrupted"> · <span class="text-red-400">corrupted</span></template></div>
          <div v-for="(m, mi) of gearOf(r)!.mods" :key="mi" :class="modClass(m)">{{ m.text }}<span v-if="m.crafted" class="text-gray-500"> (crafted)</span><span v-if="m.fractured" class="text-gray-500"> (fractured)</span></div>
          <div v-if="!gearOf(r)!.mods.length" class="text-gray-500">No mods in the build file.</div>
        </div>
      </div>
    </div>
    <div class="px-2 py-1 text-gray-500 shrink-0">
      <i class="fas fa-info-circle mr-1" />Prices: cheapest on poe.ninja (gems: lowest level/quality). Trade opens the trade site: uniques any copy, rares this base with these mods; ↑ = at least these rolls / any base.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef } from 'vue'
import { Host } from '@/web/background/IPC'
import type { PobGearItem, PobSocketGroup } from '@ipc/types'
import PriceSpark from './PriceSpark.vue'
import PriceAlertForm from './PriceAlertForm.vue'
import UiMenu, { type UiMenuItem } from '../ui/UiMenu.vue'
import { useMarket } from './use-market'
import { copyText } from '../pob/market'
import { openTradeSearch, openTradeByType } from '../pob/gear-actions'
import { shoppingList, type ShopRow } from './market-tools'
import { IS_OTHER_DEVICE } from './price-alerts-store'
import { wantsFromShop, wantsCount } from '@ipc/loot-filter'

const { all, money, open, ninja } = useMarket()
ninja.queuePricesFetch()

const buildName = ref('')
const itemSet = ref('')
const gear = shallowRef<PobGearItem[]>([])
const groups = shallowRef<PobSocketGroup[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
let pending = 0
// own id range so the Build panel's replies aren't taken for ours
let gearId = 700000
let gemsId = 700000

const offGear = Host.onEvent('MAIN->CLIENT::pob-gear', (e) => {
  if (e.requestId !== gearId) return
  if (e.ok) { buildName.value = e.build?.name ?? ''; itemSet.value = e.itemSet ?? ''; gear.value = e.items ?? [] } else error.value = clean(e.error)
  done()
})
const offGems = Host.onEvent('MAIN->CLIENT::pob-gems', (e) => {
  if (e.requestId !== gemsId) return
  if (e.ok) groups.value = e.groups ?? []
  else error.value = clean(e.error)
  done()
})
onUnmounted(() => { offGear.abort(); offGems.abort() })
function clean (s?: string) { return (s ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '') }
function done () { pending -= 1; if (pending <= 0) loading.value = false }
function request () {
  loading.value = true
  error.value = null
  pending = 2
  gearId += 1
  gemsId += 1
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-gear', payload: { requestId: gearId } })
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-gems', payload: { requestId: gemsId } })
}
onMounted(request)

// ticks: uniques share the Build panel's "got it" tick; gems have their own per build
const OWNED_KEY = 'deathloom.gear-owned.v1'
const GEMS_KEY = 'deathloom.shopping-gems.v1'
function read<T> (k: string, d: T): T { try { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); return v && typeof v === 'object' ? v : d } catch { return d } }
const owned = shallowRef(read<Record<string, Record<string, string>>>(OWNED_KEY, {}))
const gemTicks = shallowRef(read<Record<string, string[]>>(GEMS_KEY, {}))
function onStorage (e: StorageEvent) {
  if (e.key === OWNED_KEY) owned.value = read(OWNED_KEY, {})
  if (e.key === GEMS_KEY) gemTicks.value = read(GEMS_KEY, {})
}
window.addEventListener('storage', onStorage)
onUnmounted(() => window.removeEventListener('storage', onStorage))
const ownedKey = computed(() => `${buildName.value}|${itemSet.value}`)
const itemId = (i: PobGearItem) => `${i.title || i.name}|${i.baseName ?? ''}`

const mainGear = computed(() => gear.value.filter(i => i.group !== 'swap'))
const shop = computed(() => shoppingList(
  mainGear.value.map(i => ({ slot: i.label || i.slot, id: i.slot, name: i.rarity === 'Unique' ? i.searchText : (i.title || i.name || i.baseName), unique: i.rarity === 'Unique', owned: owned.value[ownedKey.value]?.[i.slot] === itemId(i) })),
  groups.value.filter(g => g.enabled).flatMap(g => g.gems),
  all.value,
  new Set(gemTicks.value[buildName.value] ?? [])
))
const showOwned = ref(false)
const visible = computed(() => shop.value.rows.filter(r => showOwned.value || !r.owned))
const toBuy = computed(() => shop.value.rows.filter(r => !r.owned).length)

function toggle (r: ShopRow) {
  if (r.kind === 'gem') {
    const all = { ...gemTicks.value }
    const set = new Set(all[buildName.value] ?? [])
    const k = r.label.toLowerCase()
    if (set.has(k)) set.delete(k); else set.add(k)
    all[buildName.value] = [...set]
    gemTicks.value = all
    try { localStorage.setItem(GEMS_KEY, JSON.stringify(all)) } catch {}
    return
  }
  // gear: tick every slot behind the row (same storage as the Build panel)
  const items = mainGear.value.filter(i => r.ids.includes(i.slot))
  const allOwned = { ...owned.value }
  const slots = new Set(items.map(i => i.slot))
  const kept = Object.entries(allOwned[ownedKey.value] ?? {}).filter(([slot]) => !slots.has(slot))
  allOwned[ownedKey.value] = Object.fromEntries(r.owned ? kept : [...kept, ...items.map(i => [i.slot, itemId(i)])])
  owned.value = allOwned
  try { localStorage.setItem(OWNED_KEY, JSON.stringify(allOwned)) } catch {}
}

// Deathloom fork (Gerhard 20 Nov 2026: no mods, no trade buttons): mods fold out per
// row; Trade / ↑ use the same searches as the Build panel's Gear tab
const openRows = ref(new Set<string>())
function toggleOpen (r: ShopRow) {
  if (!gearOf(r)) return
  const s = new Set(openRows.value)
  if (s.has(r.key)) s.delete(r.key); else s.add(r.key)
  openRows.value = s
}
function gearOf (r: ShopRow): PobGearItem | null {
  return r.ids.length ? (mainGear.value.find(i => i.slot === r.ids[0]) ?? null) : null
}
function modClass (m: PobGearItem['mods'][number]) {
  if (m.kind === 'implicit' || m.kind === 'enchant') return 'text-blue-300'
  if (m.crafted) return 'text-sky-200'
  if (m.fractured) return 'text-yellow-200'
  return 'text-gray-200'
}
function tradeTitle (r: ShopRow) {
  if (r.kind === 'gem') return `Trade site: ${r.label}, cheapest first`
  if (r.kind === 'unique') return `Trade site: any ${r.label}`
  return 'Trade site: this base type with these mods (at least these values)'
}
const tradeErr = ref<Record<string, string>>({})
function trade (r: ShopRow, upgrade: boolean) {
  const g = gearOf(r)
  const err = g ? openTradeSearch(g.text, upgrade) : openTradeByType(r.label)
  tradeErr.value = { ...tradeErr.value, [r.key]: err ?? '' }
}

// Deathloom fork (Q10): loot filter add-on (part 1: made by hand from this menu)
const lf = reactive({ open: false, help: false, busy: false, error: '', written: '', folder: '', filters: [] as string[], refused: [] as string[] })
let lfId = 0
const listMenu = computed((): UiMenuItem[] => [
  {
    label: 'Make loot filter add-on…',
    icon: 'fas fa-filter',
    disabled: IS_OTHER_DEVICE,
    hint: IS_OTHER_DEVICE ? 'Only on the PC' : 'A copy of your loot filter that also shows what this list still needs',
    action: openLootFilter
  }
])
const lootWants = computed(() => wantsFromShop(shop.value.rows.map(r => {
  if (r.kind === 'gem') {
    const gem = groups.value.flatMap(g => g.gems).find(x => x.name.toLowerCase() === r.label.toLowerCase())
    return { kind: r.kind, owned: r.owned, name: r.label, support: gem?.support === true }
  }
  return { kind: r.kind, owned: r.owned, name: gearOf(r)?.baseName ?? '' }
})))
const wantsTotal = computed(() => wantsCount(lootWants.value))
const wantsLine = computed(() => {
  const w = lootWants.value
  if (!wantsTotal.value) return 'Nothing left to buy on this list, so nothing to add.'
  const parts = [[w.uniqueBases.length, 'unique base'], [w.bases.length, 'rare base'], [w.gems.length, 'gem']]
    .filter(([n]) => n).map(([n, s]) => `${n} ${s}${n === 1 ? '' : 's'}`)
  return `Adds: ${parts.join(', ')} (what's not ticked).`
})
const offLf = Host.onEvent('MAIN->CLIENT::loot-filter', (e) => {
  if (e.requestId !== lfId) return
  lf.busy = false
  lf.error = e.ok ? '' : (e.error ?? 'Something went wrong.')
  if (e.folder) lf.folder = e.folder
  if (e.filters) lf.filters = e.filters
  if (e.written) { lf.written = e.written; lf.refused = e.refused ?? [] }
})
onUnmounted(() => { offLf.abort() })
function openLootFilter () {
  Object.assign(lf, { open: true, busy: true, error: '', written: '', refused: [] })
  lfId = 800000 + Math.floor(Math.random() * 100000)
  Host.sendEvent({ name: 'CLIENT->MAIN::loot-filter', payload: { requestId: lfId, op: 'list' } })
}
function makeFilter (source: string) {
  Object.assign(lf, { busy: true, error: '', written: '', refused: [] })
  lfId += 1
  Host.sendEvent({ name: 'CLIENT->MAIN::loot-filter', payload: { requestId: lfId, op: 'make', source, wants: lootWants.value } })
}

// Deathloom fork (Q6): price alert above / below a price for this row
const alertOpen = ref<string | null>(null)
function rowMenu (r: ShopRow): UiMenuItem[] {
  return [
    { label: 'Price line above / below…', icon: 'fas fa-bell', disabled: !r.listing || r.kind === 'rare', hint: 'Tell me (phone or Windows notification) when the price crosses a line', action: () => { alertOpen.value = alertOpen.value === r.key ? null : r.key } },
    { label: 'Copy name for the in-game market', icon: 'far fa-copy', hint: 'Press / in game, then Ctrl+V', action: () => copyText(gearOf(r)?.searchText ?? r.label) },
    { label: 'Open on poe.ninja', icon: 'fas fa-external-link-alt', disabled: !r.listing, action: () => { if (r.listing) open(r.listing.url) } }
  ]
}
</script>
