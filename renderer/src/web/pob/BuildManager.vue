<template>
  <!-- Deathloom fork: manage your builds (Loot Goblin window): rename, move to a
       folder, duplicate, delete. Auto sync pushes the change; a deleted build is
       deleted on GitHub too and kept in "Deleted builds" next to your builds folder. -->
  <div class="px-2 py-1 bg-gray-800 text-sm flex flex-col gap-y-1 max-h-96 overflow-y-auto">
    <div class="flex items-center gap-x-2">
      <span class="text-gray-400">Manage builds</span>
      <input v-model="filter" type="text" placeholder="Filter…" class="bg-gray-900 rounded px-1 w-40">
      <button class="ml-auto text-gray-500 hover:text-gray-200" title="Reload" :disabled="busy" @click="load"><i class="fas fa-sync-alt" :class="{ 'fa-spin': busy }" /></button>
    </div>
    <div v-if="error" class="text-red-400">{{ error }}</div>
    <div v-if="notOwn" class="text-gray-500">You're looking at {{ list?.player }}'s builds. Switch Player back to yourself to manage your own.</div>
    <template v-else>
      <div v-for="f of folders" :key="f.name">
        <div class="text-xs text-gray-500 mt-1"><i class="fas fa-folder mr-1" />{{ f.name || 'Top of your folder' }}</div>
        <div v-for="b of f.builds" :key="b.path" class="flex items-center gap-x-2 pl-3 py-px rounded hover:bg-gray-700">
          <template v-if="editing === b.path && mode === 'rename'">
            <input ref="editEl" v-model="editText" class="flex-1 bg-gray-900 rounded px-1" @keydown.enter="apply(b.path)" @keydown.esc="editing = null">
            <button class="px-2 rounded bg-gray-600 hover:bg-gray-500" @click="apply(b.path)">Rename</button>
            <button class="text-gray-500 hover:text-gray-200" @click="editing = null">Cancel</button>
          </template>
          <template v-else-if="editing === b.path && mode === 'move'">
            <span class="truncate">{{ b.label }} →</span>
            <input v-model="editText" list="lg-build-folders" placeholder="Folder, e.g. 3.30/Witch (empty = top)"
              class="flex-1 bg-gray-900 rounded px-1" @keydown.enter="apply(b.path)" @keydown.esc="editing = null">
            <button class="px-2 rounded bg-gray-600 hover:bg-gray-500" @click="apply(b.path)">Move</button>
            <button class="text-gray-500 hover:text-gray-200" @click="editing = null">Cancel</button>
          </template>
          <template v-else-if="editing === b.path && mode === 'delete'">
            <span class="flex-1 truncate text-red-300">Delete {{ b.label }}? It's deleted on GitHub too; a copy stays in "Deleted builds".</span>
            <button class="px-2 rounded bg-red-700 hover:bg-red-600" @click="apply(b.path)">Delete</button>
            <button class="text-gray-500 hover:text-gray-200" @click="editing = null">Cancel</button>
          </template>
          <template v-else>
            <span class="flex-1 truncate" :class="b.path === list?.active ? 'text-yellow-300' : 'text-gray-200'"
              :title="b.path === list?.active ? 'Active build' : b.path">{{ b.label }}</span>
            <button class="text-gray-500 hover:text-gray-200" title="Rename" :disabled="busy" @click="start(b, 'rename')"><i class="fas fa-i-cursor" /></button>
            <button class="text-gray-500 hover:text-gray-200" title="Move to a folder" :disabled="busy" @click="start(b, 'move')"><i class="fas fa-folder-open" /></button>
            <button class="text-gray-500 hover:text-gray-200" title="Duplicate" :disabled="busy" @click="run('duplicate', b.path)"><i class="fas fa-clone" /></button>
            <button class="text-gray-500 hover:text-red-400" title="Delete" :disabled="busy" @click="start(b, 'delete')"><i class="fas fa-trash" /></button>
          </template>
        </div>
      </div>
      <datalist id="lg-build-folders">
        <option v-for="f of allFolders" :key="f" :value="f" />
      </datalist>
      <div v-if="list && !list.builds.length" class="text-gray-500">No builds in your folder yet.</div>
      <div class="text-xs text-gray-500">
        Changes sync by themselves when build sharing is on. Close the build in Path of Building first if it's open there.
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, shallowRef } from 'vue'
import type { PobBuildList } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { AppConfig, saveConfig, pushHostConfig } from '@/web/Config'

const emit = defineEmits<{ (e: 'changed'): void }>()

const list = shallowRef<PobBuildList | null>(null)
const busy = ref(false)
const error = ref('')
const filter = ref('')
const editing = ref<string | null>(null)
const mode = ref<'rename' | 'move' | 'delete'>('rename')
const editText = ref('')
const editEl = ref<HTMLInputElement[]>()

const notOwn = computed(() => Boolean(list.value?.own && list.value.player && list.value.own.toLowerCase() !== list.value.player.toLowerCase()))

let lastId = 0
const lsBuilds = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => {
  if (e.requestId !== lastId) return
  busy.value = false
  if (e.ok) { list.value = e.list ?? null; error.value = '' } else error.value = e.error ?? 'Unknown error'
})
const lsManage = Host.onEvent('MAIN->CLIENT::pob-manage-build', (e) => {
  if (e.requestId !== lastId) return
  busy.value = false
  if (!e.ok) { error.value = e.error ?? 'Unknown error'; return }
  error.value = ''
  if (e.list) list.value = e.list
  if (pending && e.path !== undefined) moveLoadoutChoice(pending, e.path)
  pending = null
  editing.value = null
  emit('changed')
})
onUnmounted(() => { lsBuilds.abort(); lsManage.abort() })

function load () {
  busy.value = true
  lastId = (lastId + 1000) | 0
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: lastId } })
}
load()
defineExpose({ load })

interface Row { path: string, label: string }
const folders = computed(() => {
  const q = filter.value.trim().toLowerCase()
  const map = new Map<string, Row[]>()
  for (const p of list.value?.builds ?? []) {
    if (q && !p.toLowerCase().includes(q)) continue
    const parts = p.split(/[\\/]/)
    const label = parts.pop()!.replace(/\.xml$/i, '')
    const folder = parts.join('/')
    if (!map.has(folder)) map.set(folder, [])
    map.get(folder)!.push({ path: p, label })
  }
  return [...map.entries()].map(([name, builds]) => ({ name, builds }))
})
const allFolders = computed(() => {
  const s = new Set<string>()
  for (const p of list.value?.builds ?? []) {
    const parts = p.split(/[\\/]/).slice(0, -1)
    for (let i = 1; i <= parts.length; i++) s.add(parts.slice(0, i).join('/'))
  }
  return [...s].sort()
})

function start (b: Row, m: 'rename' | 'move' | 'delete') {
  editing.value = b.path
  mode.value = m
  editText.value = m === 'rename' ? b.label : m === 'move' ? b.path.split(/[\\/]/).slice(0, -1).join('/') : ''
  if (m === 'rename') nextTick(() => editEl.value?.[0]?.select()).catch(() => {})
}

let pending: string | null = null
function run (op: 'rename' | 'move' | 'duplicate' | 'delete', path: string, extra: { name?: string, folder?: string } = {}) {
  busy.value = true
  error.value = ''
  pending = op === 'duplicate' ? null : path
  lastId = (lastId + 1000) | 0
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-manage-build', payload: { requestId: lastId, op, path, ...extra } })
}

function apply (path: string) {
  if (mode.value === 'rename') run('rename', path, { name: editText.value })
  else if (mode.value === 'move') run('move', path, { folder: editText.value })
  else run('delete', path)
}

// the loadout picked for a build is saved under its path: keep it after rename/move
function moveLoadoutChoice (from: string, to: string | null) {
  const pob = AppConfig().pob
  if (!pob?.loadouts?.[from]) return
  const next = Object.fromEntries(Object.entries(pob.loadouts).filter(([k]) => k !== from))
  if (to) next[to] = pob.loadouts[from]
  pob.loadouts = next
  saveConfig()
  pushHostConfig()
}
</script>
