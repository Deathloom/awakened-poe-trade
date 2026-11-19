<template>
  <!-- Deathloom fork (20 Nov): build shopping list — the followed build's uniques and gems at poe.ninja prices -->
  <div class="flex flex-col h-full min-h-0 text-xs">
    <div class="flex items-center gap-2 px-2 py-1 shrink-0">
      <span class="truncate text-gray-300" :title="buildName">{{ buildName || 'Build' }}<span v-if="itemSet" class="text-gray-500"> · {{ itemSet }}</span></span>
      <button class="ui-btn ui-btn-quiet ml-auto" :disabled="loading" title="Read the build again from Path of Building" @click="request">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /></button>
    </div>
    <div v-if="error" class="px-2 pb-1 text-red-400">{{ error }}</div>
    <div class="flex items-baseline gap-2 px-2 pb-1 shrink-0">
      <span class="text-gray-300">Still to buy:</span>
      <span class="text-yellow-300 text-sm">{{ money(shop.total) }}</span>
      <span class="text-gray-500">{{ toBuy }} item{{ toBuy === 1 ? '' : 's' }}<template v-if="shop.missing"> · {{ shop.missing }} without a price</template><template v-if="shop.rares"> · {{ shop.rares }} rare{{ shop.rares === 1 ? '' : 's' }} not counted</template></span>
      <label class="ml-auto flex items-center gap-1 text-gray-400" title="Show items you already have (ticked)">
        <input v-model="showOwned" type="checkbox">show ticked</label>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto px-2">
      <div v-if="!loading && !shop.rows.length && !error" class="text-gray-500 py-1">No uniques or gems in this build's gear. Pick a build in the Build panel first.</div>
      <div v-for="r of visible" :key="r.key" class="flex items-center gap-2 py-0.5 border-t border-gray-800" :class="{ 'opacity-50': r.owned }">
        <input type="checkbox" :checked="r.owned" :title="r.kind === 'unique' ? 'Got it (same tick as the Build panel)' : 'Got it'" @change="toggle(r)">
        <i class="w-4 text-center text-gray-500" :class="r.kind === 'gem' ? 'fas fa-gem' : 'fas fa-ring'" />
        <span class="flex-1 min-w-0 truncate" :title="r.slots.join(', ')">{{ r.label }}<span v-if="r.slots.length" class="text-gray-500"> · {{ r.slots.join(', ') }}</span></span>
        <price-spark :item="r.listing" />
        <span class="w-14 text-right" :class="r.listing ? 'text-yellow-300' : 'text-gray-600'"
          :title="r.listing ? `Cheapest on poe.ninja${r.listing.variant ? ': ' + r.listing.variant : ''}` : 'No poe.ninja price'">{{ r.listing ? money(r.listing.chaos) : '–' }}</span>
        <ui-menu :items="rowMenu(r)" align-right button-class="ui-btn-quiet" title="More" />
      </div>
    </div>
    <div class="px-2 py-1 text-gray-500 shrink-0">
      <i class="fas fa-info-circle mr-1" />Cheapest version on poe.ninja (gems: lowest level/quality, not corrupted). Rares depend on their rolls: use Trade in the Build panel's Gear tab.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { Host } from '@/web/background/IPC'
import type { PobGearItem, PobSocketGroup } from '@ipc/types'
import PriceSpark from './PriceSpark.vue'
import UiMenu, { type UiMenuItem } from '../ui/UiMenu.vue'
import { useMarket } from './use-market'
import { copyText } from '../pob/market'
import { shoppingList, type ShopRow } from './market-tools'

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
  mainGear.value.map(i => ({ slot: i.label || i.slot, name: i.searchText, unique: i.rarity === 'Unique', owned: owned.value[ownedKey.value]?.[i.slot] === itemId(i) })),
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
  // unique: tick every slot that has it (same storage as the Build panel)
  const items = mainGear.value.filter(i => i.rarity === 'Unique' && i.searchText.toLowerCase() === r.label.toLowerCase())
  const allOwned = { ...owned.value }
  const slots = new Set(items.map(i => i.slot))
  const kept = Object.entries(allOwned[ownedKey.value] ?? {}).filter(([slot]) => !slots.has(slot))
  allOwned[ownedKey.value] = Object.fromEntries(r.owned ? kept : [...kept, ...items.map(i => [i.slot, itemId(i)])])
  owned.value = allOwned
  try { localStorage.setItem(OWNED_KEY, JSON.stringify(allOwned)) } catch {}
}

function rowMenu (r: ShopRow): UiMenuItem[] {
  return [
    { label: 'Copy name for the in-game market', icon: 'far fa-copy', hint: 'Press / in game, then Ctrl+V', action: () => copyText(r.label) },
    { label: 'Open on poe.ninja', icon: 'fas fa-external-link-alt', disabled: !r.listing, action: () => { if (r.listing) open(r.listing.url) } }
  ]
}
</script>
