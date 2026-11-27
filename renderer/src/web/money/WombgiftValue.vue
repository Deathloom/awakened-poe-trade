<template>
  <!-- Deathloom fork (Q14): Wombgift value: open at the Genesis Tree or sell?
       Sell = poe.ninja price; open = average of what your own openings were worth. -->
  <div class="flex-1 min-h-0 flex flex-col">
    <div class="flex-1 min-h-0 overflow-y-auto px-2">
      <table class="w-full">
        <tr class="text-gray-500 sticky top-0 bg-gray-800">
          <th class="text-left font-normal">Wombgift</th>
          <th class="text-right font-normal pr-2" title="poe.ninja price: what selling it gets you">Sell</th>
          <th class="text-right font-normal pr-2" title="Average worth of what your openings gave (your log)">Opened</th>
          <th class="text-left font-normal pl-1">Do</th>
        </tr>
        <template v-for="r of rows" :key="r.name">
          <tr class="hover:bg-gray-700 cursor-pointer" :class="{ 'bg-gray-700': picked === r.name }" @click="pick(r.name)">
            <td class="truncate max-w-0 w-full">{{ r.name }}</td>
            <td class="text-right pr-2 font-mono">{{ r.sell == null ? '–' : money(r.sell) }}</td>
            <td class="text-right pr-2 font-mono" :title="r.opens ? `${r.opens} opening(s) logged` : 'Not logged yet'">
              {{ r.avgOpen == null ? '–' : money(r.avgOpen) }}<span class="text-gray-500"> ×{{ r.opens }}</span></td>
            <td class="pl-1 whitespace-nowrap" :class="r.verdict === 'open' ? 'text-green-400' : r.verdict === 'sell' ? 'text-yellow-300' : 'text-gray-500'"
              :title="r.verdict === 'log' ? `Log at least ${MIN_OPENS} openings to get a verdict` : ''">
              {{ r.verdict === 'open' ? 'Open' : r.verdict === 'sell' ? 'Sell' : 'log more' }}</td>
          </tr>
          <tr v-if="picked === r.name">
            <td colspan="4" class="pb-1">
              <div class="flex items-center gap-1 pl-2">
                <span class="text-gray-400">Opened one, got worth</span>
                <input v-model.number="worth" type="number" min="0" class="w-16 bg-gray-900 rounded px-1 text-right" placeholder="0"
                  @keydown.enter="add(r.name)" @click.stop>
                <span class="text-gray-400">c</span>
                <button class="ui-btn" :disabled="!Number.isFinite(worth) || worth < 0" @click.stop="add(r.name)">Log</button>
                <button v-if="r.opens" class="ui-btn ui-btn-quiet" title="Remove the last logged opening" @click.stop="undo(r.name)"><i class="fas fa-undo" /></button>
                <a v-if="r.url" class="ml-auto text-gray-500 hover:text-gray-300" href="#" @click.prevent.stop="open(r.url)">poe.ninja</a>
              </div>
            </td>
          </tr>
        </template>
      </table>
      <div v-if="!rows.length" class="text-gray-500 py-1">poe.ninja has no Wombgift prices for this league.</div>
    </div>
    <div class="px-2 py-1 text-gray-500 shrink-0">
      <i class="fas fa-info-circle mr-1" />What a Wombgift gives is random and GGG doesn't publish odds. Click a row, open one at the Genesis Tree, price check what came out and log the total. Hiveblood isn't counted. Last {{ KEEP_PER_KIND }} per kind, kept on this PC.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { NinjaListing } from '@/web/background/Prices'
import { LOG_KEY, KEEP_PER_KIND, MIN_OPENS, loadLog, saveLog, addOpening, undoOpening, valueWombgifts, type OpenLog } from './wombgift'

const props = defineProps<{ items: NinjaListing[], money: (chaos: number) => string }>()
const money = props.money

const log = ref<OpenLog>(loadLog())
const onStorage = (e: StorageEvent) => { if (e.key === LOG_KEY) log.value = loadLog() }
window.addEventListener('storage', onStorage)
onUnmounted(() => { window.removeEventListener('storage', onStorage) })

const rows = computed(() => valueWombgifts(props.items, log.value))
const picked = ref<string | null>(null)
const worth = ref<number>(NaN)
function pick (name: string) {
  picked.value = picked.value === name ? null : name
  worth.value = NaN
}
function add (name: string) {
  if (!Number.isFinite(worth.value) || worth.value < 0) return
  const next = addOpening(loadLog(), name, worth.value)
  saveLog(next)
  log.value = next
  worth.value = NaN
}
function undo (name: string) {
  const next = undoOpening(loadLog(), name)
  saveLog(next)
  log.value = next
}
function open (url: string) { window.open(url) }
</script>
