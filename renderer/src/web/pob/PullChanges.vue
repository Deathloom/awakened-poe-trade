<template>
  <!-- Deathloom fork (Q22): build diff on Pull. Friends' builds the last Pulls
       changed, and what changed since your copy (stats, gear, gems, tree). Read
       from the files on this PC; nothing is sent anywhere. -->
  <div class="rounded bg-gray-900 px-2 py-1 text-xs flex flex-col gap-y-0.5">
    <div class="flex items-center gap-x-2">
      <span class="text-gray-300"><i class="fas fa-code-branch mr-1" />Friends' builds that changed</span>
      <button class="ui-btn ui-btn-quiet ml-auto" title="Forget this list (the builds stay)" @click="clear">Clear</button>
    </div>
    <div v-for="c of shown" :key="c.id">
      <div class="flex items-center gap-x-2">
        <span class="text-gray-400 shrink-0">{{ c.player }}</span>
        <span class="truncate text-gray-200" :title="c.rel">{{ c.name }}</span>
        <span v-if="c.kind === 'new'" class="text-green-400 shrink-0">new</span>
        <span class="ml-auto text-gray-500 shrink-0" :title="new Date(c.time).toLocaleString()">{{ ago(c.time) }}</span>
        <button v-if="c.kind === 'changed'" class="ui-btn ui-btn-quiet shrink-0" @click="toggle(c.id)">
          {{ openId === c.id ? 'Hide' : 'What changed' }}</button>
      </div>
      <div v-if="openId === c.id" class="pl-2 border-l border-gray-700 mb-1">
        <div v-if="busy" class="text-gray-500"><i class="fas fa-spinner fa-spin mr-1" />Reading…</div>
        <div v-else-if="error" class="text-red-400">{{ error }}</div>
        <template v-else-if="lines">
          <div v-if="who" class="text-gray-500">{{ who }}</div>
          <div v-if="!lines.length" class="text-gray-500">No stat, gear, gem or passive changes (notes or settings only).</div>
          <template v-for="s of SECTIONS" :key="s.id">
            <div v-if="lines.some(l => l.section === s.id)" class="mt-0.5">
              <span class="text-gray-500">{{ s.label }}</span>
              <div v-for="(l, i) of lines.filter(l => l.section === s.id).slice(0, 12)" :key="i" class="truncate"
                :class="l.tone === 'up' ? 'text-green-400' : l.tone === 'down' ? 'text-red-400' : 'text-gray-300'" :title="l.text">{{ l.text }}</div>
            </div>
          </template>
        </template>
      </div>
    </div>
    <div v-if="changes.length > shown.length" class="text-gray-500">and {{ changes.length - shown.length }} more</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import type { PullChange, PobBuildSummary } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { compareBuilds, changeLines, type ChangeLine } from './compare'

const props = defineProps<{ changes: PullChange[] }>()
const SECTIONS = [
  { id: 'stats', label: 'Stats (old → new)' },
  { id: 'gear', label: 'Gear' },
  { id: 'gems', label: 'Gems' },
  { id: 'tree', label: 'Passive tree' }
] as const

const shown = computed(() => props.changes.slice(0, 10))
const openId = ref<string | null>(null)
const busy = ref(false)
const error = ref('')
const lines = shallowRef<ChangeLine[] | null>(null)
const who = ref('')

let reqId = 700000 + Math.floor(Math.random() * 100000)
const off = Host.onEvent('MAIN->CLIENT::pob-pull-diff', (e) => {
  if (e.requestId !== reqId) return
  busy.value = false
  if (!e.ok || !e.after) { error.value = e.error ?? 'Something went wrong.'; return }
  if (!e.before) { lines.value = []; return }
  lines.value = changeLines(compareBuilds(e.before, e.after))
  who.value = describe(e.before, e.after)
})
onUnmounted(() => { off.abort() })

function describe (a: PobBuildSummary, b: PobBuildSummary): string {
  const one = (s: PobBuildSummary) => [s.level != null ? `level ${s.level}` : '', s.ascendancy || s.className || '', s.mainSkill || ''].filter(Boolean).join(' ')
  const x = one(a)
  const y = one(b)
  return x === y ? y : `${x || '?'} → ${y || '?'}`
}

function toggle (id: string) {
  if (openId.value === id) { openId.value = null; return }
  openId.value = id
  busy.value = true
  error.value = ''
  lines.value = null
  who.value = ''
  reqId += 1
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-pull-diff', payload: { requestId: reqId, id } })
}

function clear () {
  openId.value = null
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-sync', payload: { op: 'clearChanges' } })
}

const now = Date.now()
function ago (t: number) {
  const m = Math.max(0, Math.round((now - t) / 60_000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.floor(m / 60)} h ago`
  return `${Math.floor(m / 1440)} d ago`
}
</script>
