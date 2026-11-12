<template>
  <!-- Deathloom fork: the build's passive tree (keystones, ascendancy, notables, masteries) vs the character's -->
  <div class="overflow-y-auto min-h-0 p-1 text-sm">
    <div v-if="error" class="p-1 text-gray-400">{{ error }}</div>
    <div v-else-if="!tree && loading" class="p-1 text-gray-500">Loading from Path of Building…</div>
    <template v-else-if="tree && comparison">
      <div class="flex items-center gap-x-2 px-1 pb-1 text-xs">
        <span class="text-gray-300">{{ classText(tree) }}</span>
        <span class="text-gray-500">{{ tree.points }} points · {{ tree.ascendancyPoints }} ascendancy</span>
        <span class="flex-1" />
        <button v-if="live || liveError" class="text-gray-500 hover:text-gray-200" title="Fetch the character again (rate-limited)"
          :disabled="loading" @click="request(true)"><i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }" /> character</button>
      </div>
      <div v-if="liveError" class="px-1 pb-1 text-xs text-gray-500">{{ liveError }}</div>
      <div v-else-if="live" class="px-1 pb-1 text-xs" :class="comparison.missingCount ? 'text-yellow-500' : 'text-green-500'">
        <template v-if="comparison.missingCount">
          {{ character }}: {{ comparison.missingCount }} to get<template v-if="comparison.extraCount">, {{ comparison.extraCount }} not in the build</template>
        </template>
        <template v-else>{{ character }} has everything the build takes</template>
        <span class="text-gray-500"> · {{ live.points }} points{{ pointsText }}</span>
      </div>
      <div v-for="sec of comparison.sections" :key="sec.type" class="rounded px-1 py-1 mb-1 bg-gray-900">
        <div class="text-xs text-gray-400 pb-px">{{ sec.label }} ({{ sec.rows.reduce((n, r) => n + r.count, 0) }})</div>
        <div v-for="row of sec.rows" :key="row.node.name" class="flex items-baseline gap-x-2">
          <span class="flex-1 min-w-0 truncate" :class="nameClass(sec.type)" :title="rowTitle(row)">
            {{ row.node.name }}<span v-if="row.count > 1" class="text-gray-500"> ×{{ row.count }}</span>
            <span v-if="row.node.cluster" class="text-gray-600 text-xs" title="From a cluster jewel"> cluster</span>
          </span>
          <span class="w-24 text-right shrink-0 text-xs whitespace-nowrap" :class="statusClass(row)">{{ statusText(row) }}</span>
        </div>
        <div v-if="sec.type === 'Mastery'" class="text-xs text-gray-600">Hover a mastery for its effect.</div>
        <div v-if="sec.extra.length" class="text-xs text-gray-500 pt-px">
          Not in the build: {{ sec.extra.map(e => e.count > 1 ? `${e.node.name} ×${e.count}` : e.node.name).join(', ') }}
        </div>
      </div>
      <div class="px-1 pt-1 text-xs text-gray-600">
        Tree of the loadout picked above. Small passives are only counted in the points.
        Compared by name; masteries also by the chosen effect.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import type { PobTreeNode, PobTreeSummary } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { compareTrees, type TreeRow } from './tree'

const loading = ref(false)
const error = ref<string | null>(null)
const tree = shallowRef<PobTreeSummary | null>(null)
const live = shallowRef<PobTreeSummary | undefined>(undefined)
const character = ref('')
const liveError = ref<string | null>(null)
let lastRequestId = 0

const listener = Host.onEvent('MAIN->CLIENT::pob-tree', (e) => {
  if (e.requestId !== lastRequestId) return
  loading.value = false
  if (!e.ok) {
    error.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '')
    return
  }
  error.value = null
  tree.value = e.tree ?? null
  live.value = e.live
  character.value = e.character ?? 'Character'
  liveError.value = e.liveError ?? null
})
const characterListener = Host.onEvent('MAIN->CLIENT::pob-character', () => { request() })
onUnmounted(() => { listener.abort(); characterListener.abort() })

function request (refreshGear = false) {
  loading.value = true
  lastRequestId += 1
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-tree',
    payload: { requestId: lastRequestId, refreshGear }
  })
}
defineExpose({ request })
request()

const comparison = computed(() => tree.value ? compareTrees(tree.value, live.value) : null)

const pointsText = computed(() => {
  const d = comparison.value?.pointsDiff
  if (d === undefined || d === 0) return ''
  return d < 0 ? ` (build uses ${-d} more)` : ` (${d} more than the build)`
})

function classText (t: PobTreeSummary) {
  return t.ascendancy ?? t.className ?? ''
}

function nameClass (type: PobTreeNode['type']) {
  return { Keystone: 'text-yellow-300', Ascendancy: 'text-sky-300', Notable: 'text-gray-200', Mastery: 'text-purple-300', Socket: 'text-gray-400' }[type]
}

function rowTitle (row: TreeRow) {
  const parts = [row.node.name]
  if (row.node.effect) parts.push(`Build: ${row.node.effect}`)
  if (row.liveEffect) parts.push(`Yours: ${row.liveEffect}`)
  return parts.join('\n')
}

function statusClass (row: TreeRow) {
  return { 'ok': 'text-green-500', 'missing': 'text-red-400', 'other-effect': 'text-yellow-500', 'unknown': 'text-gray-600' }[row.status]
}

function statusText (row: TreeRow) {
  return { 'ok': 'ok', 'missing': 'missing', 'other-effect': 'other effect', 'unknown': '' }[row.status]
}
</script>
