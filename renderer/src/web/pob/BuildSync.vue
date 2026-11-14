<template>
  <!-- Deathloom fork: build sharing (GitHub sign-in, Pull / Push) from the overlay; same sign-in as PoB's Sync... -->
  <div class="px-2 py-1 bg-gray-800 text-sm flex flex-col gap-y-1">
    <div v-if="state.error" class="text-red-400">{{ state.error }}</div>

    <!-- Sign-in in progress -->
    <template v-if="state.signIn">
      <div class="text-gray-300">Enter this code on GitHub (it's already copied) and approve <b>POE Builds sync</b>:</div>
      <div class="flex items-center gap-x-2">
        <span class="font-mono text-lg tracking-widest text-gray-100 select-all">{{ state.signIn.userCode }}</span>
        <button class="btn-mini" @click="copyCode">{{ copied ? 'Copied' : 'Copy code' }}</button>
        <button class="btn-mini" @click="openGithub">Open GitHub</button>
        <button class="btn-mini" @click="send({ op: 'cancelSignIn' })">Cancel</button>
      </div>
      <div class="text-gray-500">Waiting for approval… (code valid for {{ countdown }}). This finishes by itself.</div>
    </template>

    <!-- Not signed in -->
    <template v-else-if="status && !status.signedIn && !status.usingToken">
      <div class="text-gray-400">
        Share builds with your group: everyone's builds are downloaded, yours are uploaded.
        You need a GitHub account that's a member of POE-Builds.
      </div>
      <div class="flex items-center gap-x-2">
        <button class="btn-mini" :disabled="Boolean(state.busy)" @click="send({ op: 'signIn' })">
          <i class="fab fa-github mr-1" />Sign in with GitHub</button>
        <span v-if="state.busy" class="text-gray-500">{{ state.busy }}</span>
      </div>
    </template>

    <!-- Signed in -->
    <template v-else-if="status">
      <div class="flex items-center gap-x-2">
        <span class="text-gray-400 truncate">
          <i class="fab fa-github mr-1" />{{ status.signedIn ? status.login ?? 'GitHub user' : 'Pasted token (from PoB)' }}
        </span>
        <button v-if="status.signedIn" class="ml-auto text-gray-500 hover:text-gray-200 shrink-0" title="Sign out on this PC (PoB too)"
          :disabled="Boolean(state.busy)" @click="send({ op: 'signOut' })">Sign out</button>
      </div>
      <div class="flex items-center gap-x-2" title="Your own folder in the builds folder. Only this folder is uploaded. Letters, numbers, _ - . only.">
        <span class="text-gray-500 w-14 shrink-0">Folder</span>
        <input v-if="!hud" v-model="player" class="flex-1 min-w-0 bg-gray-900 rounded px-1" spellcheck="false"
          @keydown.enter="savePlayer" @blur="savePlayer">
        <span v-else class="truncate">{{ status.settings.player || '(not set)' }}</span>
      </div>
      <label class="flex items-center gap-x-2 text-gray-400 cursor-pointer"
        title="Pull when Loot Goblin (or PoB) starts, push a few seconds after a build changes. Same setting as PoB's Sync...">
        <input type="checkbox" :checked="status.prefs.autoSync" @change="setAuto(($event.target as HTMLInputElement).checked)">
        Sync automatically
      </label>
      <label v-if="!hud" class="flex items-center gap-x-2 text-gray-400 cursor-pointer"
        title="Each player keeps builds in their own private repo (builds-<GitHub name>). You only get the builds of players who approved your request. On by default; untick to use the old shared repo.">
        <input type="checkbox" :checked="perPlayer" @change="setPerPlayer(($event.target as HTMLInputElement).checked)">
        Private builds (per player)
      </label>
      <div v-if="perPlayer" class="flex items-center gap-x-2 text-gray-500">
        <span class="truncate">You get the builds of players who shared them with you.</span>
        <button class="btn-mini shrink-0" title="Ask a player to share their builds (GitHub form; they approve)" @click="requestAccess">Request access</button>
      </div>
      <div class="flex items-center gap-x-2">
        <div class="flex gap-px">
          <button class="btn-mini rounded-r-none" :disabled="Boolean(state.busy)" title="Download everyone's builds" @click="send({ op: 'pull' })">Pull</button>
          <button class="btn-mini rounded-none" :disabled="Boolean(state.busy) || !status.settings.player" title="Upload your folder" @click="send({ op: 'push' })">Push</button>
          <button class="btn-mini rounded-l-none" :disabled="Boolean(state.busy)" title="Pull, then Push" @click="send({ op: 'syncNow' })">Sync now</button>
        </div>
        <span v-if="state.busy" class="text-gray-400 truncate"><i class="fas fa-sync-alt fa-spin mr-1" />{{ state.busy }}</span>
        <span v-else-if="state.last" class="truncate" :class="state.last.success ? 'text-gray-500' : 'text-red-400'">
          {{ state.last.title }}{{ state.last.auto ? ' (auto)' : '' }} · {{ age }}</span>
      </div>
      <div v-if="state.last && !state.busy && showLines" class="text-xs text-gray-400 pl-1">
        <div v-for="(line, i) of state.last.lines.slice(0, 12)" :key="i" class="truncate" :title="line">{{ line }}</div>
      </div>
      <button v-if="state.last && !state.busy" class="self-start text-xs text-gray-500 hover:text-gray-300" @click="showLines = !showLines">
        {{ showLines ? 'Hide details' : 'Details' }}</button>
    </template>

    <div v-else-if="!state.error" class="text-gray-500">Checking build sharing…</div>

    <div v-if="state.notice" class="text-yellow-500 whitespace-pre-line">{{ state.notice }}</div>
    <div v-if="state.mismatch" class="text-yellow-500">{{ state.mismatch }}</div>
    <div v-if="status && !status.credAvailable" class="text-red-400">Windows Credential Manager isn't available, so the sign-in can't be stored.</div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue'
import type { IpcEventPayload, PobSyncState } from '@ipc/types'
import { Host } from '@/web/background/IPC'

defineProps<{ hud?: boolean }>()
const emit = defineEmits<{
  // a Pull / Push finished: the build list may have changed
  (e: 'synced'): void
}>()

const state = shallowRef<PobSyncState>({ busy: null, status: null, signIn: null, last: null })
const status = computed(() => state.value.status)
const player = ref('')
const showLines = ref(false)
const copied = ref(false)
const now = ref(Date.now())
const clock = setInterval(() => { now.value = Date.now() }, 1000)

const listener = Host.onEvent('MAIN->CLIENT::pob-sync-state', (e) => {
  const prevLast = state.value.last?.time
  state.value = e
  if (e.last && e.last.time !== prevLast) {
    if (!e.last.auto) showLines.value = true
    emit('synced')
  }
})
onUnmounted(() => { listener.abort(); clearInterval(clock) })

watch(() => status.value?.settings.player, (p) => { player.value = p ?? '' }, { immediate: true })

function send (payload: IpcEventPayload<'CLIENT->MAIN::pob-sync'>) {
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-sync', payload })
}
send({ op: 'status' })

function savePlayer () {
  const p = player.value.trim()
  if (!status.value || p === status.value.settings.player) return
  send({ op: 'configure', player: p })
}

const perPlayer = computed(() => Boolean(status.value?.settings.repoPrefix))

function setPerPlayer (on: boolean) {
  send({ op: 'configure', repoPrefix: on ? 'builds-' : '' })
}

function requestAccess () {
  const owner = status.value?.settings.owner || 'POE-Builds'
  if (!/^[A-Za-z0-9_.-]+$/.test(owner)) return
  window.open(`https://github.com/${owner}/access/issues/new?template=builds-access.yml`)
}

function setAuto (on: boolean) {
  send({ op: 'configure', autoSync: on })
}

function copyCode () {
  if (!state.value.signIn) return
  Host.sendEvent({ name: 'CLIENT->MAIN::write-clipboard', payload: { text: state.value.signIn.userCode } })
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

function openGithub () {
  if (state.value.signIn) window.open(state.value.signIn.verificationUri)
}

const countdown = computed(() => {
  const left = Math.max(0, Math.round(((state.value.signIn?.expiresAt ?? 0) - now.value) / 1000))
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`
})

const age = computed(() => {
  const t = state.value.last?.time
  if (!t) return ''
  const mins = Math.floor((now.value - t) / 60_000)
  return mins < 1 ? 'just now' : `${mins} min ago`
})
</script>

<style lang="postcss" scoped>
.btn-mini {
  @apply bg-gray-700 text-gray-300 rounded px-2;
  &:hover:not(:disabled) { @apply text-gray-100; }
  &:disabled { @apply opacity-50; }
}
</style>
