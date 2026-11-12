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
      <div v-for="row of comparison.groups" :key="row.group.index"
        class="rounded px-1 py-1 mb-1 bg-gray-900" :class="{ 'opacity-50': !row.group.enabled }">
        <div class="flex items-baseline gap-x-2 text-xs text-gray-500">
          <span class="text-gray-300">{{ groupTitle(row.group) }}</span>
          <span v-if="row.group.main" class="text-yellow-500">main skill</span>
          <span v-if="row.group.source" title="Granted by an item, not a socketed gem">from item</span>
          <span v-if="!row.group.enabled" title="This socket group is switched off in PoB, so the build doesn't count it">disabled in PoB</span>
          <span v-if="row.liveSlot" class="ml-auto">character: {{ row.liveSlot }}</span>
          <span v-else-if="live && !row.matched && !row.group.source" class="ml-auto text-red-400">not on character</span>
        </div>
        <div v-for="(g, idx) of row.gems" :key="idx" class="flex items-baseline gap-x-2">
          <i class="fas fa-circle text-xs shrink-0" :style="{ color: gemColour(g.gem.colour) }" />
          <span class="flex-1 truncate" :class="{ 'text-gray-400': g.gem.support, 'line-through text-gray-600': !g.gem.enabled }"
            :title="gemTitle(g.gem)">{{ g.gem.name }}</span>
          <span class="text-gray-400 shrink-0" title="Level / quality the build uses">{{ g.gem.level ?? '?' }}/{{ g.gem.quality ?? 0 }}</span>
          <span class="w-28 text-right shrink-0 text-xs" :class="statusClass(g.status)" :title="statusTitle(g)">{{ statusText(g) }}</span>
        </div>
        <div v-if="row.extra.length" class="text-xs text-gray-500 pt-px">
          Character also has: {{ row.extra.map(g => `${g.name} ${g.level ?? '?'}/${g.quality ?? 0}`).join(', ') }}
        </div>
      </div>
      <div v-if="comparison.unmatched.length" class="px-1 pt-1 text-xs text-gray-500">
        On the character but not in the build:
        <div v-for="g of comparison.unmatched" :key="g.index">
          {{ g.slot ?? 'No slot' }}: {{ g.gems.map(x => x.name).join(', ') }}
        </div>
      </div>
      <div class="px-1 pt-1 text-xs text-gray-600">
        Level/quality as set in PoB. Gems are compared by name, in any socket group.
        <span class="line-through">Struck through</span> = gem switched off in PoB (not counted by the build).
        Faded group = whole group switched off. Hover for details.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import type { PobGem, PobSocketGroup } from '@ipc/types'
import { pobText } from './labels'
import { Host } from '@/web/background/IPC'
import { compareGems, type GemRow, type GemStatus } from './gems'

const loading = ref(false)
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
  character.value = e.character ?? 'Character'
  liveError.value = e.liveError ?? null
})
onUnmounted(() => { listener.abort() })

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

function groupTitle (g: PobSocketGroup) {
  const active = g.gems.find(x => !x.support)?.name
  return [pobText(g.label) || active || 'Group', g.slot].filter(Boolean).join(' · ')
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
