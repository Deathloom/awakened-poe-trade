<template>
  <!-- Deathloom fork: Report a bug / Suggest a feature. Sent as an issue to the
       group's builds repo with the GitHub sign-in from build sync, or opened as a
       new issue in the browser when not signed in. -->
  <div class="absolute inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" @click.self="emit('close')">
    <div class="bg-gray-800 text-gray-200 rounded border border-gray-600 shadow-lg flex flex-col"
      style="width: 36rem; max-width: 92%; max-height: 85%;">
      <div class="flex items-center px-3 py-2 bg-gray-900 rounded-t">
        <button v-for="k of KINDS" :key="k.key" class="px-3 py-0.5 rounded mr-1"
          :class="kind === k.key ? 'bg-gray-600 text-gray-100' : 'text-gray-400 hover:text-gray-100 hover:bg-gray-700'"
          @click="kind = k.key"><i class="fas mr-1" :class="k.icon" />{{ k.label }}</button>
        <button class="ui-btn ui-btn-quiet ml-auto" title="Close" @click="emit('close')"><i class="fas fa-times" /></button>
      </div>
      <div v-if="!done" class="overflow-y-auto px-4 py-3 flex flex-col gap-y-2">
        <label class="text-sm text-gray-400">{{ kind === 'bug' ? 'What went wrong? (one line)' : 'Your idea in one line' }}</label>
        <input v-model="title" maxlength="110" class="bg-gray-900 rounded px-2 py-1" spellcheck="true"
          :placeholder="kind === 'bug' ? 'e.g. Gems tab is empty after switching build' : 'e.g. Show my map profit per hour'">
        <label class="text-sm text-gray-400">{{ kind === 'bug' ? 'What did you do, what happened, what did you expect?' : 'More details (optional)' }}</label>
        <textarea v-model="text" rows="7" maxlength="8000" class="bg-gray-900 rounded px-2 py-1 resize-y" spellcheck="true" />
        <label v-if="kind === 'bug'" class="flex items-center gap-x-2 text-sm">
          <input v-model="includeLog" type="checkbox">
          Add the last log lines (no Windows user name, tokens or passwords)
        </label>
        <div v-if="error" class="text-sm text-red-400">{{ error }}</div>
      </div>
      <div v-else class="px-4 py-4">
        <i class="fas fa-check text-green-400 mr-2" />{{ done }}
      </div>
      <div class="px-3 py-2 border-t border-gray-700 flex items-center gap-x-2">
        <span class="text-xs text-gray-500">{{ done ? '' : 'Goes to the group\'s builds repo on GitHub, where Gerhard sees it.' }}</span>
        <template v-if="!done">
          <button class="ml-auto px-3 rounded bg-gray-700 hover:bg-gray-600" :disabled="busy" title="Open it as a new issue on GitHub in your browser" @click="send(true)">Open on GitHub</button>
          <button class="px-3 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50" :disabled="busy || !title.trim()" @click="send(false)">
            {{ busy ? 'Sending…' : 'Send' }}</button>
        </template>
        <button v-else class="ml-auto px-3 rounded bg-gray-700 hover:bg-gray-600" @click="emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { Host } from '@/web/background/IPC'

const props = defineProps<{ initial: 'bug' | 'idea' }>()
const emit = defineEmits<{ close: [] }>()

const KINDS = [
  { key: 'bug' as const, label: 'Report a bug', icon: 'fa-bug' },
  { key: 'idea' as const, label: 'Suggest a feature', icon: 'fa-lightbulb' }
]

const kind = ref<'bug' | 'idea'>(props.initial)
const title = ref('')
const text = ref('')
const includeLog = ref(true)
const busy = ref(false)
const error = ref<string | null>(null)
const done = ref<string | null>(null)
let requestId = 0

const listener = Host.onEvent('MAIN->CLIENT::user-report', (e) => {
  if (e.requestId !== requestId) return
  busy.value = false
  if (e.opened) {
    done.value = 'Opened on GitHub in your browser: check the text there and press Create.'
  } else if (e.sent) {
    done.value = kind.value === 'bug' ? 'Thanks, the bug report is sent.' : 'Thanks, your idea is sent.'
  } else {
    error.value = e.reason === 'not signed in to GitHub'
      ? 'Not sent: you\'re not signed in to GitHub in Orbhoarder (Build sync). Use Open on GitHub instead.'
      : `Not sent (${e.reason ?? 'unknown'}). Try Open on GitHub instead.`
  }
})
onUnmounted(() => { listener.abort() })

function send (viaBrowser: boolean) {
  if (!viaBrowser && !title.value.trim()) return
  busy.value = true
  error.value = null
  requestId = Date.now()
  Host.sendEvent({
    name: 'CLIENT->MAIN::user-report',
    payload: { requestId, kind: kind.value, title: title.value, text: text.value, includeLog: kind.value === 'bug' && includeLog.value, viaBrowser }
  })
}
</script>
