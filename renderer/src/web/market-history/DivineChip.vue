<template>
  <!-- Deathloom fork (20 Nov): divine ratio + wallet in the Market header; click for a converter -->
  <div ref="root" class="relative shrink-0">
    <button class="ui-btn ui-btn-quiet" :class="{ 'ui-btn-on': open }" :disabled="!divine"
      :title="divine ? 'Divine price, your wallet and a chaos ↔ divine converter' : 'Waiting for poe.ninja prices'" @click="open = !open">
      <span class="text-yellow-300">1 div = {{ divine ? Math.round(divine) : '…' }} c</span>
      <price-spark v-if="series.length > 1" :series="series" :width="36" />
      <span v-if="wallet.chaos > 0" class="text-gray-400">· {{ money(wallet.chaos) }}</span>
    </button>
    <div v-if="open && divine" class="absolute right-0 z-50 mt-1 w-64 rounded bg-gray-800 border border-gray-600 shadow-lg p-2 text-xs space-y-2">
      <div>
        <div class="text-gray-400 mb-0.5">Divine Orb, last {{ series.length }} days</div>
        <div class="flex items-center gap-2">
          <price-spark :series="series" :width="120" :height="24" />
          <span :class="change >= 0 ? 'text-green-400' : 'text-red-400'">{{ change >= 0 ? '+' : '' }}{{ change.toFixed(1) }}%</span>
        </div>
      </div>
      <div>
        <div class="text-gray-400 mb-0.5">Convert</div>
        <div class="flex items-center gap-1">
          <input v-model.number="amount" type="number" min="0" class="w-20 bg-gray-900 rounded px-1 text-right">
          <select v-model="from" class="bg-gray-900 rounded px-1"><option value="chaos">chaos</option><option value="div">divine</option></select>
          <span class="text-gray-400">=</span>
          <span class="text-yellow-300">{{ converted }}</span>
        </div>
      </div>
      <div>
        <div class="text-gray-400 mb-0.5">Wallet (Money tools → Currency counter)</div>
        <div v-if="wallet.chaos > 0" class="text-gray-200">{{ money(wallet.chaos) }}<span class="text-gray-500"> ({{ Math.round(wallet.chaos) }} c)</span></div>
        <div v-else class="text-gray-500">Type what's in your stash in Money tools → Currency counter to see your total here.</div>
        <div v-if="wallet.missing.length" class="text-gray-500">No price for: {{ wallet.missing.join(', ') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import PriceSpark from './PriceSpark.vue'
import { useMarket } from './use-market'
import { convert, divineSeries } from './market-tools'
import { COUNTER_KEY, counterTotal, loadCounter } from '../money/money'

const { divine, itemIndex, itemPrice, money } = useMarket()
const open = ref(false)
const amount = ref(100)
const from = ref<'chaos' | 'div'>('chaos')
const series = computed(() => divineSeries(itemIndex.value.get('Divine Orb') ?? null))
const change = computed(() => series.value.length > 1 ? (series.value[series.value.length - 1] / series.value[0] - 1) * 100 : 0)
const converted = computed(() => {
  const v = convert(Number(amount.value), from.value, divine.value)
  if (v == null) return '–'
  return from.value === 'chaos' ? `${(Math.round(v * 100) / 100)} div` : `${Math.round(v)} c`
})
const counter = shallowRef(loadCounter())
const wallet = computed(() => counterTotal(counter.value, itemPrice))

const root = ref<HTMLElement | null>(null)
function onDoc (e: MouseEvent) { if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false }
function onStorage (e: StorageEvent) { if (e.key === COUNTER_KEY) counter.value = loadCounter() }
onMounted(() => { document.addEventListener('mousedown', onDoc); window.addEventListener('storage', onStorage) })
onUnmounted(() => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('storage', onStorage) })
</script>
