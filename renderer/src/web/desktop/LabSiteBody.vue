<template>
  <!-- Deathloom fork: poelab.com (today's labyrinth layouts) in the Orbhoarder
       window. Shown as-is in its own session, ads included; nothing is read
       from or copied off the page. Links to other sites open in your browser. -->
  <div class="flex flex-col h-full min-h-0 rounded bg-gray-800">
    <div class="flex items-center gap-x-1 px-2 py-1 border-b border-gray-700 shrink-0 text-sm">
      <button class="px-2 rounded hover:bg-gray-700 disabled:opacity-40" :disabled="!canBack" title="Back" @click="view?.goBack()"><i class="fas fa-arrow-left" /></button>
      <button class="px-2 rounded hover:bg-gray-700 disabled:opacity-40" :disabled="!canForward" title="Forward" @click="view?.goForward()"><i class="fas fa-arrow-right" /></button>
      <button class="px-2 rounded hover:bg-gray-700" title="Reload" @click="view?.reload()"><i class="fas fa-redo" /></button>
      <button class="px-2 rounded hover:bg-gray-700" title="poelab.com home (today's layouts)" @click="go(HOME)"><i class="fas fa-home" /></button>
      <div class="flex-1 min-w-0 truncate px-2 text-gray-400" :title="url">{{ shortUrl }}</div>
      <i v-if="loading" class="fas fa-circle-notch fa-spin text-gray-500" />
      <button class="px-2 rounded hover:bg-gray-700" title="Open this page in your browser" @click="openExternal"><i class="fas fa-external-link-alt" /></button>
    </div>
    <!-- Deathloom fork (idea 6): your own run checklist; nothing is read from the page.
         A new run starts when Client.txt says you entered Aspirants' Plaza. -->
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 border-b border-gray-700 shrink-0 text-sm">
      <span class="text-gray-500"><i class="fas fa-dungeon mr-1" />This run</span>
      <label v-for="(k, i) of IZARO" :key="k" class="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" :checked="run.izaro[i]" @change="setIzaro(i, ($event.target as HTMLInputElement).checked)" />
        <span :class="run.izaro[i] ? 'text-gray-500 line-through' : 'text-gray-300'">{{ k }}</span>
      </label>
      <label class="flex items-center gap-1 cursor-pointer">
        <input type="checkbox" v-model="run.key" @change="saveRun" />
        <span :class="run.key ? 'text-gray-500 line-through' : 'text-gray-300'">Treasure key</span>
      </label>
      <span class="flex items-center gap-1 text-gray-300">Darkshrines
        <button class="px-1 rounded hover:bg-gray-700" title="One less" @click="shrine(-1)">−</button>{{ run.shrines }}<button class="px-1 rounded hover:bg-gray-700" title="One more" @click="shrine(1)">+</button>
      </span>
      <span v-if="run.start" class="text-gray-400" :title="'Started ' + new Date(run.start).toLocaleTimeString()">
        <i class="fas fa-stopwatch mr-1" />{{ elapsed }}</span>
      <button class="ml-auto text-gray-500 hover:text-gray-200" title="Clear the checklist (also happens when you enter Aspirants' Plaza)" @click="resetRun(false)">Reset</button>
    </div>
    <div class="px-3 py-0.5 text-xs text-gray-500 bg-gray-900 shrink-0">
      poelab.com as-is (community site, not part of Orbhoarder). Links to other sites open in your browser.
    </div>
    <webview ref="webviewEl" class="flex-1 min-h-0" :partition="PARTITION" :src="HOME" allowpopups />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { Host } from '@/web/background/IPC'
import { parseLogLine } from '@/web/companion/game-log'

// must match main/src/windowing/trade-tab.ts (main refuses any other partition)
const PARTITION = 'persist:loot-goblin-poelab'
const HOME = 'https://www.poelab.com/'

interface WebviewTag extends HTMLElement {
  getURL: () => string
  loadURL: (url: string) => Promise<void>
  canGoBack: () => boolean
  canGoForward: () => boolean
  goBack: () => void
  goForward: () => void
  reload: () => void
}

// ---- lab run checklist (stored per window in localStorage) ----------------
const IZARO = ['Izaro 1', 'Izaro 2', 'Izaro 3']
const RUN_KEY = 'deathloom.lab-run.v1'
interface LabRun { izaro: boolean[], key: boolean, shrines: number, start: number | null, end: number | null }
const emptyRun = (start: number | null = null): LabRun => ({ izaro: [false, false, false], key: false, shrines: 0, start, end: null })
function loadRun (): LabRun {
  try {
    const r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null') as LabRun | null
    if (r && Array.isArray(r.izaro)) return { ...emptyRun(), ...r, izaro: [0, 1, 2].map(i => Boolean(r.izaro[i])) }
  } catch {}
  return emptyRun()
}
const run = ref<LabRun>(loadRun())
function saveRun () { try { localStorage.setItem(RUN_KEY, JSON.stringify(run.value)) } catch {} }
function resetRun (started: boolean) { run.value = emptyRun(started ? Date.now() : null); saveRun() }
function setIzaro (i: number, on: boolean) {
  run.value.izaro[i] = on
  // the last Izaro ends the run: the timer stops
  run.value.end = run.value.izaro[2] ? (run.value.end ?? Date.now()) : null
  saveRun()
}
function shrine (d: number) { run.value.shrines = Math.max(0, Math.min(20, run.value.shrines + d)); saveRun() }
const now = ref(Date.now())
const tick = setInterval(() => { now.value = Date.now() }, 1000)
const elapsed = computed(() => {
  const r = run.value
  if (!r.start) return ''
  const s = Math.max(0, Math.floor(((r.end ?? now.value) - r.start) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}${r.end ? ' (done)' : ''}`
})
const logListener = Host.onEvent('MAIN->CLIENT::game-log', (e) => {
  for (const line of e.lines) {
    const ev = parseLogLine(line)
    if (ev?.type === 'zone' && ev.name === "Aspirants' Plaza") resetRun(true)
  }
})
const onStorage = (e: StorageEvent) => { if (e.key === RUN_KEY) run.value = loadRun() }
window.addEventListener('storage', onStorage)
onUnmounted(() => { clearInterval(tick); logListener.abort(); window.removeEventListener('storage', onStorage) })

const webviewEl = shallowRef<WebviewTag>()
const ready = ref(false)
const view = computed(() => ready.value ? webviewEl.value : undefined)
const url = ref(HOME)
const loading = ref(false)
const canBack = ref(false)
const canForward = ref(false)
const shortUrl = computed(() => url.value.replace(/^https:\/\/(www\.)?/, ''))

function refresh () {
  const w = webviewEl.value
  if (!w || !ready.value) return
  url.value = w.getURL()
  canBack.value = w.canGoBack()
  canForward.value = w.canGoForward()
}

function go (to: string) {
  if (!ready.value) return
  webviewEl.value?.loadURL(to).catch(() => {})
}

function openExternal () {
  window.open(url.value)
}

onMounted(() => {
  const w = webviewEl.value!
  w.addEventListener('dom-ready', () => { ready.value = true; refresh() }, { once: true })
  w.addEventListener('did-start-loading', () => { loading.value = true })
  w.addEventListener('did-stop-loading', () => { loading.value = false; refresh() })
  w.addEventListener('did-navigate', refresh)
  w.addEventListener('did-navigate-in-page', refresh)
})
</script>
