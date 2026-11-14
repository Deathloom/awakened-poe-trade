<template>
  <!-- Deathloom fork: the official trade site in the Loot Goblin window.
       Its own session: sign in on GGG's own page; Loot Goblin never sees your
       login and never clicks or types on the page for you. -->
  <div class="flex flex-col h-full min-h-0 rounded bg-gray-800">
    <div class="flex items-center gap-x-1 px-2 py-1 border-b border-gray-700 shrink-0 text-sm">
      <button class="px-2 rounded hover:bg-gray-700 disabled:opacity-40" :disabled="!canBack" title="Back" @click="view?.goBack()"><i class="fas fa-arrow-left" /></button>
      <button class="px-2 rounded hover:bg-gray-700 disabled:opacity-40" :disabled="!canForward" title="Forward" @click="view?.goForward()"><i class="fas fa-arrow-right" /></button>
      <button class="px-2 rounded hover:bg-gray-700" title="Reload" @click="view?.reload()"><i class="fas fa-redo" /></button>
      <button class="px-2 rounded hover:bg-gray-700" :title="`Trade search for ${league || 'your league'}`" @click="go(home)"><i class="fas fa-home" /></button>
      <button class="px-2 rounded hover:bg-gray-700" title="Bulk item exchange" @click="go(exchange)"><i class="fas fa-exchange-alt" /></button>
      <div class="flex-1 min-w-0 truncate px-2 text-gray-400" :title="url">{{ shortUrl }}</div>
      <i v-if="loading" class="fas fa-circle-notch fa-spin text-gray-500" />
      <button class="px-2 rounded hover:bg-gray-700" title="Open this page in your browser" @click="openExternal"><i class="fas fa-external-link-alt" /></button>
    </div>
    <div class="px-3 py-0.5 text-xs text-gray-500 bg-gray-900 shrink-0">
      GGG's own trade site, signed in separately from your browser. Loot Goblin never sees your login.
      "Whisper" and "Travel to Hideout" are GGG's own buttons here. Not affiliated with Grinding Gear Games.
    </div>
    <webview ref="webviewEl" class="flex-1 min-h-0" :partition="PARTITION" :src="initial" allowpopups />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useLeagues } from '@/web/background/Leagues'
import { tradeTabUrl } from './trade-tab'

// must match main/src/windowing/trade-tab.ts (main refuses any other partition)
const PARTITION = 'persist:loot-goblin-trade-site'

interface WebviewTag extends HTMLElement {
  src: string
  getURL: () => string
  loadURL: (url: string) => Promise<void>
  canGoBack: () => boolean
  canGoForward: () => boolean
  goBack: () => void
  goForward: () => void
  reload: () => void
}

const leagues = useLeagues()
const league = computed(() => leagues.selectedId.value ?? '')
const home = computed(() => `https://www.pathofexile.com/trade/search/${encodeURIComponent(league.value)}`)
const exchange = computed(() => `https://www.pathofexile.com/trade/exchange/${encodeURIComponent(league.value)}`)

// first page: what the overlay asked for, else the league's search page
const initial = tradeTabUrl.value ?? (league.value ? home.value : 'https://www.pathofexile.com/trade')
tradeTabUrl.value = undefined

const webviewEl = shallowRef<WebviewTag>()
const view = computed(() => ready.value ? webviewEl.value : undefined)
const ready = ref(false)
const url = ref(initial)
const loading = ref(false)
const canBack = ref(false)
const canForward = ref(false)
const shortUrl = computed(() => url.value.replace(/^https:\/\/(www\.)?/, '').replace(/\?q=.*/, '?q=…'))

function refresh () {
  const w = webviewEl.value
  if (!w || !ready.value) return
  url.value = w.getURL()
  canBack.value = w.canGoBack()
  canForward.value = w.canGoForward()
}

function go (to: string) {
  if (!ready.value) return
  webviewEl.value?.loadURL(to).catch(() => {})
}

function openExternal () {
  window.open(url.value)
}

// asked for while the tab is open (overlay → main → here, or this window)
watch(tradeTabUrl, (to) => {
  if (!to) return
  if (ready.value) {
    tradeTabUrl.value = undefined
    go(to)
  }
})

onMounted(() => {
  const w = webviewEl.value!
  w.addEventListener('dom-ready', () => {
    ready.value = true
    refresh()
    // a page asked for before the tab finished loading
    if (tradeTabUrl.value) { const to = tradeTabUrl.value; tradeTabUrl.value = undefined; go(to) }
  }, { once: true })
  w.addEventListener('did-start-loading', () => { loading.value = true })
  w.addEventListener('did-stop-loading', () => { loading.value = false; refresh() })
  w.addEventListener('did-navigate', refresh)
  w.addEventListener('did-navigate-in-page', refresh)
})
</script>
