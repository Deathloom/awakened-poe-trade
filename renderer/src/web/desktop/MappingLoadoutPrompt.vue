<template>
  <!-- Deathloom fork (19 Nov 2026): once you're mapping, ask which of the build's
       loadouts you play in maps. Never picks one by itself (guides don't share an
       order or names); one question per build, "Not now" hides it for that build. -->
  <div v-if="show" class="flex flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 mx-2 mt-2 rounded bg-gray-800 text-sm shrink-0">
    <i class="fas fa-map text-gray-400" />
    <span class="text-gray-200">You're mapping now. Which loadout of <b>{{ buildName }}</b> do you play in maps?</span>
    <select v-model="pick" class="rounded bg-gray-900 px-1 py-0.5">
      <option v-for="o of options" :key="o.key" :value="o.key">{{ o.label }}{{ o.key === current?.key ? ' (now)' : '' }}</option>
    </select>
    <button class="px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" @click="use">Use it</button>
    <button class="text-gray-400 hover:text-gray-200" title="Build → What changes (route icon) lists what to swap between two loadouts" @click="done">Not now</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import type { PobLoadouts } from '@ipc/types'
import { loadoutOptions, currentOption } from '../pob/loadout-steps'
import { layoutMode } from './all-layout'

const KEY = 'deathloom.mapping-loadout-asked.v1'
function asked (): string[] {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}

const buildPath = ref<string | null>(null)
const loadouts = shallowRef<PobLoadouts | null>(null)
const options = computed(() => loadoutOptions(loadouts.value))
const current = computed(() => currentOption(loadouts.value, options.value))
const pick = ref('')
const answered = ref<string[]>(asked())
const buildName = computed(() => (buildPath.value ?? '').split(/[\\/]/).pop()?.replace(/\.xml$/i, '') ?? '')
const show = computed(() => layoutMode() === 'mapping' && options.value.length > 1 && !!buildPath.value && !answered.value.includes(buildPath.value))

let reqId = (Date.now() & 0x3ffffff) * 8 + 3
let buildsId = 0
const ls = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => {
  if (e.requestId !== buildsId || !e.ok || !e.list) return
  buildPath.value = e.list.active
  loadouts.value = e.loadouts ?? null
  if (!options.value.some(o => o.key === pick.value)) pick.value = current.value?.key ?? options.value[0]?.key ?? ''
})
onUnmounted(() => { ls.abort() })
function request () {
  buildsId = ++reqId
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: buildsId } })
}
request()
watch(() => layoutMode(), (m) => { if (m === 'mapping') request() })

function done () {
  if (!buildPath.value) return
  answered.value = [...answered.value.filter(p => p !== buildPath.value), buildPath.value].slice(-50)
  try { localStorage.setItem(KEY, JSON.stringify(answered.value)) } catch {}
}
function use () {
  const o = options.value.find(x => x.key === pick.value)
  if (o && o.key !== current.value?.key) {
    buildsId = ++reqId
    Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: buildsId, setLoadout: o.key.startsWith('n:') ? { named: o.label } : { ...o.sel } } })
  }
  done()
}
</script>
