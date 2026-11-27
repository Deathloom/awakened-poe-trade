<template>
  <!-- Deathloom fork: build gear panel body (used by the overlay widget and the HUD window) -->
  <div class="widget-default-style flex flex-col text-gray-200 leading-tight"
    :style="desktop ? { width: '100%', height: '100%' } : hud ? { width: 'var(--hud-w, 26rem)', maxHeight: 'var(--hud-h, 40rem)' } : { width: '26rem', maxHeight: '85vh' }">
    <div class="flex items-center gap-x-2 px-2 py-1 bg-gray-900 rounded-t shrink-0">
      <span class="text-gray-500 shrink-0"><i class="fas fa-hammer mr-1" />Build</span>
      <div class="flex gap-px text-sm shrink-0">
        <button v-for="t of tabs" :key="t.key" class="px-2 rounded"
          :class="tab === t.key ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-200'"
          @click="setTab(t.key)">{{ t.label }}</button>
      </div>
      <span v-if="build" class="text-gray-400 truncate text-sm" :title="buildTitle">{{ buildTitle }}</span>
      <!-- Deathloom fork (19 Nov, calmer UI): one labelled button + one menu instead of 8 loose icons -->
      <div class="ml-auto flex items-center gap-x-1 shrink-0">
        <button class="ui-btn" :class="{ 'ui-btn-on': showPicker }" title="Pick the build and loadout" @click="showPicker = !showPicker">
          <i class="fas fa-exchange-alt" />Build</button>
        <button v-if="tab === 'gear'" class="ui-btn ui-btn-quiet" :disabled="loading" title="Reload from Path of Building" @click="request">
          <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /></button>
        <ui-menu :items="headerMenu" align-right title="More: import, sync, compare, stages, edit, manage" />
      </div>
    </div>

    <template v-if="visible">
    <build-sync v-if="showSync" class="shrink-0 border-b border-gray-700" :hud="hud" @synced="pickerRef?.request()" />
    <build-import v-if="showImport" class="shrink-0 border-b border-gray-700" :hud="hud"
      @imported="pickerRef?.request()" />
    <loadout-editor v-if="desktop && showEdit" class="shrink-0 border-b border-gray-700" @changed="pickerRef?.request()" />
    <build-manager v-if="desktop && showManage" class="shrink-0 border-b border-gray-700" @changed="pickerRef?.request()" />
    <build-compare v-if="desktop && showCompare" class="shrink-0 border-b border-gray-700" />
    <loadout-changes v-if="showSteps" ref="stepsRef" class="shrink-0 border-b border-gray-700 max-h-[50%] overflow-y-auto" @changed="pickerRef?.request()" />
    <build-picker v-show="showPicker" ref="pickerRef" class="shrink-0" @changed="onBuildChanged" />
    <div v-if="filterReminder" class="shrink-0 px-2 py-1 text-xs text-gray-400 bg-gray-900 border-b border-gray-700">
      <i class="fas fa-filter mr-1" />Loot filter for {{ filterReminder.build }}: <span class="text-gray-200">{{ filterReminder.name }}</span>
      <button class="ml-1 text-blue-400 hover:underline" @click="setTab('notes')">Notes</button>
      <button class="ui-btn ui-btn-quiet ml-1" title="Hide until the build changes" @click="hiddenFilterFor = notesState?.build ?? ''"><i class="fas fa-times" /></button>
    </div>
    <pob-gems v-if="tab === 'gems'" ref="gemsRef" />
    <pob-tree v-else-if="tab === 'tree'" ref="treeRef" />
    <pob-tree-map v-else-if="tab === 'map'" ref="mapRef" class="flex-1" />
    <pob-notes v-else-if="tab === 'notes'" ref="notesRef" :hud="hud" />
    <template v-else>
    <div v-if="error" class="p-2 text-gray-400 text-sm">{{ error }}</div>
    <div v-else-if="!items && loading" class="p-2 text-gray-500 text-sm lg-loading">Loading from Path of Building…</div>
    <div v-else-if="items && !items.length" class="p-2 text-gray-500 text-sm">This build's item set is empty.</div>

    <div v-else-if="items" class="overflow-y-auto min-h-0 p-1">
      <div class="flex items-center gap-x-2 px-1 pb-1 text-xs">
        <span class="text-gray-500">Tick the items you have.</span>
        <button class="ml-auto ui-btn ui-btn-quiet" @click="allMods = !allMods">{{ allMods ? 'Hide mods' : 'Show mods' }}</button>
        <button class="ui-btn ui-btn-quiet" :class="{ 'ui-btn-on': showHelp }" title="What the buttons do" @click="toggleHelp"><i class="fas fa-question" /></button>
      </div>
      <div v-if="showHelp" class="mx-1 mb-1 rounded bg-gray-900 px-2 py-1 text-xs text-gray-400">
        <b class="text-gray-300">Trade</b>: this item on the trade site (uniques: any copy) ·
        <b class="text-gray-300">Upgrade</b>: any base of this kind with at least these values (uniques: better rolls) ·
        <b class="text-gray-300">⋯</b>: copy the name for the in-game market, craft it, stash / vendor search, price check<template v-if="desktop"> (opens over the game)</template>.
      </div>
      <template v-for="group of groups" :key="group.key">
        <div class="px-1 pt-2 pb-px text-xs uppercase tracking-wide text-gray-500">{{ group.label }}</div>
        <div v-for="item of group.items" :key="item.slot"
          class="rounded px-1 py-px hover:bg-gray-800">
          <div class="flex items-center gap-x-2">
            <!-- Deathloom fork (19 Nov): tick when you have this item (or one as good) -->
            <button class="ui-tick shrink-0" :class="{ on: isOwned(item) }"
              :title="isOwned(item) ? 'You have this (click to undo)' : 'Got it: tick when you have this item or one as good'"
              @click="toggleOwned(item)" />
            <button class="flex-1 min-w-0 flex items-baseline gap-x-2 text-left" :class="{ 'opacity-50': isOwned(item) }" @click="toggle(item.slot)">
              <span class="text-gray-500 text-sm shrink-0 w-24 truncate" :title="item.label">{{ item.label }}</span>
              <span class="truncate" :style="{ color: rarityColour(item.rarity) }" :title="itemTitle(item)">
                {{ item.title || item.name }}</span>
              <span v-if="item.title && item.rarity !== 'Unique'" class="text-gray-500 text-sm truncate shrink">{{ item.baseName }}</span>
              <span v-if="defencesOf(item).length" class="ml-auto pl-1 text-gray-400 text-xs whitespace-nowrap shrink-0 tabular-nums"
                :title="defencesOf(item).map(d => `${d.name}: ${d.value}`).join('\n')">{{ defencesOf(item).map(d => `${d.short} ${d.value}`).join(' · ') }}</span>
            </button>
            <div class="flex items-center gap-x-1 shrink-0">
              <span v-if="copiedKey === item.slot" class="text-xs text-green-400">Copied</span>
              <button class="ui-btn" :title="item.rarity === 'Unique' ? 'This unique on the official trade site (any rolls)' : 'This item (its base, all its mods at least these values) on the official trade site'"
                @click="openTrade(item)">Trade</button>
              <button class="ui-btn" :title="item.rarity === 'Unique' ? 'Better rolls: this unique with at least these values' : 'An upgrade: any base of this kind with at least these values'"
                @click="openTrade(item, true)">Upgrade</button>
              <ui-menu :items="rowMenu(item)" align-right title="More for this item" />
            </div>
          </div>
          <div v-if="regexSlot === item.slot" class="my-1 p-1.5 rounded bg-gray-900 text-sm" style="margin-left: 6.5rem;">
            <div class="flex items-center gap-2 mb-1 text-xs text-gray-400">
              <span>Stash / vendor search: tick the lines to look for</span>
              <span class="ml-auto">Match</span>
              <button class="px-1 rounded" :class="regexMatch === 'all' ? 'bg-gray-700 text-gray-100' : 'hover:text-gray-200'" title="Every ticked line must be on the item" @click="regexMatch = 'all'">all</button>
              <button class="px-1 rounded" :class="regexMatch === 'any' ? 'bg-gray-700 text-gray-100' : 'hover:text-gray-200'" title="One of the ticked lines is enough" @click="regexMatch = 'any'">any</button>
            </div>
            <div v-for="p of regexParts" :key="p.key" class="flex items-center gap-2">
              <label class="flex-1 min-w-0 flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" :checked="regexPick[p.key] === true" @change="regexPick = { ...regexPick, [p.key]: !regexPick[p.key] }">
                <span class="truncate" :class="p.kind === 'mod' ? 'text-indigo-300' : 'text-gray-300'" :title="p.regex">{{ p.label }}</span>
              </label>
              <label v-if="p.hasValue" class="shrink-0 flex items-center gap-1 text-xs text-gray-500 cursor-pointer" title="On: this value or higher. Off: any value (shorter)">
                <input type="checkbox" :checked="regexMin[p.key] ?? true" @change="regexMin = { ...regexMin, [p.key]: !(regexMin[p.key] ?? true) }">at least
              </label>
            </div>
            <div class="mt-1 flex items-center gap-2">
              <code class="flex-1 min-w-0 truncate rounded bg-gray-800 px-1" :class="regexResult.tooLong ? 'text-red-400' : 'text-gray-200'" :title="regexResult.text">{{ regexResult.text || 'Tick a line' }}</code>
              <span class="text-xs shrink-0" :class="regexResult.tooLong ? 'text-red-400' : 'text-gray-500'">{{ regexResult.length }}/{{ MAX_LEN }}</span>
              <button class="bg-gray-700 text-gray-300 rounded px-1.5" :disabled="!regexResult.text" title="Copy, then paste it in the stash or vendor search (Ctrl+F, Ctrl+V)"
                @click="copy(regexResult.text, 'rx-' + item.slot)">
                <i v-if="copiedKey === 'rx-' + item.slot" class="fas fa-check text-green-400" /><i v-else class="far fa-copy" /></button>
              <button v-if="!hud" class="bg-gray-700 text-gray-300 rounded px-1.5" :disabled="!regexResult.text || regexResult.tooLong"
                title="Save to Notes → Search strings (you can give it a hotkey there)" @click="saveRegex(item)">
                <i v-if="savedKey === item.slot" class="fas fa-check text-green-400" /><i v-else class="fas fa-save" /></button>
            </div>
            <div v-if="regexResult.tooLong" class="text-xs text-red-400 mt-0.5">Too long for the game (50 characters). Untick a line, untick "at least", or match any.</div>
          </div>
          <div v-if="tradeError[item.slot]" class="text-xs text-red-400" style="padding-left: 6.5rem;">{{ tradeError[item.slot] }}</div>
          <div v-if="isOpen(item.slot) && (item.mods.length || defencesOf(item).length)" class="pb-1 text-sm" style="padding-left: 6.5rem;">
            <div v-for="d of defencesOf(item)" :key="d.name" class="text-gray-300">{{ d.name }}: <span class="text-gray-100">{{ d.value }}</span></div>
            <div v-if="defencesOf(item).length && item.mods.length" class="border-t border-gray-700 my-0.5" />
            <div v-for="(mod, idx) of item.mods" :key="idx" :class="modClass(mod, item.mods, idx)">
              {{ mod.text }}<span v-if="mod.crafted" class="text-gray-500 text-xs"> (crafted)</span><span
                v-if="mod.fractured" class="text-gray-500 text-xs"> (fractured)</span>
            </div>
          </div>
        </div>
      </template>
      <wickerman-card ref="wickRef" />
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
import { requestCraft } from '../craft/craft-request'
import { useCopyFeedback } from './market'
import BuildPicker from './BuildPicker.vue'
import BuildManager from './BuildManager.vue'
import LoadoutEditor from './LoadoutEditor.vue'
import LoadoutChanges from './LoadoutChanges.vue'
import WickermanCard from './WickermanCard.vue'
import UiMenu, { type UiMenuItem } from '../ui/UiMenu.vue'
import BuildSync from './BuildSync.vue'
import BuildImport from './BuildImport.vue'
// Gems, Tree, Tree map and Compare load the first time they are shown (F4)
import type PobGemsPanel from './PobGems.vue'
import type PobTreePanel from './PobTree.vue'
import type PobTreeMapPanel from './PobTreeMap.vue'
import { LazyBuildCompare as BuildCompare, LazyPobGems as PobGems, LazyPobTree as PobTree, LazyPobTreeMap as PobTreeMap } from './LazyPobPanels'
import PobNotes from './PobNotes.vue'
import { notesState, loadNotes, buildLabel } from './build-notes'
import { pobText } from './labels'
import { itemRegexParts, itemRegex, MAX_LEN } from './item-regex'
import { itemDefences, type ItemDefence } from './item-defences'
import { AppConfig, saveConfig, pushHostConfig } from '@/web/Config'
import { GEAR_OWNED_KEY, gearItemId, gearOwnedKey, parseGearOwned, saveShared, toggleGearOwned, type GearOwned } from './build-progress'

// active: the panel is on screen (the overlay widget is shown, or the HUD panel)
// hud: inside the HUD window (Trade / price check are done by the overlay)
// desktop: inside the desktop window (whole panel area; Trade / price check by the overlay too)
const props = defineProps<{ active: boolean, hud?: boolean, desktop?: boolean }>()
const { copiedKey, copy } = useCopyFeedback()

const loading = ref(false)
const error = ref<string | null>(null)
const build = shallowRef<PobBuildInfo | null>(null)
const items = shallowRef<PobGearItem[] | null>(null)
const itemSet = ref('')
const allMods = ref(false)
const opened = ref<Record<string, boolean>>({})
const tradeError = ref<Record<string, string>>({})
type Tab = 'gear' | 'gems' | 'tree' | 'map' | 'notes'
const NOTES_TAB = { key: 'notes' as Tab, label: 'Notes' }
const TABS: Array<{ key: Tab, label: string }> = [{ key: 'gear', label: 'Gear' }, { key: 'gems', label: 'Gems' }, { key: 'tree', label: 'Tree' }]
// the whole tree drawn: only in the desktop window (room for it)
const tabs = computed(() => props.desktop ? [...TABS, { key: 'map' as Tab, label: 'Tree map' }, NOTES_TAB] : [...TABS, NOTES_TAB])
const tab = ref<Tab>('gear')
const showPicker = ref(true)
const showManage = ref(false)
const showCompare = ref(false)
const showSteps = ref(false)
const stepsRef = ref<InstanceType<typeof LoadoutChanges> | null>(null)
const wickRef = ref<InstanceType<typeof WickermanCard> | null>(null)
const showEdit = ref(false)
const HELP_KEY = 'deathloom.gear-help.v1'
const showHelp = ref((() => { try { return localStorage.getItem(HELP_KEY) !== '0' } catch { return true } })())
function toggleHelp () { showHelp.value = !showHelp.value; try { localStorage.setItem(HELP_KEY, showHelp.value ? '1' : '0') } catch {} }
// one menu with labels for everything that used to be a row of icons
const headerMenu = computed<UiMenuItem[]>(() => [
  { label: 'Import a build (PoB code or link)', icon: 'fas fa-file-import', checked: showImport.value, action: () => { showImport.value = !showImport.value } },
  { label: 'Build sharing (GitHub sync)', icon: 'fas fa-cloud', checked: showSync.value, action: () => { showSync.value = !showSync.value } },
  { divider: true },
  { label: 'What changes between stages', icon: 'fas fa-route', checked: showSteps.value, action: () => { showSteps.value = !showSteps.value } },
  ...(props.desktop
    ? [
        { label: 'Compare builds / your character', icon: 'fas fa-balance-scale', checked: showCompare.value, action: () => { showCompare.value = !showCompare.value } },
        { divider: true },
        { label: 'Edit loadouts and gems', icon: 'fas fa-pen', checked: showEdit.value, action: () => { showEdit.value = !showEdit.value } },
        { label: 'Manage builds (rename, delete…)', icon: 'fas fa-folder-open', checked: showManage.value, action: () => { showManage.value = !showManage.value } }
      ]
    : [
        { divider: true },
        // Deathloom fork (overlay review 19 Nov): these need room, so they live in the Orbhoarder window
        { label: 'Compare, edit loadouts, manage builds (Orbhoarder window)', icon: 'fas fa-external-link-alt', action: () => { Host.sendEvent({ name: 'CLIENT->MAIN::user-action', payload: { action: 'open-window-view', view: 'build' } }) } }
      ])
])
const showSync = ref(false)
const showImport = ref(false)
const pickerRef = ref<InstanceType<typeof BuildPicker> | null>(null)
const gemsRef = ref<InstanceType<typeof PobGemsPanel> | null>(null)
const treeRef = ref<InstanceType<typeof PobTreePanel> | null>(null)
const mapRef = ref<InstanceType<typeof PobTreeMapPanel> | null>(null)
const notesRef = ref<InstanceType<typeof PobNotes> | null>(null)
const visible = computed(() => props.active)

// idea 15: when a build has a loot filter, remind which one to use
const hiddenFilterFor = ref('')
const filterReminder = computed(() => {
  const s = notesState.value
  if (!s?.data.filter || tab.value === 'notes' || hiddenFilterFor.value === s.build) return null
  let name = s.data.filter
  try { const u = new URL(name); name = u.hostname + (u.pathname.length > 1 ? '…' : '') } catch {}
  return { build: buildLabel(s.build), name }
})

function setTab (key: Tab) {
  if (tab.value === key) return
  tab.value = key
  if (key === 'gear') request()
}

// The picker loads the build list when the panel opens and after each change
function onBuildChanged (b: PobBuildInfo | null) {
  if (b) build.value = b
  stepsRef.value?.request()
  wickRef.value?.request()
  if (tab.value === 'gear') request()
  // (a panel still loading has no request() yet; it asks on its own when it mounts)
  else if (tab.value === 'gems') gemsRef.value?.request?.()
  else if (tab.value === 'map') mapRef.value?.request?.()
  else if (tab.value === 'notes') notesRef.value?.request()
  else treeRef.value?.request?.()
  // loot filter reminder for the new build (any tab)
  if (tab.value !== 'notes') loadNotes()
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

// Deathloom fork (19 Nov): "got it" ticks per build and slot; a tick counts for
// the item it was set on (if the build's item changes, the tick goes)
// (shared with the Build progress panel, build-progress.ts)
function readOwned (): GearOwned { return parseGearOwned(localStorage.getItem(GEAR_OWNED_KEY)) }
const owned = shallowRef(readOwned())
const onOwned = (e: StorageEvent) => { if (e.key === GEAR_OWNED_KEY) owned.value = readOwned() }
window.addEventListener('storage', onOwned)
onUnmounted(() => { window.removeEventListener('storage', onOwned) })
const ownedKey = computed(() => gearOwnedKey(build.value?.name, itemSet.value))
function isOwned (item: PobGearItem) { return owned.value[ownedKey.value]?.[item.slot] === gearItemId(item) }
function toggleOwned (item: PobGearItem) {
  const all = toggleGearOwned(owned.value, ownedKey.value, item)
  owned.value = all
  saveShared(GEAR_OWNED_KEY, all)
}
function rowMenu (item: PobGearItem): UiMenuItem[] {
  return [
    { label: 'Copy name for the in-game market', icon: 'far fa-copy', hint: `Copies '${item.searchText}': press / in game, then Ctrl+V`, action: () => copy(item.searchText, item.slot) },
    ...(item.rarity === 'Rare' || item.rarity === 'Magic'
      ? [{ label: 'Craft it', icon: 'fas fa-flask', hint: 'Craft tab with this base and mods, and a step-by-step plan', action: () => requestCraft(item) }]
      : []),
    { label: 'Stash / vendor search (regex)', icon: 'fas fa-code', checked: regexSlot.value === item.slot, action: () => toggleRegex(item.slot) },
    { label: props.desktop ? 'Price check (opens over the game)' : 'Price check here', icon: 'fas fa-search-dollar', action: () => priceCheck(item, null) }
  ]
}
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

// defences per item text (cached: the template asks several times per row)
const defCache = new Map<string, ItemDefence[]>()
function defencesOf (item: PobGearItem): ItemDefence[] {
  let d = defCache.get(item.text)
  if (!d) { d = itemDefences(item.text); if (defCache.size > 200) defCache.clear(); defCache.set(item.text, d) }
  return d
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

function openTrade (item: PobGearItem, upgrade = false) {
  tradeError.value = { ...tradeError.value, [item.slot]: '' }
  if (props.hud) {
    // the overlay owns the league list; it opens the trade site
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-gear-action', payload: { action: upgrade ? 'upgrade' : 'trade', text: item.text } })
    return
  }
  const err = openTradeSearch(item.text, upgrade)
  if (err) tradeError.value[item.slot] = err
}

// Regex: stash / vendor search for items like this one (one item at a time)
const regexSlot = ref<string | null>(null)
const regexPick = ref<Record<string, boolean>>({})
const regexMin = ref<Record<string, boolean>>({})
const regexMatch = ref<'all' | 'any'>('all')
const savedKey = ref<string | null>(null)
const regexItem = computed(() => items.value?.find(i => i.slot === regexSlot.value) ?? null)
const regexParts = computed(() => regexItem.value ? itemRegexParts(regexItem.value, regexMin.value) : [])
const regexResult = computed(() => itemRegex(regexParts.value.filter(p => regexPick.value[p.key]), regexMatch.value))
function toggleRegex (slot: string) {
  regexSlot.value = regexSlot.value === slot ? null : slot
  regexPick.value = {}
  regexMin.value = {}
  regexMatch.value = 'all'
}
function saveRegex (item: PobGearItem) {
  const r = regexResult.value
  if (!r.text || r.tooLong) return
  const list = AppConfig().pob?.searchStrings ?? []
  if (!list.some(s => s.text === r.text)) {
    const id = Math.max(0, ...list.map(s => s.id)) + 1
    AppConfig().pob.searchStrings = [...list, { id, name: `${item.label}: ${item.title || item.name}`.slice(0, 40), text: r.text, hotkey: null }]
    saveConfig()
    pushHostConfig()
  }
  savedKey.value = item.slot
  setTimeout(() => { if (savedKey.value === item.slot) savedKey.value = null }, 1500)
}

// Open the normal price check window for this item (stat filters, prices, build impact)
function priceCheck (item: PobGearItem, e: MouseEvent | null) {
  if (props.hud || props.desktop) {
    // main opens it in the overlay and activates the overlay (the overlay owns the price check)
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-gear-action', payload: { action: 'price-check', text: item.text } })
    return
  }
  openPriceCheck(item.text, e ? { x: e.clientX, y: e.clientY } : { x: Math.round(window.innerWidth / 2), y: 120 })
}
</script>
