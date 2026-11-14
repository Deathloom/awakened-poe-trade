<template>
  <!-- Deathloom fork: trade companion body (used by the overlay widget and the HUD window) -->
  <div class="widget-default-style flex flex-col text-gray-200 leading-tight text-sm"
    :style="fill ? { width: '100%', height: '100%' } : compact ? { width: 'var(--hud-w, 24rem)', maxHeight: 'var(--hud-h, 32rem)' } : { width: '24rem', maxHeight: '70vh' }">
    <div class="flex items-center gap-x-2 px-2 py-1 bg-gray-900 rounded-t shrink-0">
      <span class="text-gray-500 shrink-0"><i class="fas fa-handshake mr-1" />Trades</span>
      <div class="flex gap-px shrink-0">
        <button v-for="t of TABS" :key="t.key" class="px-2 rounded"
          :class="tab === t.key ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-200'"
          @click="tab = t.key">{{ t.label }}<span v-if="t.key === 'trades' && openTrades.length" class="text-yellow-400"> {{ openTrades.length }}</span></button>
      </div>
      <span class="ml-auto text-xs text-gray-500" :title="modeHelp">{{ mode === 'send' ? 'buttons send to chat' : 'buttons copy' }}</span>
    </div>

    <!-- compact (HUD window): an empty whisper list collapses to the header line -->
    <div v-if="tab === 'trades' && !(compact && !openTrades.length)" class="overflow-y-auto min-h-0 p-1">
      <div v-if="!openTrades.length" class="p-1 text-gray-500">
        No trade whispers yet. They show up here as they arrive (read from Client.txt).
      </div>
      <div v-for="t of openTrades" :key="t.id" class="rounded mb-1 p-1"
        :class="t.direction === 'from' ? 'bg-gray-900' : 'bg-gray-800'">
        <div class="flex items-baseline gap-x-2">
          <i class="fas shrink-0" :class="t.direction === 'from' ? 'fa-arrow-down text-green-500' : 'fa-arrow-up text-blue-400'"
            :title="t.direction === 'from' ? 'Someone wants to buy from you' : 'You whispered a seller'" />
          <span class="font-semibold truncate" :title="t.char">{{ t.char }}</span>
          <span v-if="inArea.has(t.char)" class="text-green-400 text-xs shrink-0">in your area</span>
          <span class="ml-auto text-gray-500 text-xs shrink-0">{{ ago(t.at) }}</span>
          <button class="text-gray-500 hover:text-gray-200 shrink-0" title="Remove" @click="dismiss(t.id)"><i class="fas fa-times" /></button>
        </div>
        <div class="truncate" :title="t.item">{{ t.item }}</div>
        <div class="flex gap-x-2 text-xs text-gray-400">
          <span class="text-yellow-300">{{ t.price }}</span>
          <span v-if="t.tab">tab "{{ t.tab.name }}" · left {{ t.tab.left }}, top {{ t.tab.top }}</span>
        </div>
        <div v-if="t.message" class="text-xs text-gray-500 truncate" :title="t.message">"{{ t.message }}"</div>
        <div class="flex flex-wrap gap-1 pt-1">
          <template v-if="t.direction === 'from'">
            <button v-for="b of SELL_BUTTONS" :key="b.label" class="bg-gray-700 hover:bg-gray-600 rounded px-1.5"
              :title="b.cmd(t.char)" @click="press(t, b.cmd(t.char), b.key)">
              <i v-if="pressed === t.id + b.key" class="fas fa-check text-green-400" /> {{ b.label }}</button>
          </template>
          <template v-else>
            <button v-for="b of BUY_BUTTONS" :key="b.label" class="bg-gray-700 hover:bg-gray-600 rounded px-1.5"
              :title="b.cmd(t.char)" @click="press(t, b.cmd(t.char), b.key)">
              <i v-if="pressed === t.id + b.key" class="fas fa-check text-green-400" /> {{ b.label }}</button>
          </template>
        </div>
      </div>
      <div v-if="!compact" class="px-1 pt-1 text-xs text-gray-600">{{ modeHelp }}</div>
    </div>

    <div v-else class="overflow-y-auto min-h-0 p-1">
      <div class="px-1 pb-1 text-xs text-gray-500">
        A trade counts when the log says "Trade accepted." while the other player is in your area.
        Prices are the listed prices from the whisper. League: {{ ledgerLeague || 'unknown' }}.
      </div>
      <div class="grid grid-cols-2 gap-x-2 px-1 pb-2">
        <div>
          <div class="text-xs uppercase text-gray-500">Sold</div>
          <div v-for="(v, cur) of totals.sold" :key="cur" class="text-green-400">{{ fmt(v) }} {{ cur }}</div>
          <div v-if="!Object.keys(totals.sold).length" class="text-gray-600">nothing yet</div>
        </div>
        <div>
          <div class="text-xs uppercase text-gray-500">Bought</div>
          <div v-for="(v, cur) of totals.bought" :key="cur" class="text-red-300">{{ fmt(v) }} {{ cur }}</div>
          <div v-if="!Object.keys(totals.bought).length" class="text-gray-600">nothing yet</div>
        </div>
      </div>
      <div v-for="e of ledgerForLeague.slice().reverse()" :key="e.id" class="flex gap-x-2 px-1">
        <span class="shrink-0" :class="e.direction === 'from' ? 'text-green-400' : 'text-red-300'">{{ e.direction === 'from' ? '+' : '−' }}{{ e.price }}</span>
        <span class="truncate flex-1" :title="e.item">{{ e.item }}</span>
        <span class="text-gray-500 text-xs shrink-0">{{ e.char }}</span>
        <button class="text-gray-600 hover:text-gray-300 shrink-0" title="Remove from ledger" @click="removeLedger(e.id)"><i class="fas fa-times" /></button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { parseLogLine, type LogEvent } from './game-log'
import { runChat, chatMode } from './chat'
import { addPrice, type TradeEntry, loadLedger, saveLedger, appendToLedger, onLedgerChange } from './ledger'

// fill: take the whole space (desktop window)
defineProps<{ compact?: boolean, fill?: boolean }>()
const emit = defineEmits<{ (e: 'incoming' | 'empty'): void }>()

const TABS = [{ key: 'trades', label: 'Whispers' }, { key: 'ledger', label: 'Ledger' }] as const
const tab = ref<'trades' | 'ledger'>('trades')

const SELL_BUTTONS = [
  { key: 'inv', label: 'Invite', cmd: (c: string) => `/invite ${c}` },
  { key: 'trade', label: 'Trade', cmd: (c: string) => `/tradewith ${c}` },
  { key: 'ty', label: 'Thanks', cmd: (c: string) => `@${c} ty, gl!` },
  { key: 'kick', label: 'Kick', cmd: (c: string) => `/kick ${c}` },
  { key: 'sold', label: 'Sold', cmd: (c: string) => `@${c} sorry, already sold` },
  { key: 'busy', label: 'Busy', cmd: (c: string) => `@${c} in a map, will invite after` }
]
const BUY_BUTTONS = [
  { key: 'ho', label: 'Hideout', cmd: (c: string) => `/hideout ${c}` },
  { key: 'ty', label: 'Thanks', cmd: (c: string) => `@${c} ty!` }
]

const trades = ref<TradeEntry[]>([])
const inArea = ref(new Set<string>())
const pressed = ref<string | null>(null)
const ledger = shallowRef<TradeEntry[]>(loadLedger())
const ledgerLeague = ref('')
let lastActive: TradeEntry | null = null
let nextId = Date.now()

const mode = computed(() => chatMode())
const modeHelp = computed(() => mode.value === 'send'
  ? 'Each click sends one command to game chat (Settings → Path of Building → Chat buttons).'
  : 'Each click copies the command: press Enter in game, Ctrl+V, Enter. To send directly, change Chat buttons in Settings → Path of Building.')

const openTrades = computed(() => trades.value.filter(t => !t.done))
// the last open trade was dealt with (Sold, dismissed, or the trade went through)
watch(() => openTrades.value.length, (n, prev) => { if (n === 0 && prev > 0) emit('empty') })

function handle (e: LogEvent) {
  if (e.type === 'trade') {
    ledgerLeague.value = e.league
    // Same player, same item: a repeated whisper, not a new trade
    const dup = trades.value.find(t => !t.done && t.char === e.char && t.item === e.item && t.direction === e.direction)
    if (dup) { dup.at = Date.now(); return }
    trades.value.unshift({
      id: String(nextId++),
      at: Date.now(),
      direction: e.direction,
      char: e.char,
      item: e.item,
      price: e.price,
      league: e.league,
      tab: e.tab,
      message: e.message
    })
    trades.value = trades.value.slice(0, 30)
    if (e.direction === 'from') emit('incoming')
  } else if (e.type === 'joined') {
    inArea.value = new Set(inArea.value).add(e.char)
  } else if (e.type === 'left') {
    const s = new Set(inArea.value); s.delete(e.char); inArea.value = s
  } else if (e.type === 'zone') {
    inArea.value = new Set()
  } else if (e.type === 'tradeResult' && e.accepted) {
    // The trade with someone in the area that was touched last; else the newest such trade
    const inAreaTrades = openTrades.value.filter(t => inArea.value.has(t.char))
    const t = (lastActive && !lastActive.done && inArea.value.has(lastActive.char) ? lastActive : null) ?? inAreaTrades[0]
    if (!t) return
    t.done = true
    ledger.value = appendToLedger({ ...t, at: Date.now() })
    trades.value = [...trades.value]
  }
}

const logListener = Host.onEvent('MAIN->CLIENT::game-log', (e) => {
  const lang = AppConfig().language
  for (const line of e.lines) {
    const ev = parseLogLine(line, lang)
    if (ev) handle(ev)
  }
})
const stopLedgerSync = onLedgerChange((list) => { ledger.value = list })
onUnmounted(() => { logListener.abort(); stopLedgerSync() })

let pressTimer: ReturnType<typeof setTimeout> | undefined
function press (t: TradeEntry, text: string, key: string) {
  lastActive = t
  runChat(text)
  pressed.value = t.id + key
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => { pressed.value = null }, 1500)
  if (key === 'sold') t.done = true
  trades.value = [...trades.value]
}

function dismiss (id: string) {
  const t = trades.value.find(x => x.id === id)
  if (t) t.done = true
  trades.value = [...trades.value]
}

const ledgerForLeague = computed(() => {
  const league = ledgerLeague.value || ledger.value[ledger.value.length - 1]?.league
  return ledger.value.filter(e => !league || e.league === league)
})

const totals = computed(() => {
  const sold: Record<string, number> = {}
  const bought: Record<string, number> = {}
  for (const e of ledgerForLeague.value) addPrice(e.direction === 'from' ? sold : bought, e.price)
  return { sold, bought }
})

function removeLedger (id: string) {
  ledger.value = loadLedger().filter(e => e.id !== id)
  saveLedger(ledger.value)
}

function fmt (n: number) { return Math.round(n * 100) / 100 }

const now = ref(Date.now())
const tick = setInterval(() => { now.value = Date.now() }, 15_000)
onUnmounted(() => { clearInterval(tick) })
function ago (at: number) {
  const s = Math.max(0, Math.round((now.value - at) / 1000))
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}
</script>
