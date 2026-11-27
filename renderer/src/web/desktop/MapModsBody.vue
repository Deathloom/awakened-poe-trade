<template>
  <!-- Deathloom fork (layout review follow-up): Mapping → Map mods. The same page as
       Settings → Maps, with its own Save, so you can colour mods while you map. -->
  <div class="flex flex-col h-full min-h-0 rounded bg-gray-800 overflow-hidden">
    <div class="flex-1 min-h-0">
      <SettingsMaps :config="configClone" />
    </div>
    <div class="border-t border-gray-700 p-2 flex items-center justify-end gap-x-2 shrink-0">
      <span v-if="note" class="text-xs mr-auto" :class="note.warn ? 'text-yellow-500' : 'text-green-500'">{{ note.text }}</span>
      <button class="px-3 rounded" :class="dirty ? 'bg-gray-600 text-gray-100' : 'bg-gray-900'" @click="save">Save</button>
      <button class="px-3" title="Undo changes not saved yet" @click="reset">Cancel</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { AppConfig, updateConfig, saveConfig, pushHostConfig, type Config } from '@/web/Config'
import SettingsMaps from '../map-check/settings-maps.vue'

const clone = () => reactive(JSON.parse(JSON.stringify(AppConfig()))) as Config
const configClone = shallowRef<Config>(clone())
const baseline = ref(JSON.stringify(AppConfig()))
const dirty = computed(() => JSON.stringify(configClone.value) !== baseline.value)
const note = shallowRef<{ text: string, warn?: boolean } | null>(null)
let noteTimer: ReturnType<typeof setTimeout> | undefined
function showNote (text: string, warn = false) {
  note.value = { text, warn }
  clearTimeout(noteTimer)
  noteTimer = setTimeout(() => { note.value = null }, 4000)
}
// saved in another window or in Settings: take it over unless there are unsaved edits here
watch(() => JSON.stringify(AppConfig()), (now) => {
  if (now === baseline.value) return
  if (!dirty.value) configClone.value = clone()
  else showNote('Settings were changed somewhere else. Save overwrites them; Cancel loads them.', true)
  baseline.value = now
})
function save () {
  updateConfig(configClone.value)
  saveConfig()
  pushHostConfig()
  baseline.value = JSON.stringify(AppConfig())
  configClone.value = clone()
  showNote('Saved')
}
function reset () {
  configClone.value = clone()
  baseline.value = JSON.stringify(AppConfig())
}
onUnmounted(() => clearTimeout(noteTimer))
</script>
