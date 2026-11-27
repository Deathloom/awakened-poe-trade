<template>
  <!-- Deathloom fork (Q6): all price alerts (above / below a price) and the ones that fired -->
  <div v-if="state.rules.length || state.fired.length" class="rounded bg-gray-900 mb-1 p-1 text-xs">
    <div class="flex items-center gap-x-2">
      <button class="ui-btn ui-btn-quiet flex items-center gap-x-1" :class="{ 'ui-btn-on': open }" :title="open ? 'Hide the list' : 'Show all price lines'" @click="open = !open">
        <i class="fas w-3" :class="open ? 'fa-chevron-down' : 'fa-chevron-right'" />
        <i class="fas fa-bell" />Price lines: {{ state.rules.length }}</button>
      <span v-if="alerts.fresh.value.length" class="text-yellow-300">{{ alerts.fresh.value.length }} new</span>
      <button class="ui-btn ui-btn-quiet ml-auto" :class="{ 'ui-btn-on': help }" title="How price lines work" @click="help = !help">?</button>
      <ui-menu v-if="!IS_OTHER_DEVICE" :items="menu" align-right title="More: Windows notification, clear the list" button-class="ui-btn-quiet" />
    </div>
    <div v-if="help" class="text-gray-400 py-1">
      Alerts are checked each time Orbhoarder refreshes poe.ninja prices (about every half hour while the price check, Market or Profit is in use; no extra downloads).
      Each alert fires once when the price crosses your line, then waits until the price is back on the other side (and at most once an hour).
      With the phone link on (Settings → Tools), a connected phone shows the alert; if no phone confirms it within a few seconds (none connected, or it's locked) you get a Windows notification instead.
      Add price lines on the PC: Market → Watched or Shopping → ⋯ → Price line above / below…
    </div>
    <div v-for="f of alerts.fresh.value" :key="f.id" class="flex items-center gap-x-2 py-px">
      <i class="fas fa-bell text-yellow-300 w-4 text-center" />
      <span class="flex-1 text-gray-200">{{ alertText(f) }}</span>
      <span class="text-gray-500">{{ when(f.at) }}</span>
      <button class="ui-btn ui-btn-quiet" title="Dismiss (on this device only)" @click="alerts.dismiss(f.id)"><i class="fas fa-check" /></button>
    </div>
    <template v-if="open">
      <div v-for="r of state.rules" :key="r.id" class="flex items-center gap-x-2 py-px">
        <span class="flex-1 truncate text-gray-300" :title="r.league">{{ r.label }} <span class="text-gray-500">{{ ruleText(r) }}</span>
          <span v-if="r.league !== league" class="text-gray-600"> · {{ r.league }}</span></span>
        <span v-if="r.last != null" class="text-gray-500">now {{ fmtAlertPrice(r.last) }} {{ unitLabel(r.unit) }}</span>
        <button v-if="!IS_OTHER_DEVICE" class="ui-btn ui-btn-quiet" title="Remove this alert" @click="alerts.remove(r.id)"><i class="fas fa-times" /></button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import UiMenu, { type UiMenuItem } from '../ui/UiMenu.vue'
import { useLeagues } from '@/web/background/Leagues'
import { alertText, ruleText, fmtAlertPrice, unitLabel } from '@ipc/price-alerts'
import { usePriceAlerts, IS_OTHER_DEVICE } from './price-alerts-store'

const alerts = usePriceAlerts()
const state = computed(() => alerts.state.value)
const leagues = useLeagues()
const league = computed(() => leagues.selectedId.value)
const open = ref(false)
const help = ref(false)

const menu = computed<UiMenuItem[]>(() => [
  {
    label: 'Windows notification even when my phone gets it',
    icon: 'fas fa-desktop',
    checked: state.value.pcAlways,
    hint: 'Off: a Windows notification only when no phone is connected',
    action: () => { alerts.setPcAlways(!state.value.pcAlways) }
  },
  { label: 'Clear fired alerts', icon: 'fas fa-broom', disabled: !state.value.fired.length, action: () => { alerts.clearFired() } }
])

function when (at: number) {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>
