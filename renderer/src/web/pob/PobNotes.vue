<template>
  <!-- Deathloom fork: Build panel → Notes: notes, map mods to avoid and loot filter per build
       (saved next to the build, shared by build sync; friends' notes are read-only) -->
  <div ref="rootEl" class="overflow-y-auto min-h-0 p-2 text-sm" @focusin="typing(true)" @focusout="onFocusOut">
    <div v-if="notesError" class="text-gray-400 mb-2">{{ notesError }}</div>
    <div v-if="!state && notesBusy" class="text-gray-500">Loading…</div>
    <template v-if="state">
      <div class="text-gray-500 mb-2">
        Notes for <span class="text-gray-300">{{ buildLabel(state.build) }}</span>
        <template v-if="!state.own"> · {{ state.player }}'s build (read-only; they edit it, Pull brings changes)</template>
        <template v-else> · saved with the build; Push shares them with friends</template>
      </div>

      <!-- loot filter (idea 15) -->
      <div class="mb-3">
        <div class="text-gray-300 mb-1"><i class="fas fa-filter mr-1 text-gray-500" />Loot filter</div>
        <input v-if="state.own" v-model="draft.filter" type="text" class="rounded px-1 w-full" maxlength="300"
          placeholder="FilterBlade link or filter name" />
        <div v-else class="text-gray-300 break-all">{{ draft.filter || 'none set' }}</div>
        <div v-if="draft.filter" class="text-gray-500 mt-1">
          <a v-if="link" :href="link" target="_blank" class="text-blue-400 hover:underline">Open on FilterBlade</a>
          <span v-if="link"> · </span>
          Remember to switch: in game Options → UI → Loot filter (after FilterBlade's sync or download).
        </div>
      </div>

      <!-- build notes (idea 13) -->
      <div class="mb-3">
        <div class="text-gray-300 mb-1"><i class="fas fa-sticky-note mr-1 text-gray-500" />Notes and guide</div>
        <textarea v-if="state.own" v-model="draft.text" rows="8" class="rounded px-1 w-full" maxlength="20000"
          placeholder="Guide text, reminders, links: anything for this build" />
        <div v-else-if="draft.text" class="whitespace-pre-wrap text-gray-300 bg-gray-900 rounded p-1">{{ draft.text }}</div>
        <div v-else class="text-gray-500">No notes.</div>
      </div>

      <!-- map mods to avoid (idea 2) -->
      <div class="mb-3">
        <div class="text-gray-300 mb-1"><i class="fas fa-skull-crossbones mr-1 text-gray-500" />Map mods this build can't run</div>
        <div class="text-gray-500 mb-1">The map check (price check a map) warns about these.</div>
        <div v-if="state.own" class="grid grid-cols-2 gap-x-2">
          <ui-checkbox v-for="p of MAP_MOD_PRESETS" :key="p.text"
            :modelValue="draft.mapMods.includes(p.text)" @update:modelValue="toggleMod(p.text, $event)">{{ p.label }}</ui-checkbox>
        </div>
        <div v-if="customMods.length || !state.own" class="mt-1 flex flex-wrap gap-1">
          <span v-for="m of (state.own ? customMods : draft.mapMods)" :key="m" class="bg-gray-700 rounded px-1">
            {{ presetLabel(m) }}
            <button v-if="state.own" class="text-gray-500 hover:text-gray-200 ml-1" title="Remove" @click="toggleMod(m, false)"><i class="fas fa-times" /></button>
          </span>
          <span v-if="!state.own && !draft.mapMods.length" class="text-gray-500">None.</span>
        </div>
        <div v-if="state.own" class="flex gap-1 mt-1">
          <input v-model="custom" type="text" class="rounded px-1 flex-1" maxlength="60"
            placeholder="Other: text in the mod, # = a number (e.g. less armour)" @keydown.enter="addCustom" />
          <button class="btn" :disabled="!custom.trim()" @click="addCustom">Add</button>
        </div>
      </div>

      <div v-if="state.own" class="flex items-center gap-2 mb-3">
        <button class="btn" :disabled="!dirty || notesBusy" @click="save">{{ notesBusy ? 'Saving…' : 'Save' }}</button>
        <span v-if="dirty" class="text-gray-500">Not saved yet</span>
        <span v-else-if="savedAt" class="text-gray-500">Saved</span>
      </div>
    </template>

    <!-- search strings (idea 1): one click = one clipboard copy -->
    <div>
      <div class="text-gray-300 mb-1"><i class="fas fa-search mr-1 text-gray-500" />Search strings</div>
      <div class="text-gray-500 mb-1">Copy, then in game click the stash or vendor search (or Ctrl+F) and Ctrl+V.</div>
      <div v-if="gemsError" class="text-gray-500 mb-1">Build gems: {{ gemsError }}</div>
      <div v-for="s of searches" :key="s.key" class="flex items-center gap-2 py-0.5">
        <button class="btn shrink-0 w-16" @click="copy(s.text, s.key)">{{ copiedKey === s.key ? 'Copied' : 'Copy' }}</button>
        <div class="min-w-0">
          <div class="text-gray-300">{{ s.label }} <span v-if="s.hint" class="text-gray-500">· {{ s.hint }}</span></div>
          <div class="font-mono text-xs text-gray-500 truncate" :title="s.text">{{ s.text }}</div>
          <div v-if="s.dropped" class="text-xs text-orange-400">{{ s.dropped }} mod{{ s.dropped > 1 ? 's' : '' }} left out (the game allows 50 characters)</div>
        </div>
      </div>
    </div>

    <!-- your own saved searches + vendor search maker (replaces the Stash search widget) -->
    <my-search-strings />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import type { BuildNotesData } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import UiCheckbox from '@/web/ui/UiCheckbox.vue'
import { notesState, notesError, notesBusy, loadNotes, saveNotes, buildLabel, filterLink } from './build-notes'
import { MAP_MOD_PRESETS, presetLabel } from './map-mods'
import { buildSearchStrings } from './search-strings'
import MySearchStrings from './MySearchStrings.vue'
import { useCopyFeedback } from './market'
import type { PobSocketGroup } from '@ipc/types'

const props = defineProps<{ hud?: boolean }>()

const state = notesState
const empty = (): BuildNotesData => ({ text: '', mapMods: [], filter: '' })
const draft = ref<BuildNotesData>(empty())
const custom = ref('')
const savedAt = ref(0)

watch(notesState, (s) => {
  draft.value = s ? JSON.parse(JSON.stringify(s.data)) : empty()
  if (s && savedAt.value === -1) savedAt.value = Date.now()
}, { immediate: true })

const dirty = computed(() => Boolean(state.value?.own) && JSON.stringify(draft.value) !== JSON.stringify(state.value?.data ?? empty()))
const link = computed(() => filterLink(draft.value.filter))
const customMods = computed(() => draft.value.mapMods.filter(m => !MAP_MOD_PRESETS.some(p => p.text === m)))

function toggleMod (text: string, on: boolean) {
  const list = draft.value.mapMods.filter(m => m !== text)
  if (on) list.push(text)
  draft.value.mapMods = list
}

function addCustom () {
  const v = custom.value.trim().toLowerCase().slice(0, 60)
  if (!v) return
  toggleMod(v, true)
  custom.value = ''
}

function save () {
  savedAt.value = -1
  saveNotes(draft.value)
}

// HUD window: take the keyboard while typing (main gives the game focus back after)
let typingOn = false
function typing (on: boolean) {
  if (!props.hud || on === typingOn) return
  typingOn = on
  Host.sendEvent({ name: 'CLIENT->MAIN::hud-typing', payload: { panel: 'gear', on } })
}
const rootEl = ref<HTMLElement | null>(null)
function onFocusOut () {
  // moving between fields keeps the keyboard
  setTimeout(() => { if (!rootEl.value?.contains(document.activeElement)) typing(false) }, 150)
}
onUnmounted(() => { typing(false) })

// build gems for the search strings (same request as the Gems tab)
const { copiedKey, copy } = useCopyFeedback()
const gemGroups = ref<PobSocketGroup[] | null>(null)
const gemsError = ref<string | null>(null)
let gemsRequestId = 0
const gemsListener = Host.onEvent('MAIN->CLIENT::pob-gems', (e) => {
  if (e.requestId !== gemsRequestId) return
  gemsError.value = e.ok ? null : (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '')
  gemGroups.value = e.ok ? (e.groups ?? []) : null
})
onUnmounted(() => { gemsListener.abort() })
const searches = computed(() => buildSearchStrings(gemGroups.value, draft.value.mapMods))

function request () {
  loadNotes()
  gemsRequestId = Math.floor(Math.random() * 1e9)
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-gems', payload: { requestId: gemsRequestId, refreshGear: false } })
}
defineExpose({ request })
request()
</script>
