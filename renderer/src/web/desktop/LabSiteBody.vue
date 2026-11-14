<template>
  <!-- Deathloom fork: poelab.com (today's labyrinth layouts) in the Loot Goblin
       window. Shown as-is in its own session, ads included; nothing is read
       from or copied off the page. Links to other sites open in your browser. -->
  <div class="flex flex-col h-full min-h-0 rounded bg-gray-800">
    <div class="flex items-center gap-x-1 px-2 py-1 border-b border-gray-700 shrink-0 text-sm">
      <button class="px-2 rounded hover:bg-gray-700 disabled:opacity-40" :disabled="!canBack" title="Back" @click="view?.goBack()"><i class="fas fa-arrow-left" /></button>
      <button class="px-2 rounded hover:bg-gray-700 disabled:opacity-40" :disabled="!canForward" title="Forward" @click="view?.goForward()"><i class="fas fa-arrow-right" /></button>
      <button class="px-2 rounded hover:bg-gray-700" title="Reload" @click="view?.reload()"><i class="fas fa-redo" /></button>
      <button class="px-2 rounded hover:bg-gray-700" title="poelab.com home (today's layouts)" @click="go(HOME)"><i class="fas fa-home" /></button>
      <div class="flex-1 min-w-0 truncate px-2 text-gray-400" :title="url">{{ shortUrl }}</div>
      <i v-if="loading" class="fas fa-circle-notch fa-spin text-gray-500" />
      <button class="px-2 rounded hover:bg-gray-700" title="Open this page in your browser" @click="openExternal"><i class="fas fa-external-link-alt" /></button>
    </div>
    <div class="px-3 py-0.5 text-xs text-gray-500 bg-gray-900 shrink-0">
      poelab.com as-is (community site, not part of Loot Goblin). Links to other sites open in your browser.
    </div>
    <webview ref="webviewEl" class="flex-1 min-h-0" :partition="PARTITION" :src="HOME" allowpopups />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'

// must match main/src/windowing/trade-tab.ts (main refuses any other partition)
const PARTITION = 'persist:loot-goblin-poelab'
const HOME = 'https://www.poelab.com/'

interface WebviewTag extends HTMLElement {
  getURL: () => string
  loadURL: (url: string) => Promise<void>
  canGoBack: () => boolean
  canGoForward: () => boolean
  goBack: () => void
  goForward: () => void
  reload: () => void
}

const webviewEl = shallowRef<WebviewTag>()
const ready = ref(false)
const view = computed(() => ready.value ? webviewEl.value : undefined)
const url = ref(HOME)
const loading = ref(false)
const canBack = ref(false)
const canForward = ref(false)
const shortUrl = computed(() => url.value.replace(/^https:\/\/(www\.)?/, ''))

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

onMounted(() => {
  const w = webviewEl.value!
  w.addEventListener('dom-ready', () => { ready.value = true; refresh() }, { once: true })
  w.addEventListener('did-start-loading', () => { loading.value = true })
  w.addEventListener('did-stop-loading', () => { loading.value = false; refresh() })
  w.addEventListener('did-navigate', refresh)
  w.addEventListener('did-navigate-in-page', refresh)
})
</script>
