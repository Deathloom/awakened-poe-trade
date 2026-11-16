<template>
  <!-- Deathloom fork (16 Nov 2026): timeless jewel explorer. Path of Building
       works out the conquered passives (its own LUTs), nothing is guessed here. -->
  <div class="h-full min-h-0 flex flex-col gap-3">
    <div class="flex flex-wrap items-end gap-3">
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
    <p v-if="error" class="craft-error">{{ error }}</p>

    <div v-if="result" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span class="text-gray-300"><b>{{ result.jewel }}</b> · {{ result.conqueror }} · seed {{ result.seed }}</span>
      <span class="text-gray-400">{{ notables.length }} notables, {{ smalls.length }} small passives in radius</span>
      <label class="flex items-center gap-1.5 text-gray-400"><input v-model="onlyBuild" type="checkbox">Only passives my build takes</label>
      <label class="flex items-center gap-1.5 text-gray-400"><input v-model="showSmall" type="checkbox">Show small passives</label>
    </div>

    <div v-if="result" class="flex-1 min-h-0 overflow-y-auto grid gap-2 content-start" style="grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));">
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
    <p v-else-if="!error" class="text-gray-500 text-sm">
      Pick the jewel, its conqueror and the seed (the number on the jewel), then the socket. Your build's sockets are listed first.
      New or changed stats are shown in blue.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { TimelessJewelInfo, TimelessResult, TimelessSocket, TimelessNode } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { useLeagues } from '@/web/background/Leagues'
import { openTradeLink } from '@/web/desktop/trade-tab'
import { pobError } from './pob-error'

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

function tradeSearch () {
  const r = result.value
  const league = useLeagues().selectedId.value
  if (!r) return
  if (!league) {
    error.value = 'Pick a league first (price check window title).'
    return
  }
  const query = {
    query: {
      status: { option: 'online' },
      name: r.jewel,
      type: 'Timeless Jewel',
      stats: [{
        type: 'and',
        filters: [{ id: `explicit.pseudo_timeless_jewel_${r.conqueror.toLowerCase()}`, value: { min: r.seed, max: r.seed } }]
      }]
    },
    sort: { price: 'asc' }
  }
  openTradeLink(`https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}?q=${JSON.stringify(query)}`)
}
</script>
