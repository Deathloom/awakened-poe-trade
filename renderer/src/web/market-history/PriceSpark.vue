<template>
  <!-- Deathloom fork (20 Nov): tiny 7-day price line (poe.ninja), green up / red down -->
  <svg v-if="pts" :width="width" :height="height" class="inline-block align-middle shrink-0">
    <title>{{ title }}</title>
    <polyline :points="pts" fill="none" stroke-width="1.2" :style="{ stroke: up ? 'rgb(var(--gn-500))' : 'rgb(var(--r-500))' }" />
  </svg>
  <span v-else class="inline-block shrink-0" :style="{ width: width + 'px' }" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NinjaListing } from '@/web/background/Prices'
import { trendOf } from './market-trends'

const props = withDefaults(defineProps<{ item?: NinjaListing | null, series?: number[], width?: number, height?: number }>(), { width: 56, height: 14 })
const data = computed(() => props.series ?? (props.item ? trendOf(props.item)?.series : undefined) ?? [])
const up = computed(() => data.value.length > 1 && data.value[data.value.length - 1] >= data.value[0])
const title = computed(() => {
  const d = data.value
  if (d.length < 2) return ''
  const pct = (d[d.length - 1] / d[0] - 1) * 100
  return `${d.length} days: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
})
const pts = computed(() => {
  const d = data.value
  if (d.length < 2) return ''
  const min = Math.min(...d)
  const span = Math.max(...d) - min || 1
  const w = props.width - 2
  const h = props.height - 2
  return d.map((p, i) => `${(i / (d.length - 1) * w + 1).toFixed(1)},${(h + 1 - (p - min) / span * h).toFixed(1)}`).join(' ')
})
</script>
