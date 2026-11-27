<template>
  <!-- Deathloom fork (Q11): loot filter add-on settings (part 1 is Market → Shopping ⋯ → Make loot filter add-on…) -->
  <div class="max-w-2xl p-2 text-sm">
    <div class="text-base mb-1">Loot filter add-on</div>
    <div class="text-gray-500 mb-2">
      Orbhoarder writes <i>"your filter + Orbhoarder.filter"</i> next to your filter: big, highlighted Show blocks for what your
      build still needs (Market → Shopping: uniques by base type, the rares' bases, gems), then your filter unchanged. Your own file is never changed.
      In game: <b>Options → UI → Item filter</b>. Changes here apply straight away (no need to press Save).
    </div>
    <div v-if="otherDevice" class="text-yellow-300">Only on the PC.</div>
    <template v-else>
      <div class="flex items-center gap-2 mb-1">
        <span>Your filter</span>
        <button class="ml-auto ui-btn ui-btn-quiet" :disabled="busy" title="Look in the folder again" @click="list"><i class="fas fa-sync-alt" :class="{ 'fa-spin': busy }" /></button>
      </div>
      <div v-if="error" class="text-red-400 mb-1">{{ error }}</div>
      <div v-else-if="!busy && !filters.length" class="text-gray-500 mb-1">No .filter files in {{ folder || 'the game folder' }}. Download your filter there first (online filters from the website can't be used).</div>
      <div class="flex flex-col gap-0.5 mb-1">
        <label v-for="f of filters" :key="f" class="flex items-center gap-2">
          <input type="radio" name="lf-source" :value="f" :checked="settings.source === f" @change="setLfSettings({ source: f })">{{ f.replace(/\.filter$/i, '') }}</label>
        <div v-if="settings.source && !busy && filters.length && !filters.includes(settings.source)" class="text-yellow-300">{{ settings.source }} is no longer in the folder: pick another.</div>
      </div>
      <div v-if="folder" class="text-gray-600 truncate mb-3" :title="folder">{{ folder }}</div>

      <ui-toggle :modelValue="settings.auto" :disabled="!settings.source" @update:modelValue="(on: boolean) => setLfSettings({ auto: on })">Keep it updated when the Shopping list changes</ui-toggle>
      <div class="text-gray-500 mt-1 mb-3">
        Writes the add-on again a few seconds after the list changes: you tick something as got, or switch builds. Orbhoarder works the list out
        while Market → Shopping is open (in any window, pinned too). The game only reads a filter when you pick it or press reload, so reload it in
        <b>Options → UI → Item filter</b> to see changes. When everything is ticked, the add-on is just your filter.
      </div>

      <div class="flex items-center gap-2">
        <button class="ui-btn" :disabled="!settings.source || !last" :title="last ? `The list from ${last.build || 'your build'}` : 'Open Market → Shopping once first'" @click="updateNow">
          <i class="fas fa-filter mr-1" />Update now</button>
        <span v-if="last" class="text-gray-500">List: {{ count(last.wants) }} name{{ count(last.wants) === 1 ? '' : 's' }}<template v-if="last.build"> from {{ last.build }}</template>, {{ ago(last.at) }}.</span>
        <span v-else class="text-gray-500">Open Market → Shopping once so Orbhoarder knows the list.</span>
      </div>
      <div v-if="status" class="mt-1" :class="status.ok ? 'text-green-400' : 'text-red-400'">
        <template v-if="status.ok">{{ status.unchanged ? 'Already up to date' : 'Wrote' }} <b>{{ status.written }}</b> ({{ status.count ?? 0 }} name{{ status.count === 1 ? '' : 's' }}), {{ ago(status.at) }}{{ status.auto ? ', automatically' : '' }}.</template>
        <template v-else>{{ ago(status.at) }}: {{ status.error }}</template>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, onUnmounted, ref } from 'vue'
import { Host } from '@/web/background/IPC'
import UiToggle from '@/web/ui/UiToggle.vue'
import { configProp } from './utils'
import { wantsCount, type LootFilterWants } from '@ipc/loot-filter'
import { lfSettings, lfStatus, lfLastWants, setLfSettings, updateAddon } from '../market-history/loot-filter-store'
import { IS_OTHER_DEVICE } from '../market-history/price-alerts-store'

export default defineComponent({
  name: 'Loot filter',
  components: { UiToggle },
  props: configProp(),
  setup () {
    const busy = ref(false)
    const error = ref('')
    const folder = ref('')
    const filters = ref<string[]>([])
    let reqId = 0

    const off = Host.onEvent('MAIN->CLIENT::loot-filter', (e) => {
      if (e.requestId !== reqId) return
      busy.value = false
      error.value = e.ok ? '' : (e.error ?? 'Something went wrong.')
      if (e.folder) folder.value = e.folder
      filters.value = e.filters ?? []
    })
    onUnmounted(() => { off.abort() })
    function list () {
      if (IS_OTHER_DEVICE) return
      busy.value = true
      reqId = 700000 + Math.floor(Math.random() * 90000)
      Host.sendEvent({ name: 'CLIENT->MAIN::loot-filter', payload: { requestId: reqId, op: 'list' } })
    }
    list()

    function updateNow () {
      const s = lfSettings.value
      const last = lfLastWants.value
      if (s.source && last) updateAddon(s.source, last.wants, false)
    }
    function ago (iso: string): string {
      const min = Math.round((Date.now() - Date.parse(iso)) / 60000)
      if (!Number.isFinite(min)) return ''
      if (min < 1) return 'just now'
      if (min < 60) return `${min} min ago`
      if (min < 48 * 60) return `${Math.round(min / 60)} h ago`
      return iso.slice(0, 10)
    }
    const count = (w: LootFilterWants) => wantsCount(w)

    return { otherDevice: IS_OTHER_DEVICE, busy, error, folder, filters, list, settings: lfSettings, status: lfStatus, last: lfLastWants, setLfSettings, updateNow, ago, count }
  }
})
</script>
