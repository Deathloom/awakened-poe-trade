<template>
  <!-- Deathloom fork (A4): PoE2 price check. Parser, filters and trade2 search come
       from Exiled Exchange 2 (renderer/src/poe2); this file only feeds them the item. -->
  <div v-if="loadError" class="m-4 p-3 rounded bg-gray-900">
    <div class="font-bold mb-1"><i class="fas fa-exclamation-triangle mr-1" />PoE2 data could not be loaded</div>
    <p class="text-gray-400">{{ loadError }}</p>
  </div>
  <div v-else-if="!ready" class="m-4 text-gray-400"><i class="fas fa-dna fa-spin mr-1" />Loading PoE2 data…</div>
  <template v-else-if="item?.isErr()">
    <ui-error-box class="m-4">
      <template #name>{{ t(item.error.name) }}</template>
      <p>{{ item.error.format ? t(item.error.message, item.error.format) : t(item.error.message) }}</p>
    </ui-error-box>
    <pre class="bg-gray-900 rounded m-4 overflow-x-hidden p-2">{{ item.error.rawText }}</pre>
  </template>
  <template v-else-if="item?.isOk()">
    <unidentified-resolver :item="item.value" @identify="item = ok($event)" />
    <checked-item v-if="isLeagueSelected" :item="item.value" :advanced-check="advancedCheck" />
  </template>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type Result, ok, err } from 'neverthrow'
import UiErrorBox from '@/web/ui/UiErrorBox.vue'
import { useLeagues } from '@/web/background/Leagues'
import { addMissingMessages } from '@/web/i18n'
import { AppConfig } from '@/web/Config'
import { init as initPoe2Data } from '@/poe2/assets/data'
import { ItemCategory, ItemRarity, parseClipboard, type ParsedItem } from '@/poe2/parser'
import { usePoeninja } from '@/poe2/web/background/Prices'
import CheckedItem from '@/poe2/web/price-check/CheckedItem.vue'
import UnidentifiedResolver from '@/poe2/web/price-check/unidentified-resolver/UnidentifiedResolver.vue'

type ParseError = { name: string, message: string, rawText: string, format?: string[] }

const props = defineProps<{
  clipboard: string
  advancedCheck: boolean
  // changes on every check, so the same text checked twice is parsed again
  checkId: number
}>()

const { t } = useI18n()
const leagues = useLeagues()
const isLeagueSelected = computed(() => Boolean(leagues.selectedId.value))

// the PoE2 data (several MB) loads the first time a PoE2 item is checked, once
let dataLoad: Promise<void> | undefined
function loadData () {
  dataLoad ??= Promise.all([
    initPoe2Data(AppConfig().language),
    addMissingMessages(`${import.meta.env.BASE_URL}data/poe2/en/app_i18n.json`)
  ]).then(() => undefined)
  return dataLoad
}

const ready = shallowRef(false)
const loadError = shallowRef<string | null>(null)
const item = shallowRef<null | Result<ParsedItem, ParseError>>(null)

watch(() => [props.clipboard, props.checkId], async () => {
  try {
    await loadData()
    ready.value = true
  } catch (e) {
    dataLoad = undefined
    loadError.value = (e as Error).message
    return
  }
  const clipboard = props.clipboard
  item.value = parseClipboard(clipboard)
    .andThen(item => (
      (item.category === ItemCategory.HeistContract || item.category === ItemCategory.Sentinel) &&
      item.rarity !== ItemRarity.Unique)
      ? err('item.unknown')
      : ok(item))
    .mapErr((e: string) => {
      if (e.startsWith('item.wrong_language')) {
        const [name, gameLang, appLang] = e.split('|')
        return { name, message: `${name}_help`, rawText: clipboard, format: [gameLang, appLang] }
      }
      return { name: e, message: `${e}_help`, rawText: clipboard }
    })
  if (item.value.isOk()) {
    usePoeninja().queuePricesFetch()
  }
}, { immediate: true })
</script>
