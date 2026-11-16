<template>
  <!-- Deathloom fork (16 Nov 2026): timeless jewel explorer. Path of Building
       works out the conquered passives (its own LUTs), nothing is guessed here. -->
  <div class="h-full min-h-0 flex flex-col gap-3">
    <div class="flex items-center gap-1 text-sm">
      <button class="craft-btn" :class="{ 'craft-btn-primary': mode === 'seed' }" @click="mode = 'seed'">
        <i class="fas fa-eye mr-1.5" />Look up a seed</button>
      <button class="craft-btn" :class="{ 'craft-btn-primary': mode === 'find' }" @click="mode = 'find'">
        <i class="fas fa-search-plus mr-1.5" />Find seeds</button>
    </div>
    <div v-if="mode === 'seed'" class="flex flex-wrap items-end gap-3">
      <label class="craft-field">
        <span>Jewel</span>
        <select v-model="jewel" class="craft-input">
          <option v-for="j of jewels" :key="j.name" :value="j.name">{{ j.name }}</option>
        </select>
      </label>
      <label class="craft-field">
        <span>Conqueror</span>
        <select v-model="conqueror" class="craft-input">
          <option v-for="c of info?.conquerors ?? []" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label class="craft-field">
        <span>Seed <span class="text-gray-500">({{ seedHint }})</span></span>
        <input v-model.number="seed" type="number" class="craft-input w-32" :min="info?.seedMin" :max="info?.seedMax" :step="info?.seedStep ?? 1" @keydown.enter="run">
      </label>
      <label class="craft-field flex-1 min-w-[16rem]">
        <span>Socket</span>
        <select v-model="socket" class="craft-input">
          <option v-for="s of sortedSockets" :key="s.id" :value="s.id">{{ socketLabel(s) }}</option>
        </select>
      </label>
      <button class="craft-btn-primary" :disabled="busy || !canRun" @click="run">
        <i class="fas fa-search mr-1.5" />Show passives</button>
      <button class="craft-btn" :disabled="!result" title="Search the trade site for this jewel with this seed and conqueror" @click="tradeSearch">
        <i class="fas fa-store mr-1.5" />Find on trade</button>
    </div>
    <div v-else class="flex flex-wrap items-end gap-3">
      <label class="craft-field">
        <span>Jewel</span>
        <select v-model="jewel" class="craft-input">
          <option v-for="j of jewels" :key="j.name" :value="j.name">{{ j.name }}</option>
        </select>
      </label>
      <label class="craft-field flex-1 min-w-[16rem]">
        <span>Socket</span>
        <select v-model="socket" class="craft-input">
          <option v-for="s of sortedSockets" :key="s.id" :value="s.id">{{ socketLabel(s) }}</option>
        </select>
      </label>
      <button class="craft-btn-primary" :disabled="busy || !wants.length || !options" @click="findSeeds">
        <i class="fas fa-search mr-1.5" />Find seeds</button>
    </div>
    <p v-if="error" class="craft-error">{{ error }}</p>

    <template v-if="mode === 'find'">
      <p v-if="busy && !options" class="text-gray-500 text-sm">Reading every seed of {{ jewel }} for this socket…</p>
      <div v-if="options" class="flex-1 min-h-0 grid gap-3" style="grid-template-columns: minmax(18rem, 26rem) 1fr;">
        <div class="min-h-0 overflow-y-auto flex flex-col gap-2 pr-1">
          <div class="craft-card">
            <div class="font-semibold text-gray-100 mb-1">Anywhere in radius</div>
            <select v-model="anyLabel" class="craft-input w-full">
              <option value="">Pick a passive or stat…</option>
              <option v-for="l of options.labels" :key="l.label" :value="l.label">{{ l.label }} ({{ l.nodes }} notables can get it)</option>
            </select>
            <div class="flex items-center gap-2 mt-2 text-sm text-gray-400">
              <span>on at least</span>
              <input v-model.number="anyMin" type="number" min="1" :max="options.nodes.length" class="craft-input w-16">
              <span>notables</span>
              <button class="craft-btn ml-auto" :disabled="!anyLabel" @click="addAnywhere">Add</button>
            </div>
          </div>
          <div v-for="n of options.nodes" :key="n.id" class="craft-card" :class="{ 'craft-card-mine': n.alloc }">
            <div class="flex items-baseline gap-2">
              <span class="font-semibold text-gray-100">{{ n.name }}</span>
              <span v-if="n.alloc" class="ml-auto text-xs text-green-400" title="Your active build takes this passive">in build</span>
            </div>
            <select class="craft-input w-full mt-1" :value="nodeWant(n.id)?.label ?? ''" @change="setNodeWant(n.id, ($event.target as HTMLSelectElement).value)">
              <option value="">Don't care</option>
              <option v-for="o of n.options" :key="o.label" :value="o.label">{{ o.label }} ({{ pct(o.seeds) }})</option>
            </select>
          </div>
        </div>
        <div class="min-h-0 flex flex-col gap-2">
          <div class="flex flex-wrap gap-1.5">
            <span v-for="w of wants" :key="w.label + (w.node ?? '')" class="craft-card py-1 px-2 text-sm flex items-center gap-2">
              {{ wantText(w, nodeName(w.node)) }}
              <button class="text-gray-500 hover:text-red-400" title="Remove" @click="wants = removeWant(wants, w)"><i class="fas fa-times" /></button>
            </span>
            <span v-if="!wants.length" class="text-gray-500 text-sm">Pick what you want on the left: a passive on one notable, or a stat anywhere in the radius. Then Find seeds.</span>
          </div>
          <template v-if="search">
            <p class="text-sm text-gray-400">
              <b class="text-gray-200">{{ search.complete }}</b> of {{ search.total }} seeds give everything you picked.
              Best {{ search.seeds.length }} shown. Any conqueror works: it only changes the keystone.
            </p>
            <div class="flex-1 min-h-0 overflow-y-auto grid gap-2 content-start" style="grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));">
              <div v-for="s of search.seeds" :key="s.seed" class="craft-card" :class="{ 'opacity-70': !s.all }">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-gray-100">Seed {{ s.seed }}</span>
                  <span class="text-xs" :class="s.all ? 'text-green-400' : 'text-gray-500'">{{ s.met }}/{{ search.wants }} wanted</span>
                  <button class="craft-btn ml-auto py-0.5" title="Show all passives with this seed" @click="showSeed(s.seed)"><i class="fas fa-eye" /></button>
                  <button class="craft-btn py-0.5" title="Search the trade site for this seed (any conqueror)" @click="tradeSeed(s.seed)"><i class="fas fa-store" /></button>
                </div>
                <ul class="mt-1 text-sm leading-snug">
                  <li v-for="(h, i) of s.hits" :key="i" class="text-gray-400">
                    <span :class="h.alloc ? 'text-green-300' : 'text-gray-300'">{{ h.name }}</span> → <span class="text-blue-300">{{ h.label }}</span>
                  </li>
                </ul>
              </div>
              <p v-if="!search.seeds.length" class="text-gray-500 text-sm">No seed gives any of these. Try fewer or other picks.</p>
            </div>
          </template>
        </div>
      </div>
    </template>

    <div v-if="mode === 'seed' && result" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span class="text-gray-300"><b>{{ result.jewel }}</b> · {{ result.conqueror }} · seed {{ result.seed }}</span>
      <span class="text-gray-400">{{ notables.length }} notables, {{ smalls.length }} small passives in radius</span>
      <label class="flex items-center gap-1.5 text-gray-400"><input v-model="onlyBuild" type="checkbox">Only passives my build takes</label>
      <label class="flex items-center gap-1.5 text-gray-400"><input v-model="showSmall" type="checkbox">Show small passives</label>
    </div>

    <div v-if="mode === 'seed' && result" class="flex-1 min-h-0 overflow-y-auto grid gap-2 content-start" style="grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));">
      <div v-for="n of shown" :key="n.id" class="craft-card" :class="{ 'craft-card-mine': n.alloc }">
        <div class="flex items-baseline gap-2">
          <span class="font-semibold" :class="n.type === 'Keystone' ? 'text-yellow-300' : n.type === 'Notable' ? 'text-gray-100' : 'text-gray-400'">{{ n.newName ?? n.name }}</span>
          <span v-if="n.newName" class="text-xs text-gray-500 line-through">{{ n.name }}</span>
          <span v-if="n.alloc" class="ml-auto text-xs text-green-400" title="Your active build takes this passive">in build</span>
        </div>
        <ul class="mt-1 text-sm leading-snug">
          <li v-for="(line, i) of n.stats" :key="i" :class="isNew(n, line) ? 'text-blue-300' : 'text-gray-400'">{{ line }}</li>
          <li v-if="!n.stats.length" class="text-gray-500 italic">No stats</li>
        </ul>
      </div>
      <p v-if="!shown.length" class="text-gray-500 text-sm">Nothing to show with these filters.</p>
    </div>
    <p v-else-if="mode === 'seed' && !error" class="text-gray-500 text-sm">
      Pick the jewel, its conqueror and the seed (the number on the jewel), then the socket. Your build's sockets are listed first.
      New or changed stats are shown in blue.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { TimelessJewelInfo, TimelessResult, TimelessSocket, TimelessNode, TimelessOptions, TimelessSearch, TimelessWant } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { useLeagues } from '@/web/background/Leagues'
import { openTradeLink } from '@/web/desktop/trade-tab'
import { pobError } from './pob-error'
import { addWant, removeWant, wantText, timelessTradeQuery } from './timeless-find'

const STORE = 'deathloom.timeless.v1'
interface Saved { jewel?: string, conqueror?: string, seed?: number, socket?: number }
function load (): Saved {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '{}') as Saved } catch { return {} }
}
const saved = load()

const jewels = shallowRef<TimelessJewelInfo[]>([])
const sockets = shallowRef<TimelessSocket[]>([])
const jewel = ref(saved.jewel ?? 'Lethal Pride')
const conqueror = ref(saved.conqueror ?? '')
const seed = ref<number | ''>(saved.seed ?? '')
const socket = ref<number | null>(saved.socket ?? null)
const result = shallowRef<TimelessResult | null>(null)
const error = ref('')
const busy = ref(false)
const onlyBuild = ref(false)
const showSmall = ref(false)
const mode = ref<'seed' | 'find'>('seed')
const options = shallowRef<TimelessOptions | null>(null)
const search = shallowRef<TimelessSearch | null>(null)
const wants = ref<TimelessWant[]>([])
const anyLabel = ref('')
const anyMin = ref(1)

const info = computed(() => jewels.value.find(j => j.name === jewel.value))
const seedHint = computed(() => info.value
  ? `${info.value.seedMin}–${info.value.seedMax}${info.value.seedStep > 1 ? `, steps of ${info.value.seedStep}` : ''}`
  : 'number on the jewel')
watch(info, (i) => {
  if (i && !i.conquerors.includes(conqueror.value)) conqueror.value = i.conquerors[0]
})
const canRun = computed(() => Boolean(info.value && conqueror.value && typeof seed.value === 'number' && socket.value != null))

const sortedSockets = computed(() => [...sockets.value].sort((a, b) =>
  Number(b.alloc) - Number(a.alloc) || (a.keystone ?? 'zz').localeCompare(b.keystone ?? 'zz') || b.notables.length - a.notables.length))
function socketLabel (s: TimelessSocket) {
  const near = s.keystone ? `near ${s.keystone}` : s.notables.length ? `near ${s.notables.slice(0, 2).join(', ')}` : 'outer socket'
  return `${s.alloc ? '★ ' : ''}${near} (${s.notables.length} notables)`
}

let reqId = 0
const listener = Host.onEvent('MAIN->CLIENT::pob-timeless', (e) => {
  if (e.requestId !== reqId) return
  busy.value = false
  if (!e.ok) {
    error.value = pobError(e.error)
    return
  }
  error.value = ''
  if (e.jewels?.length) jewels.value = e.jewels
  if (e.sockets) {
    sockets.value = e.sockets
    if (socket.value == null || !e.sockets.some(s => s.id === socket.value)) socket.value = sortedSockets.value[0]?.id ?? null
  }
  if (e.result) result.value = e.result
  if (e.options) options.value = e.options
  if (e.search) search.value = e.search
})
onUnmounted(() => { listener.abort() })

Host.sendEvent({ name: 'CLIENT->MAIN::pob-timeless', payload: { requestId: ++reqId, sockets: true } })

function run () {
  if (!canRun.value || busy.value) return
  busy.value = true
  error.value = ''
  const payload = { jewel: jewel.value, conqueror: conqueror.value, seed: Number(seed.value), socket: socket.value! }
  try { localStorage.setItem(STORE, JSON.stringify(payload)) } catch {}
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-timeless', payload: { requestId: ++reqId, ...payload } })
}

const notables = computed(() => (result.value?.nodes ?? []).filter(n => n.type !== 'Normal'))
const smalls = computed(() => (result.value?.nodes ?? []).filter(n => n.type === 'Normal'))
const shown = computed(() => (result.value?.nodes ?? []).filter(n =>
  (showSmall.value || n.type !== 'Normal') && (!onlyBuild.value || n.alloc)))

function isNew (n: TimelessNode, line: string) {
  return Boolean(n.newName) || !n.before.includes(line)
}

function openTrade (query: unknown) {
  const league = useLeagues().selectedId.value
  if (!league) {
    error.value = 'Pick a league first (price check window title).'
    return
  }
  openTradeLink(`https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}?q=${JSON.stringify(query)}`)
}

function tradeSearch () {
  const r = result.value
  if (r) openTrade(timelessTradeQuery(r.jewel, [r.conqueror], r.seed))
}

// --- Find seeds: what each notable can become, then the seeds that give the picks
function loadOptions () {
  if (mode.value !== 'find' || !info.value || socket.value == null) return
  if (options.value?.jewel === jewel.value && options.value.socket === socket.value) return
  options.value = null
  search.value = null
  wants.value = []
  anyLabel.value = ''
  busy.value = true
  error.value = ''
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-timeless', payload: { requestId: ++reqId, jewel: jewel.value, socket: socket.value, find: 'options' } })
}
watch([mode, jewel, socket, info], loadOptions)

function nodeWant (id: number) { return wants.value.find(w => w.node === id) }
function nodeName (id?: number) { return options.value?.nodes.find(n => n.id === id)?.name }
function setNodeWant (id: number, label: string) {
  wants.value = label
    ? addWant(wants.value, { label, node: id })
    : wants.value.filter(w => w.node !== id)
}
function addAnywhere () {
  if (!anyLabel.value) return
  const min = Math.max(1, Math.floor(Number(anyMin.value) || 1))
  wants.value = addWant(wants.value, { label: anyLabel.value, min })
  anyLabel.value = ''
  anyMin.value = 1
}
function pct (seeds: number) {
  const total = info.value ? Math.round((info.value.seedMax - info.value.seedMin) / info.value.seedStep) + 1 : 0
  return total ? `${Math.max(0.1, Math.round(seeds / total * 1000) / 10)}% of seeds` : `${seeds} seeds`
}

function findSeeds () {
  if (busy.value || !wants.value.length || socket.value == null) return
  busy.value = true
  error.value = ''
  Host.sendEvent({
    name: 'CLIENT->MAIN::pob-timeless',
    payload: { requestId: ++reqId, jewel: jewel.value, socket: socket.value, find: 'search', wants: wants.value.map(w => ({ ...w })) }
  })
}

function showSeed (s: number) {
  seed.value = s
  mode.value = 'seed'
  run()
}

function tradeSeed (s: number) {
  if (info.value) openTrade(timelessTradeQuery(jewel.value, info.value.conquerors, s))
}
</script>
