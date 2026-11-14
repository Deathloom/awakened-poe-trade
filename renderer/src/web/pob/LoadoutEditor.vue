<template>
  <!-- Deathloom fork: edit the active build's loadouts in the Loot Goblin window.
       Path of Building makes the changes (like its own buttons); the build file
       is saved (old copy in "Build backups") and synced like any save. -->
  <div class="px-2 py-1 bg-gray-800 text-sm flex flex-col gap-y-2 max-h-[32rem] overflow-y-auto">
    <div class="flex items-center gap-x-2">
      <span class="text-gray-400">Edit loadouts</span>
      <span v-if="busy" class="text-xs text-gray-500"><i class="fas fa-circle-notch fa-spin mr-1" />Saving…</span>
      <span v-else-if="saved" class="text-xs text-green-400">Saved</span>
      <button class="ml-auto text-gray-500 hover:text-gray-200" title="Reload" :disabled="busy" @click="load"><i class="fas fa-sync-alt" /></button>
    </div>
    <div v-if="error" class="text-red-400">{{ error }}</div>
    <div class="text-xs text-gray-500">Close this build in Path of Building first (it would overwrite these changes when you save there). The old file is kept in "Build backups" next to your builds folder.</div>

    <!-- new loadout from the one picked above -->
    <div class="flex items-center gap-x-2">
      <input v-model="newName" class="flex-1 bg-gray-900 rounded px-1" placeholder="New loadout name, e.g. Level 30 or Mapping">
      <button class="px-2 rounded bg-gray-600 hover:bg-gray-500 disabled:opacity-40" :disabled="busy || !newName.trim()"
        title="Copies the picked tree, item set and skill set under this name (PoB shows them as one loadout)"
        @click="send([{ op: 'newLoadout', title: newName.trim() }]); newName = ''"><i class="fas fa-plus mr-1" />New loadout</button>
    </div>

    <!-- sets -->
    <div v-for="kind of KINDS" :key="kind.key">
      <div class="text-xs text-gray-500">{{ kind.label }}</div>
      <div v-for="set of (loadouts?.[kind.list] ?? [])" :key="set.id" class="flex items-center gap-x-2 pl-2 rounded hover:bg-gray-700">
        <template v-if="renaming === `${kind.key}:${set.id}`">
          <input v-model="renameText" class="flex-1 bg-gray-900 rounded px-1"
            @keydown.enter="send([{ op: 'renameSet', kind: kind.key, id: set.id, title: renameText }]); renaming = null" @keydown.esc="renaming = null">
          <button class="px-2 rounded bg-gray-600" @click="send([{ op: 'renameSet', kind: kind.key, id: set.id, title: renameText }]); renaming = null">Rename</button>
        </template>
        <template v-else>
          <span class="flex-1 truncate" :class="set.id === activeId(kind.key) ? 'text-yellow-300' : 'text-gray-200'">{{ pobText(set.title) || 'Default' }}</span>
          <button class="text-gray-500 hover:text-gray-200" title="Rename" :disabled="busy" @click="renaming = `${kind.key}:${set.id}`; renameText = pobText(set.title)"><i class="fas fa-i-cursor" /></button>
          <button class="text-gray-500 hover:text-gray-200" title="Copy" :disabled="busy" @click="send([{ op: 'copySet', kind: kind.key, id: set.id, title: `${pobText(set.title) || 'Default'} (copy)` }])"><i class="fas fa-clone" /></button>
          <button v-if="confirmDelete !== `${kind.key}:${set.id}`" class="text-gray-500 hover:text-red-400" title="Delete"
            :disabled="busy || (loadouts?.[kind.list].length ?? 0) < 2" @click="confirmDelete = `${kind.key}:${set.id}`"><i class="fas fa-trash" /></button>
          <button v-else class="px-1 rounded bg-red-700 text-xs" @click="send([{ op: 'deleteSet', kind: kind.key, id: set.id }]); confirmDelete = null">Delete?</button>
        </template>
      </div>
    </div>

    <!-- gems of the picked skill set -->
    <div>
      <div class="text-xs text-gray-500">Gems ({{ skillSetTitle }})</div>
      <div v-for="g of groups" :key="g.index" class="pl-2 py-px">
        <label class="flex items-center gap-x-2 text-xs text-gray-400">
          <input type="checkbox" :checked="g.enabled" :disabled="busy" @change="send([{ op: 'group', group: g.index, enabled: !g.enabled }])">
          {{ g.label || g.slot || `Group ${g.index}` }}
        </label>
        <div v-for="gem of g.gems" :key="gem.index ?? gem.name" class="flex items-center gap-x-2 pl-5 text-xs">
          <input type="checkbox" :checked="gem.enabled" :disabled="busy || gem.index == null"
            @change="send([{ op: 'gem', group: g.index, gem: gem.index!, enabled: !gem.enabled }])">
          <span class="flex-1 truncate" :class="gem.enabled ? 'text-gray-200' : 'text-gray-500 line-through'">{{ gem.name }}</span>
          <span class="text-gray-500">L</span>
          <input type="number" min="1" max="40" :value="gem.level" :disabled="busy || gem.index == null" class="w-12 bg-gray-900 rounded px-1"
            @change="e => setGem(g.index, gem.index, 'level', e)">
          <span class="text-gray-500">Q</span>
          <input type="number" min="0" max="100" :value="gem.quality ?? 0" :disabled="busy || gem.index == null" class="w-12 bg-gray-900 rounded px-1"
            @change="e => setGem(g.index, gem.index, 'quality', e)">
        </div>
      </div>
      <div v-if="!groups.length" class="pl-2 text-xs text-gray-500">No gems in this skill set.</div>
    </div>
    <div class="text-xs text-gray-500">Passives: open the Tree map tab and turn on <i class="fas fa-pen" /> Edit, then click a passive to take or refund it.</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import type { PobEditOp, PobLoadouts, PobSocketGroup } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { pobText } from './labels'

const emit = defineEmits<{ (e: 'changed'): void }>()

const KINDS = [
  { key: 'tree', label: 'Passive trees', list: 'trees' },
  { key: 'items', label: 'Item sets', list: 'itemSets' },
  { key: 'skills', label: 'Skill sets', list: 'skillSets' }
] as const

const loadouts = shallowRef<PobLoadouts | null>(null)
const groups = shallowRef<PobSocketGroup[]>([])
const busy = ref(false)
const saved = ref(false)
const error = ref('')
const newName = ref('')
const renaming = ref<string | null>(null)
const renameText = ref('')
const confirmDelete = ref<string | null>(null)

function activeId (kind: 'tree' | 'items' | 'skills') {
  const a = loadouts.value?.active
  return kind === 'tree' ? a?.spec : kind === 'items' ? a?.itemSet : a?.skillSet
}
const skillSetTitle = computed(() => pobText(loadouts.value?.skillSets.find(s => s.id === loadouts.value?.active.skillSet)?.title ?? '') || 'Default')

let reqId = 50_000
let buildsId = 0
let gemsId = 0
let editId = 0
const l1 = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => {
  if (e.requestId !== buildsId) return
  if (e.ok) loadouts.value = e.loadouts ?? null
  else error.value = e.error ?? 'Unknown error'
})
const l2 = Host.onEvent('MAIN->CLIENT::pob-gems', (e) => {
  if (e.requestId !== gemsId) return
  if (e.ok) groups.value = e.groups ?? []
})
const l3 = Host.onEvent('MAIN->CLIENT::pob-edit', (e) => {
  if (e.requestId !== editId) return
  busy.value = false
  if (!e.ok) { error.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, ''); return }
  error.value = ''
  saved.value = true
  setTimeout(() => { saved.value = false }, 2500)
  if (e.loadouts) loadouts.value = e.loadouts
  requestGems()
  emit('changed')
})
onUnmounted(() => { l1.abort(); l2.abort(); l3.abort() })

function requestGems () {
  gemsId = ++reqId
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-gems', payload: { requestId: gemsId } })
}
function load () {
  buildsId = ++reqId
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: buildsId } })
  requestGems()
}
load()
defineExpose({ load })

function send (ops: PobEditOp[]) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  editId = ++reqId
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-edit', payload: { requestId: editId, ops } })
}

function setGem (group: number, gem: number | undefined, field: 'level' | 'quality', e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  if (gem == null || !Number.isFinite(v)) return
  send([{ op: 'gem', group, gem, [field]: v }])
}
</script>
