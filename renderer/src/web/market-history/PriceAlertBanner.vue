<template>
  <!-- Deathloom fork (Q6): price alerts that fired, at the top of the Orbhoarder window
       and of a phone opened with the QR link. Dismiss only hides them on this device. -->
  <div v-if="alerts.fresh.value.length" class="px-3 py-1 bg-gray-900 border-b border-gray-700 text-sm shrink-0">
    <div v-for="f of shown" :key="f.id" class="flex items-center gap-x-2 py-px">
      <i class="fas fa-bell text-yellow-300" />
      <span class="flex-1 min-w-0 text-gray-100">{{ alertText(f) }}</span>
      <span class="text-xs text-gray-500 shrink-0">{{ when(f.at) }}</span>
      <button class="ui-btn ui-btn-quiet shrink-0" title="Dismiss (on this device only)" @click="alerts.dismiss(f.id)"><i class="fas fa-check" /></button>
    </div>
    <div v-if="alerts.fresh.value.length > 1" class="flex">
      <span v-if="alerts.fresh.value.length > shown.length" class="text-xs text-gray-500">+{{ alerts.fresh.value.length - shown.length }} more</span>
      <button class="ui-btn ui-btn-quiet ml-auto text-xs" @click="alerts.dismissAll()">Dismiss all</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted } from 'vue'
import { Host } from '@/web/background/IPC'
import { alertText } from '@ipc/price-alerts'
import { usePriceAlerts, IS_OTHER_DEVICE } from './price-alerts-store'

const alerts = usePriceAlerts()
const shown = computed(() => alerts.fresh.value.slice(0, 3))

// a phone buzzes once when an alert comes in (the PC gets a Windows notification from main)
const off = Host.onEvent('MAIN->CLIENT::price-alert-fired', () => {
  if (!IS_OTHER_DEVICE) return
  try { navigator.vibrate?.([200, 100, 200]) } catch {}
})
onUnmounted(() => { off.abort() })

function when (at: number) {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
</script>
