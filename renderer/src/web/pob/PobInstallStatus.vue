<template>
  <!-- Deathloom fork: Loot Goblin's own Path of Building (downloaded on first run) -->
  <div v-if="st && (!compact || st.state !== 'ready')" class="p-2 rounded bg-gray-900">
    <div class="flex items-center gap-2 mb-1">
      <i class="fas" :class="icon" />
      <span>{{ title }}</span>
      <button v-if="st.state === 'missing' || st.state === 'error'" class="btn ml-auto" @click="send('start')">
        {{ st.state === 'error' ? 'Try again' : 'Download now' }}</button>
      <button v-else-if="!compact && st.state === 'ready'" class="btn ml-auto" title="Checks every file and fixes damaged or missing ones"
        @click="send('repair')">Check files</button>
    </div>
    <template v-if="busy">
      <div class="h-2 rounded bg-gray-700 overflow-hidden mb-1">
        <div class="h-full bg-blue-500 transition-all" :style="{ width: pct + '%' }" />
      </div>
      <div class="text-gray-400 text-sm">{{ st.message || detail }}</div>
    </template>
    <div v-else-if="st.state === 'error'" class="text-red-400 text-sm break-all">{{ st.error }}</div>
    <div v-else-if="st.state === 'missing'" class="text-gray-400 text-sm">
      Needed for build impact, the build panel and build sharing. Downloads once (a few hundred MB), then keeps itself up to date.</div>
    <div v-else-if="!compact" class="text-gray-500 text-sm break-all">{{ st.dir }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { PobInstallState } from '@ipc/types'
import { Host } from '@/web/background/IPC'

defineProps<{ compact?: boolean }>()

const st = ref<PobInstallState | null>(null)
const listener = Host.onEvent('MAIN->CLIENT::pob-install-state', (e) => { st.value = e })
onUnmounted(() => { listener.abort() })
send('status')

function send (op: 'status' | 'start' | 'repair') {
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-install', payload: { op } })
}

const busy = computed(() => ['installing', 'checking', 'updating'].includes(st.value?.state ?? ''))
const pct = computed(() => {
  const s = st.value
  return s && s.total ? Math.min(100, Math.round(100 * s.done / s.total)) : 0
})
const detail = computed(() => {
  const s = st.value
  if (!s?.total) return 'Starting…'
  return `${s.done} of ${s.total} files · ${(s.bytes / 1048576).toFixed(0)} MB`
})
const title = computed(() => {
  switch (st.value?.state) {
    case 'installing': return `Downloading Path of Building… ${pct.value}%`
    case 'checking': return 'Path of Building: checking for an update…'
    case 'updating': return `Updating Path of Building… ${pct.value}%`
    case 'error': return 'Path of Building couldn\'t be downloaded'
    case 'missing': return 'Path of Building isn\'t downloaded yet'
    default: return `Path of Building ${st.value?.version ?? ''} is ready`
  }
})
const icon = computed(() => {
  switch (st.value?.state) {
    case 'ready': return 'fa-check text-green-500'
    case 'error': return 'fa-times text-red-400'
    case 'missing': return 'fa-download text-yellow-500'
    default: return 'fa-spinner fa-spin text-blue-400'
  }
})
</script>
