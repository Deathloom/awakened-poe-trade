<template>
  <!-- Deathloom fork (19 Nov 2026): the build's Wickerman (3.30) with poe.ninja prices; hidden when the build has none -->
  <div v-if="viscera.length" class="px-1 pt-2 text-sm">
    <div class="flex items-center gap-x-2 text-xs text-gray-500 uppercase tracking-wide">
      <span>Wickerman</span>
      <span v-if="total != null" class="normal-case tracking-normal text-gray-400"
        title="poe.ninja prices for the Viscera this build plans (unpriced ones left out)">≈ {{ fmt(total) }} total</span>
    </div>
    <div v-for="v of viscera" :key="v.slot" class="flex items-baseline gap-x-2 px-1">
      <span class="text-gray-500 w-10 shrink-0">{{ v.slot }}</span>
      <span class="text-gray-200 truncate">{{ v.name }}</span>
      <span class="ml-auto text-xs text-gray-400 whitespace-nowrap tabular-nums" :title="v.chaos == null ? 'Not on poe.ninja (yet)' : 'poe.ninja'">
        {{ v.chaos == null ? '–' : fmt(v.chaos) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, shallowRef } from 'vue'
import { Host } from '@/web/background/IPC'
import { usePoeninja } from '@/web/background/Prices'
import type { PobBuildSummary } from '@ipc/types'
import { wickermanOf } from './loadout-steps'

const ninja = usePoeninja()
const summary = shallowRef<PobBuildSummary | null>(null)

const viscera = computed(() => {
  if (ninja.dbVersion.value < 0) return []
  return wickermanOf(summary.value).map(v => ({
    ...v,
    chaos: ninja.findPriceByQuery({ ns: 'ITEM', name: v.name, variant: undefined })?.chaos
  }))
})
const total = computed(() => {
  const priced = viscera.value.filter(v => v.chaos != null)
  return priced.length ? priced.reduce((s, v) => s + v.chaos!, 0) : null
})
function fmt (chaos: number) {
  const div = ninja.xchgRate.value
  return div && chaos >= div ? `${(chaos / div).toFixed(1)} div` : `${Math.round(chaos)} c`
}

let reqId = (Date.now() & 0x3ffffff) * 8 + 5
let buildsId = 0
let compareId = 0
const lsBuilds = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => {
  if (e.requestId !== buildsId) return
  const active = e.ok ? e.list?.active : null
  if (!active) { summary.value = null; return }
  compareId = ++reqId
  // the loadout picked in Orbhoarder, not just the one the file was saved with
  const sel = e.loadouts?.active ? { spec: e.loadouts.active.spec, itemSet: e.loadouts.active.itemSet, skillSet: e.loadouts.active.skillSet } : undefined
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-compare', payload: { requestId: compareId, a: active, b: active, selA: sel, selB: sel } })
})
const lsCompare = Host.onEvent('MAIN->CLIENT::pob-compare', (e) => {
  if (e.requestId !== compareId) return
  summary.value = e.ok ? (e.a ?? null) : null
})
onUnmounted(() => { lsBuilds.abort(); lsCompare.abort() })

function request () {
  ninja.queuePricesFetch()
  buildsId = ++reqId
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: buildsId } })
}
defineExpose({ request })
request()
</script>
