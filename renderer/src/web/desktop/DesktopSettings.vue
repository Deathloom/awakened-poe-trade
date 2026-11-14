<template>
  <!-- Deathloom fork: the overlay's settings in the Loot Goblin window. Same
       pages as Shift+Space → Settings; Save writes the same config file and
       every window (overlay, HUD panels) picks it up straight away. -->
  <div class="flex h-full min-h-0 rounded overflow-hidden border border-gray-700">
    <div class="pl-2 pt-2 bg-gray-900 flex flex-col gap-1 shrink-0" style="min-width: 10rem;">
      <template v-for="(item, i) of menuItems" :key="i">
        <button v-if="item.type === 'menu-item'" class="text-left p-2 leading-none rounded-l"
          :class="item.isSelected ? 'bg-gray-800 text-gray-100' : 'text-gray-500 hover:text-gray-100'"
          @click="item.select">{{ item.name }}</button>
        <div v-else class="border-b mx-2 border-gray-800" />
      </template>
    </div>
    <div class="text-gray-100 grow flex flex-col min-w-0 bg-gray-900">
      <div class="grow overflow-y-auto bg-gray-800 rounded-tl">
        <component :is="selected" v-if="configClone" :config="configClone" />
      </div>
      <div class="border-t bg-gray-900 border-gray-600 p-2 flex items-center justify-end gap-x-2">
        <span v-if="note" class="mr-auto text-xs" :class="note.warn ? 'text-yellow-500' : 'text-green-500'">{{ note.text }}</span>
        <button class="px-3 rounded" :class="dirty ? 'bg-gray-600 text-gray-100' : 'bg-gray-800'" @click="save">{{ t('Save') }}</button>
        <button class="px-3" :title="'Undo changes not saved yet'" @click="reset">{{ t('Cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, shallowRef, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppConfig, updateConfig, saveConfig, pushHostConfig, type Config } from '@/web/Config'
import SettingsHotkeys from '../settings/hotkeys.vue'
import SettingsChat from '../settings/chat.vue'
import SettingsGeneral from '../settings/general.vue'
import SettingsAbout from '../settings/about.vue'
import SettingsPricecheck from '../price-check/settings-price-check.vue'
import SettingsItemcheck from '../item-check/settings-item-check.vue'
import SettingsDebug from '../settings/debug.vue'
import SettingsMaps from '../map-check/settings-maps.vue'
import SettingsPob from '../settings/pob.vue'

const { t } = useI18n()

// same groups as the overlay's settings window (no Quit here: the tray has it)
const GROUPS: Component[][] = [
  [SettingsPob],
  [SettingsHotkeys, SettingsChat],
  [SettingsGeneral],
  [SettingsPricecheck, SettingsMaps, SettingsItemcheck],
  [SettingsDebug, SettingsAbout]
]

const selected = shallowRef<Component>(SettingsPob)
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

// saved somewhere else (overlay settings, setup guide, build panel): take it
// over unless there are unsaved edits here
watch(() => JSON.stringify(AppConfig()), (now) => {
  if (now === baseline.value) return
  if (!dirty.value) {
    configClone.value = clone()
  } else {
    showNote('Settings were changed in another window. Save overwrites them; Cancel loads them.', true)
  }
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

const menuItems = computed(() => {
  const out: Array<{ type: 'menu-item', name: string, select: () => void, isSelected: boolean } | { type: 'separator' }> = []
  GROUPS.forEach((group, i) => {
    if (i) out.push({ type: 'separator' })
    for (const component of group) {
      out.push({
        type: 'menu-item',
        name: t((component as { name?: string }).name ?? ''),
        select: () => { selected.value = component },
        isSelected: selected.value === component
      })
    }
  })
  return out
})
</script>
