<template>
  <!-- Deathloom fork (Q26): crash and slowness watch (main/src/HealthWatch.ts). Local only. -->
  <div>
    <div class="text-base mb-1">Speed and crashes</div>
    <div class="text-gray-500 mb-2">
      How fast Path of Building and the trade site answered this week, and Path of Building crashes. Kept on this PC only
      (<code>apt-data/health-watch.json</code>, last 7 days); nothing is sent anywhere.
    </div>
    <div v-if="otherDevice" class="text-yellow-300">Only on the PC.</div>
    <template v-else-if="report">
      <ui-toggle :modelValue="report.warn" @update:modelValue="(on: boolean) => send('settings', on)">Show a short notice over the game when PoB crashes, times out or is very slow</ui-toggle>

      <div class="mt-2 mb-1 font-semibold">Hints</div>
      <div v-if="!report.hints.length" class="text-green-400">Nothing to fix.</div>
      <div v-for="h of report.hints" :key="h.k + h.text" class="mb-2">
        <div :class="h.level === 'warn' ? 'text-yellow-300' : 'text-gray-200'"><i class="fas fa-exclamation-triangle mr-1" v-if="h.level === 'warn'" />{{ h.text }}</div>
        <div class="text-gray-400">{{ h.fix }}</div>
      </div>

      <div class="mt-3 mb-1 font-semibold">Last 7 days</div>
      <table class="w-full">
        <thead class="text-gray-500 text-left">
          <tr><th class="font-normal">What</th><th class="font-normal text-right">Times</th><th class="font-normal text-right">Middle</th><th class="font-normal text-right">Slowest 10 %</th><th class="font-normal text-right">Slow</th><th class="font-normal text-right">Failed</th></tr>
        </thead>
        <tbody>
          <tr v-for="s of report.summary" :key="s.k">
            <td>{{ name(s.k) }}</td>
            <td class="text-right">{{ s.count }}</td>
            <template v-if="s.k === 'pob-crash'"><td colspan="3" /></template>
            <template v-else>
              <td class="text-right">{{ s.count ? secs(s.median) : '–' }}</td>
              <td class="text-right">{{ s.count ? secs(s.p90) : '–' }}</td>
              <td class="text-right" :class="{ 'text-yellow-300': s.slow }">{{ s.slow }}</td>
            </template>
            <td class="text-right" :class="{ 'text-red-400': s.fails }">{{ s.fails }}</td>
          </tr>
        </tbody>
      </table>

      <template v-if="report.recent.length">
        <div class="mt-3 mb-1 font-semibold">Recent problems</div>
        <div v-for="r of report.recent" :key="r.at + r.k" class="text-gray-400">
          {{ when(r.at) }} · {{ name(r.k) }}{{ r.what ? ` (${r.what})` : '' }}{{ r.timeout ? ': no answer in time' : r.k === 'pob-crash' ? '' : ': failed' }}
        </div>
      </template>

      <div class="flex gap-2 mt-3">
        <button class="ui-btn" @click="send('report')"><i class="fas fa-sync-alt mr-1" />Refresh</button>
        <button class="ui-btn ui-btn-quiet" @click="send('clear')">Clear</button>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, onUnmounted, shallowRef } from 'vue'
import { Host } from '@/web/background/IPC'
import UiToggle from '@/web/ui/UiToggle.vue'
import { healthKindName, secs, type HealthKind } from '@ipc/health-watch'
import type { IpcEventPayload } from '@ipc/types'
import { IS_OTHER_DEVICE } from '../market-history/price-alerts-store'

export default defineComponent({
  name: 'SpeedWatch',
  components: { UiToggle },
  setup () {
    const report = shallowRef<IpcEventPayload<'MAIN->CLIENT::health'> | null>(null)
    const off = Host.onEvent('MAIN->CLIENT::health', (e) => { report.value = e })
    onUnmounted(() => { off.abort() })

    function send (op: 'report' | 'settings' | 'clear', warn?: boolean) {
      if (IS_OTHER_DEVICE) return
      Host.sendEvent({ name: 'CLIENT->MAIN::health', payload: { op, warn } })
    }
    send('report')

    const when = (at: number) => new Date(at).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    const name = (k: HealthKind) => healthKindName(k)

    return { otherDevice: IS_OTHER_DEVICE, report, send, secs, when, name }
  }
})
</script>
