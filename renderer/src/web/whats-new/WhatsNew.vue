<template>
  <!-- Deathloom fork: "What's new" after an update (CHANGELOG.md entries since the
       version this PC last saw). Shown once, in whichever window opens first. -->
  <div v-if="shown" class="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" @click.self="close">
    <div class="bg-gray-800 text-gray-200 rounded border border-gray-600 shadow-lg flex flex-col"
      style="width: 40rem; max-width: 92%; max-height: 80%;">
      <div class="flex items-center px-3 py-2 bg-gray-900 rounded-t">
        <span class="text-lg"><i class="fas fa-gift mr-2 text-yellow-500" />What's new in Loot Goblin {{ current }}</span>
        <button class="ml-auto text-gray-500 hover:text-gray-200" @click="close"><i class="fas fa-times" /></button>
      </div>
      <div class="overflow-y-auto px-4 py-2 leading-snug">
        <div v-for="v of versions" :key="v.version" class="mb-3">
          <div class="text-yellow-400 font-bold">{{ v.version }} <span class="text-gray-500 font-normal text-sm">{{ v.date }}</span></div>
          <!-- our own CHANGELOG.md, escaped in renderMarkdown -->
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="renderMarkdown(v.body)" />
        </div>
        <div v-if="hidden" class="text-sm text-gray-500 mb-2">{{ hidden }} older update{{ hidden === 1 ? '' : 's' }} not shown.</div>
      </div>
      <div class="px-3 py-2 border-t border-gray-700 flex items-center">
        <span class="text-xs text-gray-500">Settings → What's new shows this again.</span>
        <button class="ml-auto px-3 rounded bg-gray-700 hover:bg-gray-600" @click="close">Got it</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { changesSince, compareVersions, parseChangelog, renderMarkdown, type ChangelogVersion } from './changelog'
import { whatsNewRequested } from './whats-new-state'

// active: the window is showing (overlay: Shift+Space open; Loot Goblin window: always)
const props = defineProps<{ active: boolean }>()

const KEY = 'deathloom.whats-new-seen.v1'
const MAX = 8
const shown = ref(false)
const versions = shallowRef<ChangelogVersion[]>([])
const hidden = ref(0)
const current = computed(() => Host.version.value)
const realVersion = computed(() => /^\d+\.\d+\.\d+$/.test(current.value) && current.value !== '0.0.0')

function loadSeen (): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}
function markSeen () {
  try { localStorage.setItem(KEY, current.value) } catch {}
}

function check () {
  if (!props.active || !realVersion.value || shown.value) return
  let seen = loadSeen()
  // installs from before 1.0.32 (setup done, no "seen" yet): show 1.0.31 onwards
  if (!seen && AppConfig().pob?.setupDone) seen = '1.0.30'
  if (!seen) {
    // new install: the setup guide welcomes them; nothing is "new" yet
    markSeen()
    return
  }
  if (compareVersions(current.value, seen) <= 0) return
  const list = changesSince(seen, current.value)
  if (!list.length) { markSeen(); return }
  versions.value = list.slice(0, MAX)
  hidden.value = Math.max(0, list.length - MAX)
  shown.value = true
}
watch([() => props.active, current], check, { immediate: true })

// Settings → What's new
watch(whatsNewRequested, (n, before) => {
  if (n === before) return
  versions.value = parseChangelog().slice(0, 5)
  hidden.value = 0
  shown.value = true
})

function close () {
  shown.value = false
  if (realVersion.value) markSeen()
}

// seen in another window: close here too
const onStorage = (e: StorageEvent) => {
  if (e.key === KEY && shown.value && e.newValue && compareVersions(e.newValue, current.value) >= 0 && whatsNewRequested.value === 0) shown.value = false
}
window.addEventListener('storage', onStorage)
onUnmounted(() => window.removeEventListener('storage', onStorage))
</script>
