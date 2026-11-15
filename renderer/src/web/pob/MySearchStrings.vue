<template>
  <!-- Deathloom fork: your saved stash / vendor searches and the vendor search maker
       (Build panel → Notes → Search strings). Replaces the upstream Stash search widget. -->
  <div class="space-y-2">
    <div>
      <div class="text-gray-300 mb-1"><i class="fas fa-bookmark mr-1 text-gray-500" />My search strings</div>
      <div v-if="!saved.length" class="text-gray-500">None saved yet. Make one below{{ readOnly ? ' (in the overlay or the Orbhoarder window)' : '' }}.</div>
      <div v-for="s of saved" :key="s.id" class="flex items-center gap-2 py-0.5">
        <button class="btn shrink-0 w-16" @click="copy(s.text, 'my' + s.id)">{{ copiedKey === 'my' + s.id ? 'Copied' : 'Copy' }}</button>
        <div class="min-w-0 flex-1">
          <div class="text-gray-300 truncate">{{ s.name }}</div>
          <div class="font-mono text-xs text-gray-500 truncate" :title="s.text">{{ s.text }}</div>
        </div>
        <template v-if="!readOnly">
          <hotkey-input class="w-24 text-xs" :model-value="s.hotkey" title="Hotkey: types it into the stash or vendor search"
            @update:model-value="setHotkey(s.id, $event)" />
          <button class="text-gray-500 hover:text-gray-200 px-1" title="Delete" @click="remove(s.id)"><i class="fas fa-trash" /></button>
        </template>
        <span v-else-if="s.hotkey" class="text-xs text-gray-500">{{ s.hotkey }}</span>
      </div>
    </div>

    <div v-if="!readOnly">
      <div class="text-gray-300 mb-1"><i class="fas fa-magic mr-1 text-gray-500" />Make your own (vendor or stash)</div>
      <div class="grid gap-y-1 items-center" style="grid-template-columns: 9rem 1fr;">
        <span class="text-gray-400">Linked sockets</span>
        <div class="flex flex-wrap items-center gap-1">
          <select v-model.number="q.links" class="rounded bg-gray-900 px-1" @change="fitColours">
            <option :value="0">Any</option>
            <option v-for="n of [2, 3, 4, 5, 6]" :key="n" :value="n">{{ n }}-link</option>
          </select>
          <template v-if="q.links >= 2">
            <select v-for="(c, i) of q.colours" :key="i" v-model="q.colours[i]" class="rounded bg-gray-900 px-1" :class="COLOUR_CLASS[c]">
              <option v-for="o of COLOURS" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </template>
        </div>
        <span class="text-gray-400">Movement speed</span>
        <select v-model.number="q.moveSpeed" class="rounded bg-gray-900 px-1 w-28">
          <option :value="0">Don't care</option>
          <option v-for="n of [10, 15, 20, 25, 30, 35]" :key="n" :value="n">{{ n }}% or more</option>
        </select>
        <span class="text-gray-400">Maximum life</span>
        <div class="flex items-center gap-1">
          <input v-model.number="q.life" type="number" min="0" max="999" step="10" class="w-20 rounded bg-gray-900 px-1" placeholder="0">
          <span class="text-gray-500">or more (0 = don't care)</span>
        </div>
        <span class="text-gray-400">Resistances</span>
        <div class="flex flex-wrap items-center gap-x-2">
          <label v-for="e of ELEMENTS" :key="e" class="flex items-center gap-1 capitalize">
            <input type="checkbox" :checked="q.resists.includes(e)" @change="toggleRes(e)">{{ e }}</label>
          <input v-if="q.resists.length" v-model.number="q.resistMin" type="number" min="0" max="99" step="5" class="w-14 rounded bg-gray-900 px-1" placeholder="0">
          <span v-if="q.resists.length" class="text-gray-500">% or more</span>
        </div>
        <span class="text-gray-400">Also</span>
        <div class="flex flex-wrap gap-x-3">
          <label class="flex items-center gap-1"><input v-model="q.plusGems" type="checkbox">+1 to gem levels</label>
          <label class="flex items-center gap-1"><input v-model="q.flatPhys" type="checkbox">Adds physical damage</label>
        </div>
        <span class="text-gray-400">Your own text</span>
        <input v-model="q.custom" type="text" maxlength="40" spellcheck="false" class="rounded bg-gray-900 px-1" placeholder="e.g. Sapphire Ring">
        <span class="text-gray-400">Match</span>
        <div class="flex gap-x-3">
          <label class="flex items-center gap-1"><input v-model="q.match" type="radio" value="any">Any of these</label>
          <label class="flex items-center gap-1"><input v-model="q.match" type="radio" value="all">All of these</label>
        </div>
      </div>
      <div v-if="result.text" class="mt-2 flex items-center gap-2">
        <button class="btn shrink-0 w-16" :disabled="result.tooLong" @click="copy(result.text, 'made')">{{ copiedKey === 'made' ? 'Copied' : 'Copy' }}</button>
        <div class="min-w-0 flex-1">
          <div class="font-mono text-xs truncate" :class="result.tooLong ? 'text-orange-400' : 'text-gray-300'" :title="result.text">{{ result.text }}</div>
          <div class="text-xs" :class="result.tooLong ? 'text-orange-400' : 'text-gray-500'">
            {{ result.length }}/{{ MAX_LEN }} characters{{ result.tooLong ? ': too long for the game, pick fewer things or fewer colours' : '' }}</div>
        </div>
      </div>
      <div v-if="result.text && !result.tooLong" class="mt-1 flex items-center gap-2">
        <input v-model="name" type="text" maxlength="40" class="flex-1 rounded bg-gray-900 px-1" :placeholder="defaultName">
        <button class="btn" @click="saveMade">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { AppConfig, saveConfig, pushHostConfig } from '@/web/Config'
import { IS_HUD } from '@/web/hud/is-hud'
import HotkeyInput from '@/web/settings/HotkeyInput.vue'
import { useCopyFeedback } from './market'
import { emptyQuery, vendorRegex, MAX_LEN, type Colour, type Element } from './vendor-regex'
import type { SavedSearchString } from '@ipc/types'

const readOnly = IS_HUD
const { copiedKey, copy } = useCopyFeedback()

const saved = computed<SavedSearchString[]>(() => AppConfig().pob?.searchStrings ?? [])
function store (list: SavedSearchString[]) {
  AppConfig().pob.searchStrings = list
  saveConfig()
  pushHostConfig()
}
function setHotkey (id: number, hotkey: string | null) {
  store(saved.value.map(s => s.id === id ? { ...s, hotkey } : s))
}
function remove (id: number) {
  store(saved.value.filter(s => s.id !== id))
}

const COLOURS: Array<{ id: Colour, label: string }> = [
  { id: 'x', label: 'Any' }, { id: 'r', label: 'Red' }, { id: 'g', label: 'Green' }, { id: 'b', label: 'Blue' }, { id: 'w', label: 'White' }
]
const COLOUR_CLASS: Record<Colour, string> = { x: '', r: 'text-red-400', g: 'text-green-400', b: 'text-blue-400', w: 'text-gray-100' }
const ELEMENTS: Element[] = ['fire', 'cold', 'lightning', 'chaos']

const q = reactive(emptyQuery())
const name = ref('')
function fitColours () {
  const n = q.links >= 2 ? q.links : 0
  q.colours = Array.from({ length: n }, (_, i) => q.colours[i] ?? 'x')
}
function toggleRes (e: Element) {
  q.resists = q.resists.includes(e) ? q.resists.filter(x => x !== e) : [...q.resists, e]
}
const result = computed(() => vendorRegex({ ...q, life: Number(q.life) || 0, resistMin: Number(q.resistMin) || 0 }))
const defaultName = computed(() => result.value.parts.map(p => p.label).join(q.match === 'all' ? ' + ' : ' or ').slice(0, 60))

function saveMade () {
  if (!result.value.text || result.value.tooLong) return
  const id = Math.max(0, ...saved.value.map(s => s.id)) + 1
  store([...saved.value, { id, name: name.value.trim() || defaultName.value, text: result.value.text, hotkey: null }])
  name.value = ''
}
</script>
