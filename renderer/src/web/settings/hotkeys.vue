<template>
  <div class="max-w-md p-2">
    <div class="mb-2 bg-gray-700 rounded px-2 py-1 leading-none">
      <i class="fas fa-info-circle"></i> {{ t('settings.clear_hotkey') }}
    </div>
    <div class="flex flex-col gap-4 mb-8">
      <HotkeysGeneric :hotkeys="hotkeys" />
    </div>
    <!-- Deathloom fork: panel and Path of Building hotkeys -->
    <div class="mb-8">
      <div class="mb-2">Orbhoarder panels</div>
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Build gear panel</span>
        <hotkey-input v-model="pob.gearPanelKey" class="w-48" />
      </div>
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Campaign guide</span>
        <hotkey-input v-model="pob.guideKey" class="w-48" />
      </div>
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Trade companion</span>
        <hotkey-input v-model="pob.tradesKey" class="w-48" />
      </div>
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Market search <span class="text-gray-500 text-sm">(optional)</span></span>
        <hotkey-input :modelValue="pob.marketSearchKey ?? null" class="w-48" @update:modelValue="v => { pob.marketSearchKey = v }" />
      </div>
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Friends' trade board <span class="text-gray-500 text-sm">(optional)</span></span>
        <hotkey-input :modelValue="pob.boardKey ?? null" class="w-48" @update:modelValue="v => { pob.boardKey = v }" />
      </div>
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Post hovered item to the friends' trade board <span class="text-gray-500 text-sm">(optional)</span></span>
        <hotkey-input :modelValue="pob.boardPostKey ?? null" class="w-48" @update:modelValue="v => { pob.boardPostKey = v }" />
      </div>
      <div v-for="p of EXTRA_PANELS" :key="p.panel" class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">{{ p.label }} <span class="text-gray-500 text-sm">(optional)</span></span>
        <hotkey-input :modelValue="pob.panelKeys?.[p.panel] ?? null" class="w-48" @update:modelValue="v => setPanelKey(p.panel, v)" />
      </div>
      <div class="flex items-center gap-x-2 mb-1">
        <span class="flex-1">Open Path of Building</span>
        <hotkey-input v-model="pob.openPobKey" class="w-48" />
      </div>
      <div class="text-gray-500 text-sm mb-1">
        Each hotkey shows or hides its panel. A panel pinned over the game (Settings → Panels) toggles over
        the game without opening the overlay. Defaults: Ctrl+G, Ctrl+H, Ctrl+T; Ctrl+P opens Path of Building.
        The other panels have no hotkey until you set one (pick keys the game doesn't use).
      </div>
      <div class="text-gray-500 text-sm">Chat command hotkeys are with their commands in Settings → Chat.</div>
    </div>
    <div class="mb-8 flex">
      <label class="flex-1">{{ t('settings.stash_scroll') }}</label>
      <div class="flex gap-x-4">
        <ui-radio v-model="stashScroll" :value="true" class="font-poe">Ctrl + MouseWheel</ui-radio>
        <ui-radio v-model="stashScroll" :value="false">{{ t('Disabled') }}</ui-radio>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'settings.hotkeys'
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { configProp, configModelValue, _configModelValue, findWidget } from './utils'
import { PriceCheckWidget, DelveGridWidget } from '@/web/overlay/interfaces'
import { ItemCheckWidget } from '../item-check/widget.js'

import UiRadio from '@/web/ui/UiRadio.vue'
import HotkeyInput from './HotkeyInput.vue'
import { EXTRA_PANELS } from '@/web/desktop/panel-defs'
import type { HudPanel } from '@ipc/types'
import { usePobConfig } from './pob-config'
import HotkeysGeneric, { HotkeySchema } from '../settings/HotkeysGeneric.vue'

const props = defineProps(configProp())

const hotkeys = computed<HotkeySchema[]>(() => {
  const priceCheckWidget = findWidget<PriceCheckWidget>('price-check', props.config)!
  const itemCheckWidget = findWidget<ItemCheckWidget>('item-check', props.config)!
  const delveGridWidget = findWidget<DelveGridWidget>('delve-grid', props.config)!
  return [{
    translationKey: 'price_check.name',
    items: [{
      translationKey: 'price_check.hotkey',
      config: {
        modKey: _configModelValue(priceCheckWidget, 'hotkeyHold'),
        nonModKey: _configModelValue(priceCheckWidget, 'hotkey')
      }
    }, {
      translationKey: 'price_check.hotkey_locked',
      config: _configModelValue(priceCheckWidget, 'hotkeyLocked')
    }]
  }, {
    translationKey: 'settings.overlay',
    config: _configModelValue(props.config, 'overlayKey'),
    required: true
  }, {
    translationKey: 'map_check.name',
    config: _configModelValue(itemCheckWidget, 'hotkey')
  }, {
    translationKey: 'item.info',
    config: _configModelValue(itemCheckWidget, 'hotkey')
  }, {
    translationKey: 'settings.delve_grid',
    config: _configModelValue(delveGridWidget, 'toggleKey')
  }]
})

const pob = usePobConfig(() => props.config)
function setPanelKey (panel: HudPanel, key: string | null) {
  pob.value.panelKeys = { ...pob.value.panelKeys, [panel]: key }
}

const stashScroll = configModelValue(() => props.config, 'stashScroll')

const { t } = useI18n()
</script>
