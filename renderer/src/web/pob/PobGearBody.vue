<template>
  <!-- Deathloom fork: build gear panel body (used by the overlay widget and the HUD window) -->
  <div class="widget-default-style flex flex-col text-gray-200 leading-tight"
    :style="hud ? { width: 'var(--hud-w, 26rem)', maxHeight: 'var(--hud-h, 40rem)' } : { width: '26rem', maxHeight: '85vh' }">
    <div class="flex items-center gap-x-2 px-2 py-1 bg-gray-900 rounded-t shrink-0">
      <span class="text-gray-500 shrink-0"><i class="fas fa-hammer mr-1" />Build</span>
      <div class="flex gap-px text-sm shrink-0">
        <button v-for="t of TABS" :key="t.key" class="px-2 rounded"
          :class="tab === t.key ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-200'"
          @click="setTab(t.key)">{{ t.label }}</button>
      </div>
      <span v-if="build" class="text-gray-400 truncate text-sm" :title="buildTitle">{{ buildTitle }}</span>
      <div class="ml-auto flex items-center gap-x-2 shrink-0">
        <button v-if="tab === 'gear'" class="text-gray-500 hover:text-gray-200 text-sm" @click="allMods = !allMods">
          {{ allMods ? 'Hide mods' : 'Show mods' }}</button>
        <button class="text-gray-500 hover:text-gray-200 text-sm" title="Build sharing: sign in with GitHub, Pull / Push"
          :class="{ 'text-gray-200': showSync }" @click="showSync = !showSync"><i class="fas fa-cloud" /></button>
        <button v-if="!hud" class="text-gray-500 hover:text-gray-200 text-sm" title="Import a PoB code or build link"
          :class="{ 'text-gray-200': showImport }" @click="showImport = !showImport"><i class="fas fa-file-import" /></button>
        <button class="text-gray-500 hover:text-gray-200 text-sm" title="Pick the build and loadout"
          :class="{ 'text-gray-200': showPicker }" @click="showPicker = !showPicker"><i class="fas fa-exchange-alt" /></button>
        <button v-if="tab === 'gear'" class="text-gray-500 hover:text-gray-200" title="Reload from Path of Building"
          :disabled="loading" @click="request"><i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /></button>
      </div>
    </div>

    <template v-if="visible">
    <build-sync v-if="showSync" class="shrink-0 border-b border-gray-700" :hud="hud" @synced="pickerRef?.request()" />
    <build-import v-if="showImport && !hud" class="shrink-0 border-b border-gray-700" @imported="pickerRef?.request()" />
    <build-picker v-show="showPicker" ref="pickerRef" class="shrink-0" @changed="onBuildChanged" />
    <pob-gems v-if="tab === 'gems'" ref="gemsRef" />
    <pob-tree v-else-if="tab === 'tree'" ref="treeRef" />
    <template v-else>
    <div v-if="error" class="p-2 text-gray-400 text-sm">{{ error }}</div>
    <div v-else-if="!items && loading" class="p-2 text-gray-500 text-sm">Loading from Path of Building…</div>
    <div v-else-if="items && !items.length" class="p-2 text-gray-500 text-sm">This build's item set is empty.</div>

    <div v-else-if="items" class="overflow-y-auto min-h-0 p-1">
      <div class="px-1 pb-1 text-xs text-gray-500">
        Copy = name for the in-game market (press <span class="bg-gray-700 rounded px-1">/</span> then Ctrl+V).
        Trade = exact stat search on the trade site.
      </div>
      <template v-for="group of groups" :key="group.key">
        <div class="px-1 pt-2 pb-px text-xs uppercase tracking-wide text-gray-500">{{ group.label }}</div>
        <div v-for="item of group.items" :key="item.slot"
          class="rounded px-1 py-px hover:bg-gray-800">
          <div class="flex items-center gap-x-2">
            <button class="flex-1 min-w-0 flex items-baseline gap-x-2 text-left" @click="toggle(item.slot)">
              <span class="text-gray-500 text-sm shrink-0 w-24 truncate" :title="item.label">{{ item.label }}</span>
              <span class="truncate" :style="{ color: rarityColour(item.rarity) }" :title="itemTitle(item)">
                {{ item.title || item.name }}</span>
              <span v-if="item.title && item.rarity !== 'Unique'" class="text-gray-500 text-sm truncate shrink">{{ item.baseName }}</span>
            </button>
            <div class="flex gap-px shrink-0 text-sm">
              <button class="bg-gray-700 text-gray-300 rounded-l px-1.5"
                :title="`Copy '${item.searchText}' for the in-game market`"
                @click="copy(item.searchText, item.slot)">
                <i v-if="copiedKey === item.slot" class="fas fa-check text-green-400" />
                <i v-else class="far fa-copy" /></button>
              <button class="bg-gray-700 text-gray-300 px-1.5" title="Exact stat search on the official trade site"
                @click="openTrade(item)">Trade</button>
              <button class="bg-gray-700 text-gray-300 rounded-r px-1.5" title="Price check (edit stat filters, build impact)"
                @click="priceCheck(item, $event)"><i class="fas fa-search-dollar" /></button>
            </div>
          </div>
          <div v-if="tradeError[item.slot]" class="text-xs text-red-400" style="padding-left: 6.5rem;">{{ tradeError[item.slot] }}</div>
          <div v-if="isOpen(item.slot) && item.mods.length" class="pb-1 text-sm" style="padding-left: 6.5rem;">
            <div v-for="(mod, idx) of item.mods" :key="idx" :class="modClass(mod, item.mods, idx)">
              {{ mod.text }}<span v-if="mod.crafted" class="text-gray-500 text-xs"> (crafted)</span><span
                v-if="mod.fractured" class="text-gray-500 text-xs"> (fractured)</span>
            </div>
          </div>
        </div>
      </template>
      <div v-if="itemSet" class="px-1 pt-2 text-xs text-gray-600">Item set: {{ pobText(itemSet) }}</div>
    </div>
    </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { PobBuildInfo, PobGearItem } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { openTradeSearch, openPriceCheck } from './gear-actions'
import { useCopyFeedback } from './market'
import BuildPicker from './BuildPicker.vue'
import BuildSync from './BuildSync.vue'
import BuildImport from './BuildImport.vue'
import PobGems from './PobGems.vue'
import PobTree from './PobTree.vue'
import { pobText } from './labels'

// active: the panel is on screen (the overlay widget is shown, or the HUD panel)
// hud: inside the HUD window (Trade / price check are done by the overlay)
const props = defineProps<{ active: boolean, hud?: boolean }>()
const { copiedKey, copy } = useCopyFeedback()

const loading = ref(false)
const error = ref<string | null>(null)
const build = shallowRef<PobBuildInfo | null>(null)
const items = shallowRef<PobGearItem[] | null>(null)
const itemSet = ref('')
const allMods = ref(false)
const opened = ref<Record<string, boolean>>({})
const tradeError = ref<Record<string, string>>({})
const TABS = [{ key: 'gear', label: 'Gear' }, { key: 'gems', label: 'Gems' }, { key: 'tree', label: 'Tree' }] as const
const tab = ref<'gear' | 'gems' | 'tree'>('gear')
const showPicker = ref(true)
const showSync = ref(false)
const showImport = ref(false)
const pickerRef = ref<InstanceType<typeof BuildPicker> | null>(null)
const gemsRef = ref<InstanceType<typeof PobGems> | null>(null)
const treeRef = ref<InstanceType<typeof PobTree> | null>(null)
const visible = computed(() => props.active)

function setTab (key: 'gear' | 'gems' | 'tree') {
  if (tab.value === key) return
  tab.value = key
  if (key === 'gear') request()
}

// The picker loads the build list when the panel opens and after each change
function onBuildChanged (b: PobBuildInfo | null) {
  if (b) build.value = b
  if (tab.value === 'gear') request()
  else if (tab.value === 'gems') gemsRef.value?.request()
  else treeRef.value?.request()
}

let lastRequestId = 0

const GROUPS: Array<{ key: PobGearItem['group'], label: string }> = [
  { key: 'gear', label: 'Gear' },
  { key: 'swap', label: 'Weapon swap' },
  { key: 'flask', label: 'Flasks' },
  { key: 'jewel', label: 'Jewels' },
  { key: 'abyss', label: 'Abyss jewels' }
]

const groups = computed(() => {
  const list = items.value ?? []
  return GROUPS
    .map(g => ({ ...g, items: list.filter(i => i.group === g.key) }))
    .filter(g => g.items.length)
})

const buildTitle = computed(() => {
  const b = build.value
  if (!b) return ''
  const cls = b.ascendancy ?? b.className
  return [b.name, cls && b.level ? `${cls} ${b.level}` : cls, b.mainSkill].filter(Boolean).join(' · ')
})

const listener = Host.onEvent('MAIN->CLIENT::pob-gear', (e) => {
  if (e.requestId !== lastRequestId) return
  loading.value = false
  if (e.ok) {
    error.value = null
    build.value = e.build ?? null
    itemSet.value = e.itemSet ?? ''
    items.value = e.items ?? []
  } else {
    error.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '')
  }
})

onUnmounted(() => {
  listener.abort()
})

function request () {
  loading.value = true
  tradeError.value = {}
  lastRequestId += 1
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-gear',
    payload: { requestId: lastRequestId }
  })
}

// Gear reloads when the build picker (re)loads, i.e. each time the panel opens

function toggle (slot: string) {
  opened.value[slot] = !isOpen(slot)
}

function isOpen (slot: string) {
  return opened.value[slot] ?? allMods.value
}

watch(allMods, () => { opened.value = {} })

function rarityColour (rarity: string) {
  switch (rarity) {
    case 'Unique': return '#af6025'
    case 'Rare': return '#ffff77'
    case 'Magic': return '#8888ff'
    default: return '#c8c8c8'
  }
}

function modClass (mod: PobGearItem['mods'][number], mods: PobGearItem['mods'], idx: number) {
  const classes: string[] = []
  // A thin line between implicits/enchants and explicits, like the game tooltip
  const prev = mods[idx - 1]
  if (prev && prev.kind !== 'explicit' && mod.kind === 'explicit') classes.push('mt-1 pt-1 border-t border-gray-700')
  if (mod.unsupported) classes.push('text-gray-600')
  else if (mod.kind === 'enchant') classes.push('text-teal-300')
  else if (mod.kind === 'implicit' || mod.kind === 'scourge') classes.push('text-gray-300')
  else if (mod.crafted) classes.push('text-blue-300')
  else if (mod.fractured) classes.push('text-yellow-600')
  else classes.push('text-indigo-300')
  return classes
}

function itemTitle (item: PobGearItem) {
  const parts = [item.name]
  if (item.itemLevel) parts.push(`Item level ${item.itemLevel}`)
  if (item.corrupted) parts.push('Corrupted')
  return parts.join(' · ')
}

function openTrade (item: PobGearItem) {
  tradeError.value = { ...tradeError.value, [item.slot]: '' }
  if (props.hud) {
    // the overlay owns the league list; it opens the trade site
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-gear-action', payload: { action: 'trade', text: item.text } })
    return
  }
  const err = openTradeSearch(item.text)
  if (err) tradeError.value[item.slot] = err
}

// Open the normal price check window for this item (stat filters, prices, build impact)
function priceCheck (item: PobGearItem, e: MouseEvent) {
  if (props.hud) {
    // main opens it in the overlay and activates the overlay
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-gear-action', payload: { action: 'price-check', text: item.text } })
    return
  }
  openPriceCheck(item.text, { x: e.clientX, y: e.clientY })
}
</script>
