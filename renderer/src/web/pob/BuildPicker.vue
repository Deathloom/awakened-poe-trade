<template>
  <!-- Deathloom fork: pick the active build (writes active.txt) and the loadout to compare against -->
  <div class="px-2 py-1 bg-gray-800 text-sm flex flex-col gap-y-1">
    <div v-if="error" class="text-red-400">{{ error }}</div>
    <div class="flex items-center gap-x-2">
      <span class="text-gray-500 w-14 shrink-0">Build</span>
      <select class="flex-1 min-w-0 bg-gray-900 rounded px-1" :disabled="busy || !list"
        :value="list?.active ?? ''" @change="setActive(($event.target as HTMLSelectElement).value)">
        <option v-if="!list?.active" value="" disabled>Pick a build…</option>
        <optgroup v-for="folder of folders" :key="folder.name" :label="folder.name || 'Builds'">
          <option v-for="b of folder.builds" :key="b.path" :value="b.path">{{ b.label }}</option>
        </optgroup>
      </select>
      <button class="text-gray-500 hover:text-gray-200 shrink-0" title="Reload builds and loadouts"
        :disabled="busy" @click="request()"><i class="fas fa-sync-alt" :class="{ 'fa-spin': busy }" /></button>
    </div>
    <div v-if="loadouts" class="flex items-center gap-x-2">
      <span class="text-gray-500 w-14 shrink-0">Loadout</span>
      <select class="flex-1 min-w-0 bg-gray-900 rounded px-1" :disabled="busy" :value="loadoutValue"
        @change="setLoadoutValue(($event.target as HTMLSelectElement).value)">
        <option value="">As saved in PoB</option>
        <option v-for="name of loadouts.named" :key="name" :value="'named:' + name">{{ pobLoadoutName(name) }}</option>
        <option value="custom">Custom (pick tree, items, skills)…</option>
      </select>
    </div>
    <template v-if="loadouts && (loadoutValue === 'custom' || customOpen)">
      <div v-for="row of customRows" :key="row.key" class="flex items-center gap-x-2">
        <span class="text-gray-500 w-14 shrink-0 text-right">{{ row.label }}</span>
        <select class="flex-1 min-w-0 bg-gray-900 rounded px-1" :disabled="busy || row.options.length < 2"
          :value="row.value" @change="setCustom(row.key, Number(($event.target as HTMLSelectElement).value))">
          <option v-for="o of row.options" :key="o.id" :value="o.id">{{ pobText(o.title) || 'Default' }}</option>
        </select>
      </div>
    </template>
    <div v-if="character || characters.length" class="flex items-center gap-x-2"
      title="Character used for 'vs character' and the Gems tab. Follows the character you log into; pick one here to switch now (the next login switches it again).">
      <span class="text-gray-500 w-14 shrink-0">Character</span>
      <select v-if="characters.length" class="flex-1 min-w-0 bg-gray-900 rounded px-1" :disabled="busy"
        :value="character" @change="pickCharacter(($event.target as HTMLSelectElement).value)">
        <option v-if="!characters.some(c => c.name === character)" :value="character">{{ character || 'Pick a character…' }}</option>
        <optgroup v-for="lg of leagues" :key="lg.name" :label="lg.name">
          <option v-for="c of lg.chars" :key="c.name" :value="c.name">{{ c.name }}{{ c.class ? ` · ${c.class} ${c.level ?? ''}` : '' }}</option>
        </optgroup>
      </select>
      <span v-else class="truncate text-gray-400">{{ character }}</span>
    </div>
    <div v-if="list && !list.builds.length" class="text-gray-500">
      No builds in your player folder yet. Save one in PoB (Push to share it).
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef } from 'vue'
import type { PobBuildInfo, PobBuildList, PobCharacterEntry, PobLoadoutChoice, PobLoadouts } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { IS_HUD } from '@/web/hud/is-hud'
import { AppConfig, saveConfig, pushHostConfig } from '@/web/Config'
import { pobText, pobLoadoutName } from './labels'

const emit = defineEmits<{
  (e: 'changed', build: PobBuildInfo | null): void
}>()

const busy = ref(false)
const error = ref<string | null>(null)
const list = shallowRef<PobBuildList | null>(null)
const loadouts = shallowRef<PobLoadouts | null>(null)
const customOpen = ref(false)
const character = ref('')
const characters = shallowRef<PobCharacterEntry[]>([])
// Leagues in the order of their newest login (the list comes newest first)
const leagues = computed(() => {
  const map = new Map<string, PobCharacterEntry[]>()
  for (const c of characters.value) {
    const lg = c.league ?? 'Other'
    if (!map.has(lg)) map.set(lg, [])
    map.get(lg)!.push(c)
  }
  return [...map.entries()].map(([name, chars]) => ({ name, chars }))
})
let lastRequestId = 0

const listener = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => {
  if (e.requestId !== lastRequestId) return
  busy.value = false
  if (!e.ok) {
    error.value = (e.error ?? 'Unknown error').replace(/^.*ImpactServer\.lua:\d+: /, '')
    return
  }
  error.value = null
  list.value = e.list ?? null
  loadouts.value = e.loadouts ?? null
  character.value = e.character ?? ''
  characters.value = e.characters ?? []
  emit('changed', e.build ?? null)
})
// Played character changed: its remembered build may already be active now
const characterListener = Host.onEvent('MAIN->CLIENT::pob-character', () => { request() })
onUnmounted(() => { listener.abort(); characterListener.abort() })

function request (opts: { setActive?: string, setLoadout?: PobLoadoutChoice, setCharacter?: string } = {}) {
  busy.value = true
  lastRequestId += 1
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-builds',
    payload: { requestId: lastRequestId, ...opts }
  })
}
defineExpose({ request })
request()

const folders = computed(() => {
  const map = new Map<string, Array<{ path: string, label: string }>>()
  for (const p of list.value?.builds ?? []) {
    const parts = p.split(/[\\/]/)
    const file = parts.pop()!.replace(/\.xml$/i, '')
    const folder = parts.join('\\')
    if (!map.has(folder)) map.set(folder, [])
    map.get(folder)!.push({ path: p, label: file })
  }
  return [...map.entries()].map(([name, builds]) => ({ name, builds }))
})

function pickCharacter (name: string) {
  if (!name || name === character.value) return
  request({ setCharacter: name })
}

function setActive (path: string) {
  if (!path || path === list.value?.active) return
  customOpen.value = false
  request({ setActive: path })
}

function savedChoice (): PobLoadoutChoice | undefined {
  const active = list.value?.active
  return active ? AppConfig().pob.loadouts?.[active] : undefined
}

function saveChoice (choice: PobLoadoutChoice) {
  const active = list.value?.active
  if (!active) return
  const pob = AppConfig().pob
  const next = Object.fromEntries(Object.entries(pob.loadouts ?? {}).filter(([k]) => k !== active))
  if (Object.keys(choice).length) next[active] = choice
  pob.loadouts = next
  if (IS_HUD) {
    // the overlay saves settings; it sends them to main and back to this window
    Host.sendEvent({ name: 'CLIENT->MAIN::hud-gear-action', payload: { action: 'loadouts', loadouts: JSON.parse(JSON.stringify(next)) } })
  } else {
    saveConfig()
    pushHostConfig()
  }
  request({ setLoadout: choice })
}

const loadoutValue = computed(() => {
  const choice = savedChoice()
  if (!choice) return ''
  if (choice.named) return 'named:' + choice.named
  return 'custom'
})

function setLoadoutValue (value: string) {
  if (value === 'custom') {
    customOpen.value = true
    const a = loadouts.value!.active
    saveChoice({ spec: a.spec, itemSet: a.itemSet, skillSet: a.skillSet })
  } else if (value.startsWith('named:')) {
    customOpen.value = false
    saveChoice({ named: value.slice('named:'.length) })
  } else {
    customOpen.value = false
    saveChoice({})
  }
}

const customRows = computed(() => {
  const l = loadouts.value
  if (!l) return []
  return [
    { key: 'spec' as const, label: 'Tree', options: l.trees, value: l.active.spec },
    { key: 'itemSet' as const, label: 'Items', options: l.itemSets, value: l.active.itemSet },
    { key: 'skillSet' as const, label: 'Skills', options: l.skillSets, value: l.active.skillSet }
  ]
})

function setCustom (key: 'spec' | 'itemSet' | 'skillSet', id: number) {
  const a = loadouts.value!.active
  saveChoice({ spec: a.spec, itemSet: a.itemSet, skillSet: a.skillSet, [key]: id })
}
</script>
