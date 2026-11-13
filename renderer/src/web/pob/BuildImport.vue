<template>
  <!-- Deathloom fork: import a PoB code or build link into the player folder (no PoB window needed) -->
  <div class="px-2 py-1 bg-gray-800 text-sm flex flex-col gap-y-1">
    <textarea v-model="input" rows="2" spellcheck="false"
      class="bg-gray-900 rounded px-1 text-xs font-mono resize-none"
      placeholder="Paste a PoB code or a link (pobb.in, poe.ninja, pastebin, maxroll, …)"
      @input="onInput" />
    <div v-if="loading" class="text-gray-500">Reading the build…</div>
    <div v-if="error" class="text-red-400">{{ error }}</div>
    <template v-if="preview">
      <div class="text-gray-400 truncate">
        {{ [preview.ascendancy || preview.className, preview.mainSkill, preview.level ? `level ${preview.level}` : ''].filter(Boolean).join(' · ') }}
        <span class="text-gray-600">({{ preview.source }})</span>
      </div>
      <div class="flex items-center gap-x-2">
        <span class="text-gray-500 w-14 shrink-0">Name</span>
        <input v-model="name" class="flex-1 min-w-0 bg-gray-900 rounded px-1" spellcheck="false" @input="exists = false">
      </div>
      <div class="flex items-center gap-x-2">
        <span class="text-gray-500 w-14 shrink-0">Folder</span>
        <select v-if="!newFolder" class="flex-1 min-w-0 bg-gray-900 rounded px-1" :value="folder"
          @change="pickFolder(($event.target as HTMLSelectElement).value)">
          <option v-for="f of preview.folders" :key="f" :value="f">{{ f || '(your folder)' }}</option>
          <option value=":new">New folder…</option>
        </select>
        <input v-else v-model="folder" class="flex-1 min-w-0 bg-gray-900 rounded px-1" spellcheck="false"
          placeholder="e.g. 3.29\Witch" @input="exists = false">
      </div>
      <label class="flex items-center gap-x-2 text-gray-400 cursor-pointer">
        <input v-model="setActive" type="checkbox"> Make it the active build
      </label>
      <div class="flex items-center gap-x-2">
        <button class="btn-mini" :disabled="saving || !name.trim()" @click="save(false)">Import</button>
        <button v-if="exists" class="btn-mini text-yellow-400" :disabled="saving" @click="save(true)">Replace it</button>
        <span v-if="saved" class="text-green-500 truncate">Saved {{ saved }}</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref, shallowRef } from 'vue'
import type { PobImportPreview } from '@ipc/types'
import { Host } from '@/web/background/IPC'

const emit = defineEmits<{
  (e: 'imported', rel: string, active: boolean): void
}>()

const input = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const preview = shallowRef<PobImportPreview | null>(null)
const name = ref('')
const folder = ref('')
const newFolder = ref(false)
const setActive = ref(true)
const exists = ref(false)
const saved = ref('')
let lastRequestId = 0
let previewId = 0
let saveId = 0
let typing: ReturnType<typeof setTimeout> | null = null

const listener = Host.onEvent('MAIN->CLIENT::pob-import', (e) => {
  if (e.requestId === previewId) {
    loading.value = false
    if (!e.ok || !e.preview) {
      error.value = e.error ?? 'Unknown error'
      preview.value = null
      return
    }
    error.value = null
    preview.value = e.preview
    name.value = e.preview.name
    if (!e.preview.folders.includes(folder.value)) folder.value = ''
  } else if (e.requestId === saveId) {
    saving.value = false
    if (e.ok && e.saved) {
      error.value = null
      exists.value = false
      saved.value = e.saved
      emit('imported', e.saved, setActive.value)
    } else {
      exists.value = e.exists === true
      error.value = e.error ?? 'Unknown error'
    }
  }
})
onUnmounted(() => { listener.abort(); if (typing) clearTimeout(typing) })

function onInput () {
  saved.value = ''
  exists.value = false
  if (typing) clearTimeout(typing)
  if (!input.value.trim()) {
    preview.value = null
    error.value = null
    return
  }
  typing = setTimeout(requestPreview, 400)
}

function requestPreview () {
  lastRequestId += 1
  previewId = lastRequestId
  loading.value = true
  error.value = null
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-import', payload: { requestId: previewId, input: input.value, preview: true } })
}

function pickFolder (value: string) {
  exists.value = false
  if (value === ':new') {
    newFolder.value = true
    folder.value = ''
  } else {
    folder.value = value
  }
}

function save (overwrite: boolean) {
  lastRequestId += 1
  saveId = lastRequestId
  saving.value = true
  saved.value = ''
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-import',
    payload: { requestId: saveId, input: input.value, name: name.value, folder: folder.value, setActive: setActive.value, overwrite }
  })
}
</script>

<style lang="postcss" scoped>
.btn-mini {
  @apply bg-gray-700 text-gray-300 rounded px-2;
  &:hover:not(:disabled) { @apply text-gray-100; }
  &:disabled { @apply opacity-50; }
}
</style>
