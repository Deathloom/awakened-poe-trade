<template>
  <!-- Deathloom fork (Q6): price alerts for one item (above / below a price), shown under its row -->
  <div class="text-xs py-1">
    <div v-for="r of rules" :key="r.id" class="flex items-center gap-2 py-px">
      <i class="fas fa-bell text-gray-500 w-4 text-center" />
      <span class="flex-1 text-gray-300">Alert when {{ ruleText(r) }}<span v-if="r.armed === false" class="text-gray-500"> · fired, waits for the price to come back</span></span>
      <button v-if="!IS_OTHER_DEVICE" class="ui-btn ui-btn-quiet" title="Remove this alert" @click="alerts.remove(r.id)"><i class="fas fa-times" /></button>
    </div>
    <div v-if="IS_OTHER_DEVICE" class="text-gray-500 py-px">Add or remove price alerts on the PC.</div>
    <div v-else class="flex flex-wrap items-center gap-1 py-px">
      <span class="text-gray-400">Tell me when it goes</span>
      <select v-model="dir" class="rounded px-1">
        <option value="above">above</option>
        <option value="below">below</option>
      </select>
      <input v-model.number="value" type="number" min="0" step="any" class="rounded px-1 w-20" @keydown.enter="add">
      <select v-model="unit" class="rounded px-1">
        <option value="chaos">chaos</option>
        <option value="div">divine</option>
      </select>
      <button class="ui-btn" :disabled="!canAdd" @click="add">Add</button>
      <span v-if="nowText" class="text-gray-500">now {{ nowText }}</span>
    </div>
    <div v-if="warning" class="text-gray-500 py-px">{{ warning }}</div>
    <div v-if="alerts.error.value" class="text-red-400 py-px">{{ alerts.error.value }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePoeninja } from '@/web/background/Prices'
import { useLeagues } from '@/web/background/Leagues'
import { ruleText, fmtAlertPrice, type PriceAlertDir, type PriceAlertUnit } from '@ipc/price-alerts'
import { usePriceAlerts, IS_OTHER_DEVICE } from './price-alerts-store'

const props = defineProps<{
  item: { type?: string, name: string, variant?: string, label: string }
  // poe.ninja price now (chaos)
  chaos?: number | null
}>()

const alerts = usePriceAlerts()
const ninja = usePoeninja()
const leagues = useLeagues()
const league = computed(() => leagues.selectedId.value)
const rules = computed(() => alerts.rulesFor(league.value, props.item.type, props.item.name, props.item.variant))

const divine = computed(() => ninja.xchgRate.value)
const unit = ref<PriceAlertUnit>(props.chaos != null && divine.value && props.chaos >= divine.value ? 'div' : 'chaos')
const dir = ref<PriceAlertDir>('above')
const value = ref<number | ''>('')

// the price now in the picked unit
const nowIn = computed(() => {
  if (props.chaos == null) return null
  if (unit.value === 'chaos') return props.chaos
  return divine.value ? props.chaos / divine.value : null
})
const nowText = computed(() => nowIn.value == null ? '' : `${fmtAlertPrice(nowIn.value)} ${unit.value === 'div' ? 'div' : 'c'}`)
const canAdd = computed(() => Boolean(props.item.type && league.value && typeof value.value === 'number' && value.value > 0))
// already past the line: it only fires after the price comes back and crosses again
const warning = computed(() => {
  if (typeof value.value !== 'number' || nowIn.value == null) return ''
  const past = dir.value === 'above' ? nowIn.value >= value.value : nowIn.value <= value.value
  return past ? `It's already ${dir.value} that: the alert fires the next time it crosses.` : ''
})

function add () {
  if (!canAdd.value || typeof value.value !== 'number' || !props.item.type || !league.value) return
  alerts.add({
    league: league.value,
    type: props.item.type,
    name: props.item.name,
    variant: props.item.variant,
    label: props.item.label,
    dir: dir.value,
    value: value.value,
    unit: unit.value
  })
  value.value = ''
}
</script>
