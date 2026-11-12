<template>
  <!-- Deathloom fork: gems the build wants per socket group, compared with the character -->
  <div class="overflow-y-auto min-h-0 p-1 text-sm">
    <div v-if="error" class="p-1 text-gray-400">{{ error }}</div>
    <div v-else-if="!groups && loading" class="p-1 text-gray-500">Loading from Path of Building…</div>
    <template v-else-if="comparison">
      <div class="flex items-center gap-x-2 px-1 pb-1 text-xs">
        <span v-if="liveError" class="text-gray-500 flex-1">{{ liveError }}</span>
        <span v-else-if="live" class="flex-1" :class="comparison.missingCount || comparison.lowCount ? 'text-yellow-500' : 'text-green-500'">
          <template v-if="comparison.missingCount || comparison.lowCount">
            {{ character }}: {{ comparison.missingCount }} missing, {{ comparison.lowCount }} under level/quality
          </template>
          <template v-else>{{ character }} has every gem the build uses</template>
        </span>
        <button v-if="live || liveError" class="text-gray-500 hover:text-gray-200" title="Fetch the character again (rate-limited)"
          :disabled="loading" @click="request(true)"><i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /> character</button>
      </div>
      <div v-for="sv of view.slots" :key="sv.slot" class="rounded px-1 py-1 mb-1 bg-gray-900">
        <!-- Slot header: item + its sockets (build), character's sockets below -->
        <div class="flex items-center gap-x-2 text-xs">
          <span class="text-gray-300 shrink-0">{{ sv.slot }}</span>
          <span class="text-gray-500 truncate flex-1" :title="sv.item?.baseName">{{ sv.item?.name ?? '' }}</span>
          <span class="text-gray-500 shrink-0" title="Sockets the gems in this slot need (colours, biggest link)">{{ needsText(sv.needs) }}</span>
        </div>
        <div class="flex items-center gap-x-2 text-xs py-px">
          <span class="w-14 shrink-0 text-gray-500">build</span>
          <span class="flex items-center">
            <template v-for="(grp, gi) of parseSockets(sv.item?.sockets)" :key="gi">
              <span v-if="gi" class="w-2" />
              <template v-for="(c, ci) of grp" :key="ci">
                <span v-if="ci" class="inline-block w-1.5 h-0.5 bg-gray-400" />
                <span class="inline-block w-3 h-3 rounded-full border border-black" :style="{ background: socketColour(c) }" :title="socketName(c)" />
              </template>
            </template>
            <span v-if="!sv.item" class="text-gray-600">no item in PoB</span>
          </span>
          <span v-if="sv.item && !sv.buildCheck.ok" class="text-yellow-600">{{ checkText(sv.buildCheck, sv.needs) }}</span>
        </div>
        <div v-if="sv.liveCheck" class="flex items-center gap-x-2 text-xs py-px">
          <span class="w-14 shrink-0 text-gray-500 truncate" :title="sv.liveItem?.name">yours</span>
          <span class="flex items-center">
            <template v-for="(grp, gi) of parseSockets(sv.liveItem?.sockets)" :key="gi">
              <span v-if="gi" class="w-2" />
              <template v-for="(c, ci) of grp" :key="ci">
                <span v-if="ci" class="inline-block w-1.5 h-0.5 bg-gray-400" />
                <span class="inline-block w-3 h-3 rounded-full border border-black" :style="{ background: socketColour(c) }" :title="socketName(c)" />
              </template>
            </template>
            <span v-if="!sv.liveItem" class="text-gray-600">nothing socketed there</span>
          </span>
          <span v-if="sv.liveItem" :class="sv.liveCheck.ok ? 'text-green-500' : 'text-red-400'">
            {{ sv.liveCheck.ok ? 'fits' : checkText(sv.liveCheck, sv.needs) }}</span>
        </div>
        <!-- Gems, one block per link group -->
        <div v-for="row of sv.rows" :key="row.group.index" class="mt-1 pl-1 border-l-2"
          :class="row.group.main ? 'border-yellow-600' : 'border-gray-700'">
          <div v-if="sv.rows.length > 1 || row.group.main || row.liveSlot || (live && !row.matched)" class="flex items-baseline gap-x-2 text-xs text-gray-500">
            <span class="text-gray-400">{{ linkTitle(row) }}</span>
            <span v-if="row.group.main" class="text-yellow-500">main skill</span>
            <span v-if="row.liveSlot" class="ml-auto">yours: in {{ row.liveSlot }}</span>
            <span v-else-if="live && !row.matched" class="ml-auto text-red-400">not on character</span>
          </div>
          <div v-for="(g, idx) of row.gems" :key="idx" class="flex items-baseline gap-x-2" :class="{ hidden: !g.gem.enabled }">
            <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0 self-center" :style="{ background: gemColour(g.gem.colour) }" />
            <span class="flex-1 truncate" :class="{ 'text-gray-400': g.gem.support }" :title="gemTitle(g.gem)">{{ g.gem.name }}</span>
            <span class="text-gray-400 shrink-0" title="Level / quality the build uses">{{ g.gem.level ?? '?' }}/{{ g.gem.quality ?? 0 }}</span>
            <span class="w-28 text-right shrink-0 text-xs" :class="statusClass(g.status)" :title="statusTitle(g)">{{ statusText(g) }}</span>
          </div>
          <div v-if="row.extra.length" class="text-xs text-gray-500 pt-px">
            You also have: {{ row.extra.map(g => `${g.name} ${g.level ?? '?'}/${g.quality ?? 0}`).join(', ') }}
          </div>
        </div>
      </div>
      <!-- Item-granted skills (e.g. a unique's skill): nothing to socket -->
      <div v-if="view.granted.length" class="px-1 pb-1 text-xs text-gray-500">
        From items: {{ view.granted.map(r => r.group.gems.map(g => g.name).join(', ')).join(' · ') }}
      </div>
      <div v-if="view.hidden.length" class="px-1 pb-1 text-xs text-gray-500">
        <button class="hover:text-gray-200" @click="showHidden = !showHidden">
          <i class="fas" :class="showHidden ? 'fa-caret-down' : 'fa-caret-right'" />
          {{ view.hidden.length }} group{{ view.hidden.length > 1 ? 's' : '' }} only for PoB's calculations or switched off
        </button>
        <div v-if="showHidden">
          <div v-for="row of view.hidden" :key="row.group.index" class="text-gray-600">
            {{ pobText(row.group.label) || row.group.gems[0]?.name }}{{ row.group.slot ? ` (${row.group.slot}, off)` : '' }}:
            {{ row.group.gems.map(g => g.name).join(', ') }}
          </div>
        </div>
      </div>
      <div v-if="comparison.unmatched.length" class="px-1 pt-1 text-xs text-gray-500">
        On the character but not in the build:
        <div v-for="g of comparison.unmatched" :key="g.index">
          {{ g.slot ?? 'No slot' }}: {{ g.gems.map(x => x.name).join(', ') }}
        </div>
      </div>
      <div class="px-1 pt-1 text-xs text-gray-600">
        Grouped by gear piece. Each bar on the left is one link group: link those gems together.
        Sockets: build = the item in PoB, yours = your character's. Level/quality as set in PoB.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import type { PobGem, PobSocketGroup, PobSocketedItem } from '@ipc/types'
import { pobText } from './labels'
import { Host } from '@/web/background/IPC'
import { compareGems, bySlot, parseSockets, needsText, checkText, type GemRow, type GemStatus, type GroupRow } from './gems'

const loading = ref(false)
const showHidden = ref(false)
const items = shallowRef<PobSocketedItem[]>([])
const liveItems = shallowRef<PobSocketedItem[] | undefined>(undefined)
const error = ref<string | null>(null)
const groups = shallowRef<PobSocketGroup[] | null>(null)
const live = shallowRef<PobSocketGroup[] | undefined>(undefined)
const character = ref('')
const liveError = ref<string | null>(null)
let lastRequestId = 0

const listener = Host.onEvent('MAIN->CLIENT::pob-gems', (e) => {
  if (e.requestId !== lastRequestId) return
  loading.value = false
  if (!e.ok) {
    error.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '')
    return
  }
  error.value = null
  groups.value = e.groups ?? []
  live.value = e.live
  items.value = e.items ?? []
  liveItems.value = e.liveItems
  character.value = e.character ?? 'Character'
  liveError.value = e.liveError ?? null
})
const characterListener = Host.onEvent('MAIN->CLIENT::pob-character', () => { request() })
onUnmounted(() => { listener.abort(); characterListener.abort() })

function request (refreshGear = false) {
  loading.value = true
  lastRequestId += 1
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-gems',
    payload: { requestId: lastRequestId, refreshGear }
  })
}
defineExpose({ request })
request()

const comparison = computed(() => groups.value ? compareGems(groups.value, live.value) : null)
const view = computed(() => {
  const empty = { slots: [], hidden: [], granted: [] as GroupRow[] }
  if (!comparison.value) return empty
  const granted = comparison.value.groups.filter(r => r.group.source && r.group.enabled)
  const rest = { ...comparison.value, groups: comparison.value.groups.filter(r => !(r.group.source && r.group.enabled)) }
  return { ...bySlot(rest, items.value, liveItems.value), granted }
})

function linkTitle (row: GroupRow) {
  const active = row.group.gems.filter(g => g.enabled && !g.support).map(g => g.name)
  const n = row.group.gems.filter(g => g.enabled).length
  return `${pobText(row.group.label) || active.join(' + ') || 'Supports'} · ${n}L`
}

function socketColour (c: string) {
  return ({ R: '#c0392b', G: '#27ae60', B: '#2e86de', W: '#eeeeee', A: '#444', D: '#888' } as Record<string, string>)[c] ?? '#888'
}

function socketName (c: string) {
  return ({ R: 'Red', G: 'Green', B: 'Blue', W: 'White', A: 'Abyssal', D: 'Delve' } as Record<string, string>)[c] ?? c
}

function gemTitle (gem: PobGem) {
  const kind = gem.support ? 'Support gem' : 'Skill gem'
  return gem.enabled ? kind : `${kind}, switched off in PoB: the build doesn't count it`
}

function statusTitle (g: GemRow) {
  switch (g.status) {
    case 'ok': return g.have?.slot ? `Your character has it, but in ${g.have.slot}` : 'Your character has it at this level/quality or better'
    case 'low': return `Your character has it at ${g.have?.level ?? '?'}/${g.have?.quality ?? 0}, lower than the build`
    case 'missing': return "Your character doesn't have this gem socketed"
    default: return ''
  }
}

function gemColour (c?: number) {
  switch (c) {
    case 1: return '#c0392b'
    case 2: return '#27ae60'
    case 3: return '#2e86de'
    default: return '#bbb'
  }
}

function statusClass (s: GemStatus) {
  return { ok: 'text-green-500', low: 'text-yellow-500', missing: 'text-red-400', unknown: 'text-gray-600' }[s]
}

function statusText (g: GemRow) {
  switch (g.status) {
    case 'ok': return g.have?.slot ? `ok (in ${g.have.slot})` : 'ok'
    case 'low': return `have ${g.have?.level ?? '?'}/${g.have?.quality ?? 0}${g.have?.slot ? ' (' + g.have.slot + ')' : ''}`
    case 'missing': return 'missing'
    default: return ''
  }
}
</script>
