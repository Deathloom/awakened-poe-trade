<template>
  <!-- Deathloom fork (Q19): profit-drop nudge for the strategy you're farming now -->
  <div v-if="drop && !hidden" class="flex items-start gap-1 text-yellow-300">
    <i class="fas fa-chart-line mt-0.5" />
    <span class="flex-1 min-w-0">
      {{ drop.strategy }} is down {{ Math.round(drop.drop * 100) }} %: your last {{ drop.maps }} maps made {{ money(drop.recent) }}/h, before that {{ money(drop.usual) }}/h.
      <template v-if="drop.better"> {{ drop.better.name }} made {{ money(drop.better.perHour) }}/h over {{ drop.better.maps }} maps in the last 2 weeks.</template>
      <template v-else> Prices may have dropped, or the maps got slower.</template>
    </span>
    <button class="ui-btn ui-btn-quiet" title="Hide this until tomorrow" @click="hide">Not now</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMarket } from './use-market'
import { profitDrop, nudgeDismissed, dismissNudge, type FarmRun } from './market-tools'

const props = defineProps<{ runs: FarmRun[], strategy: string }>()
const { money } = useMarket()
const drop = computed(() => profitDrop(props.runs, props.strategy, Date.now()))
const tick = ref(0)
const hidden = computed(() => tick.value >= 0 && drop.value != null && nudgeDismissed(drop.value.strategy, Date.now()))
function hide () {
  if (drop.value) dismissNudge(drop.value.strategy, Date.now())
  tick.value += 1
}
</script>
