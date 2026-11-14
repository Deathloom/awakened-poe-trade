<template>
  <!-- Deathloom fork (body, used by the overlay widget and the desktop window): stash tracker (personal opt-in; reads tabs with your POESESSID, manual refresh only) -->
  <div class="widget-default-style flex flex-col text-gray-200 leading-tight text-sm" :style="fill ? { width: '100%', height: '100%' } : { width: '26rem', maxHeight: '80vh' }">
    <div class="flex items-center gap-x-2 px-2 py-1 bg-gray-900 rounded-t shrink-0">
      <span class="text-gray-500"><i class="fas fa-box-open mr-1" />Stash</span>
      <span v-if="fetchedAt" class="text-xs text-gray-500">{{ new Date(fetchedAt).toLocaleTimeString() }}</span>
      <div class="ml-auto flex gap-x-2">
        <button class="text-gray-500 hover:text-gray-200" title="Pick tabs" @click="pickTabs = !pickTabs; if (pickTabs && !tabs.length) send('tabs')">
          <i class="fas fa-th-list" /></button>
        <button class="text-gray-500 hover:text-gray-200" title="Refresh the tracked tabs (at most every 30 s)"
          :disabled="loading" @click="send('refresh')"><i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /></button>
      </div>
    </div>

    <div v-if="!stashCfg.enabled" class="p-2 text-gray-500">
      The stash tracker is off. It reads your stash tabs from pathofexile.com with your login cookie (POESESSID):
      a grey area under GGG's rules, so it's opt-in. Turn it on in Settings → Path of Building.
    </div>
    <template v-else>
      <div v-if="error" class="p-2 text-red-400">{{ error }}</div>
      <div v-if="pickTabs" class="p-1 border-b border-gray-800">
        <div class="text-xs text-gray-500 px-1 pb-1">Tabs to track (max 12; each one is a request):</div>
        <div class="flex flex-wrap gap-1">
          <button v-for="t of tabs" :key="t.index" class="rounded px-1.5 text-xs"
            :style="{ borderLeft: `3px solid ${t.colour ?? '#555'}` }"
            :class="stashCfg.tabs.includes(t.index) ? 'bg-gray-600 text-gray-100' : 'bg-gray-800 text-gray-400'"
            @click="toggleTab(t.index)">{{ t.name || `#${t.index}` }}</button>
        </div>
      </div>
      <div class="overflow-y-auto min-h-0 p-1">
        <div v-if="!items" class="p-1 text-gray-500">Press refresh to read the tracked tabs.</div>
        <template v-else>
          <div class="flex px-1 pb-1">
            <span class="flex-1">Total (priced on poe.ninja)</span>
            <span class="text-yellow-300">{{ fmtValue(total) }}</span>
          </div>
          <div v-for="t of perTab" :key="t.index" class="flex px-1 text-gray-400">
            <span class="flex-1 truncate">{{ t.name }}</span>
            <span>{{ fmtValue(t.value) }}</span>
          </div>
          <div class="px-1 pt-2 text-xs uppercase text-gray-500">New since last refresh ({{ newItems.length }})</div>
          <div v-if="!newItems.length" class="px-1 text-gray-600">Nothing new (the first refresh only takes a snapshot).</div>
          <div v-for="i of newItems.slice(0, 40)" :key="i.item.id" class="flex gap-x-2 px-1">
            <span class="truncate flex-1" :class="rarityClass(i.item.frameType)">{{ label(i.item) }}</span>
            <span class="text-gray-400 shrink-0">{{ i.value ? fmtValue(i.value) : '' }}</span>
          </div>
          <div class="px-1 pt-2 text-xs uppercase text-gray-500">Most valuable</div>
          <div v-for="i of top" :key="i.item.id" class="flex gap-x-2 px-1">
            <span class="truncate flex-1" :class="rarityClass(i.item.frameType)">{{ label(i.item) }}</span>
            <span class="text-gray-400 shrink-0">{{ fmtValue(i.value) }}</span>
          </div>
          <div class="px-1 pt-2 text-xs text-gray-600">
            Rares and unpriced items count as 0. Uniques are priced without variants, so check expensive ones with a price check.
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import type { StashItem, StashTabInfo } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { AppConfig, saveConfig, pushHostConfig, defaultPobConfig } from '@/web/Config'
import { usePoeninja } from '@/web/background/Prices'
import { stashQuery } from './pricing'

defineProps<{ fill?: boolean }>()

const { findPriceByQuery, queuePricesFetch, autoCurrency } = usePoeninja()
const stashCfg = computed(() => AppConfig().pob?.stash ?? defaultPobConfig().stash)

const loading = ref(false)
const error = ref<string | null>(null)
const pickTabs = ref(false)
const tabs = shallowRef<StashTabInfo[]>([])
const items = shallowRef<StashItem[] | null>(null)
const newIds = shallowRef<Set<string>>(new Set())
const fetchedAt = ref<number | null>(null)
let lastRequestId = 0

const listener = Host.onEvent('MAIN->CLIENT::stash', (e) => {
  if (e.requestId !== lastRequestId) return
  loading.value = false
  if (!e.ok) { error.value = e.error ?? 'Unknown error'; return }
  error.value = null
  if (e.tabs) tabs.value = e.tabs
  if (e.items) {
    items.value = e.items
    newIds.value = new Set(e.newIds ?? [])
    fetchedAt.value = e.fetchedAt ?? Date.now()
  }
})
onUnmounted(() => { listener.abort() })

function send (action: 'tabs' | 'refresh') {
  loading.value = true
  if (action === 'refresh') queuePricesFetch()
  lastRequestId += 1
  Host.sendEvent({ name: 'CLIENT->MAIN::stash', payload: { requestId: lastRequestId, action } })
}

function toggleTab (index: number) {
  const s = AppConfig().pob.stash
  s.tabs = s.tabs.includes(index) ? s.tabs.filter(i => i !== index) : [...s.tabs, index].slice(0, 12)
  saveConfig()
  pushHostConfig()
}

function valueOf (item: StashItem): number {
  const q = stashQuery(item)
  if (!q) return 0
  const found = findPriceByQuery(q)
  return found ? found.chaos * (item.stackSize ?? 1) : 0
}

const valued = computed(() => (items.value ?? []).map(item => ({ item, value: valueOf(item) })))
const total = computed(() => valued.value.reduce((a, b) => a + b.value, 0))
const perTab = computed(() => {
  const byTab = new Map<number, number>()
  for (const v of valued.value) byTab.set(v.item.tab, (byTab.get(v.item.tab) ?? 0) + v.value)
  return [...byTab.entries()].map(([index, value]) => ({
    index, value, name: tabs.value.find(t => t.index === index)?.name ?? `#${index}`
  }))
})
const newItems = computed(() => valued.value.filter(v => newIds.value.has(v.item.id)).sort((a, b) => b.value - a.value))
const top = computed(() => valued.value.filter(v => v.value > 0).sort((a, b) => b.value - a.value).slice(0, 15))

function label (i: StashItem) {
  const name = i.name ? `${i.name} ${i.typeLine}` : i.typeLine
  return i.stackSize && i.stackSize > 1 ? `${i.stackSize}× ${name}` : name
}

function fmtValue (chaos: number) {
  if (!chaos) return '—'
  const v = autoCurrency(chaos)
  const n = v.currency === 'div' ? Math.round(v.min * 10) / 10 : Math.round(v.min)
  return `${n} ${v.currency === 'div' ? 'div' : 'c'}`
}

function rarityClass (frameType: number) {
  return ({ 1: 'text-blue-300', 2: 'text-yellow-200', 3: 'text-orange-400', 4: 'text-teal-300', 5: 'text-gray-200', 6: 'text-gray-300' } as Record<number, string>)[frameType] ?? ''
}
</script>
