<template>
  <!-- Deathloom fork: health check (idea 13), settings backup (idea 14), phone or other devices (idea 7) -->
  <div class="max-w-2xl p-2 text-sm">
    <!-- Health check -->
    <div class="mb-4">
      <div class="flex items-center mb-1">
        <span class="text-base">Health check</span>
        <button class="ml-auto px-2 rounded bg-gray-700 hover:bg-gray-600" :disabled="busy === 'health'" @click="runHealth">
          <i class="fas fa-stethoscope mr-1" :class="{ 'fa-spin': busy === 'health' }" />{{ health ? 'Check again' : 'Check now' }}</button>
      </div>
      <div class="text-gray-500 mb-1">Checks what Orbhoarder needs: the game's files, Path of Building, sign-in, internet and hotkeys. Use it when something doesn't work, or a friend asks why.</div>
      <div v-for="h of allHealth" :key="h.name" class="flex gap-x-2 py-0.5">
        <i class="fas mt-0.5 w-4" :class="h.ok ? 'fa-check text-green-400' : h.warn ? 'fa-exclamation-triangle text-yellow-400' : 'fa-times text-red-400'" />
        <div class="flex-1"><div>{{ h.name }}</div><div class="text-gray-500">{{ h.detail }}</div></div>
      </div>
    </div>
    <hr class="mb-4 mx-8 border-gray-700">

    <!-- Backup -->
    <div class="mb-4">
      <div class="text-base mb-1">Settings backup</div>
      <div class="text-gray-500 mb-2">One file with all settings, hotkeys, panel layouts, notes, ticks and session data, to move to a new PC or share your setup with a friend. Your builds stay in their folder (build sync shares those).</div>
      <div class="flex gap-2">
        <button class="px-2 rounded bg-gray-700 hover:bg-gray-600" :disabled="busy === 'backup'" @click="saveBackup"><i class="fas fa-file-export mr-1" />Save backup…</button>
        <button class="px-2 rounded bg-gray-700 hover:bg-gray-600" :disabled="busy === 'backup'" @click="openBackup"><i class="fas fa-file-import mr-1" />Restore…</button>
      </div>
      <div v-if="backupMsg" class="mt-1" :class="backupErr ? 'text-red-400' : 'text-green-400'">{{ backupMsg }}</div>
    </div>
    <hr class="mb-4 mx-8 border-gray-700">

    <!-- Phone or other devices -->
    <div class="mb-4">
      <div class="text-base mb-1">Phone or other devices</div>
      <div class="text-gray-500 mb-2">Open the Orbhoarder window in a browser on your phone or another PC on the same Wi-Fi (campaign guide, build notes, cheat sheets on a second screen). Only devices that open the link with its key get in.</div>
      <ui-toggle :modelValue="remote?.enabled === true" @update:modelValue="setRemote">Allow my phone or other devices on my network</ui-toggle>
      <div v-if="remote && remote.enabled !== remote.listening" class="text-yellow-300 mt-1">
        {{ remote.enabled ? 'Orbhoarder makes the phone link after a restart.' : 'Phone access stops after a restart.' }}
        <button class="ml-1 px-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-100" @click="restart">Restart now</button>
        <div v-if="remote.enabled" class="text-gray-500">Windows may ask to allow it through the firewall: allow Private networks only.</div>
      </div>
      <div v-if="remote?.listening && !remote.urls.length" class="text-yellow-300 mt-1">No network address found: is this PC on Wi-Fi or a network cable?</div>
      <template v-if="remote?.listening && remote.urls.length">
        <div class="mt-2 text-gray-400">Scan with your phone's camera (same Wi-Fi), or copy the link:</div>
        <div v-for="u of remote.urls" :key="u" class="mt-1">
          <div class="flex items-center gap-2">
            <code class="flex-1 min-w-0 truncate bg-gray-900 rounded px-1" :title="u">{{ u }}</code>
            <button class="px-2 rounded bg-gray-700 hover:bg-gray-600" @click="copy(u)">{{ copied === u ? 'Copied' : 'Copy' }}</button>
            <button class="px-2 rounded bg-gray-700 hover:bg-gray-600" @click="qrFor = qrFor === u ? '' : u">{{ qrFor === u ? 'Hide QR' : 'QR code' }}</button>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-if="qrFor === u" class="mt-2 inline-block bg-white p-2 rounded" style="width: 14rem;" v-html="qrSvg(u)" />
        </div>
        <div class="text-gray-500 mt-1">The key is like a password: don't share the link outside your home. The connection isn't encrypted, so only use it on your own Wi-Fi.
          <button class="underline hover:text-gray-200" @click="newKey">New key</button> (old links stop working).</div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref, watch, onUnmounted } from 'vue'
import qrcode from 'qrcode-generator'
import type { HealthItem, RemoteInfo, IpcEventPayload } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import type { Config } from '@/web/Config'
import { configProp } from './utils'
import { hotkeyClashes, makeBackup, readBackup } from './tools'

export default defineComponent({
  name: 'Tools',
  props: configProp(),
  setup (props) {
    const busy = ref<'health' | 'backup' | null>(null)
    const health = ref<HealthItem[] | null>(null)
    const remote = ref<RemoteInfo | null>(null)
    const backupMsg = ref('')
    const backupErr = ref(false)
    const copied = ref('')
    let requestId = 0
    type Reply = IpcEventPayload<'MAIN->CLIENT::tools'>
    const pending = new Map<number, (p: Reply) => void>()

    const listener = Host.onEvent('MAIN->CLIENT::tools', (e) => {
      const cb = pending.get(e.requestId)
      if (cb) { pending.delete(e.requestId); cb(e) }
    })
    onUnmounted(() => { listener.abort() })

    function ask (op: 'health' | 'remote-info' | 'remote-set' | 'remote-newkey' | 'restart' | 'backup-save' | 'backup-open', extra: { enabled?: boolean, text?: string } = {}) {
      return new Promise<Reply>((resolve) => {
        const id = ++requestId
        pending.set(id, resolve)
        Host.sendEvent({ name: 'CLIENT->MAIN::tools', payload: { requestId: id, op, ...extra } })
      })
    }

    async function runHealth () {
      busy.value = 'health'
      try { health.value = (await ask('health')).health ?? [] } finally { busy.value = null }
    }
    const allHealth = computed(() => {
      if (!health.value) return []
      const clashes = hotkeyClashes(props.config as Config)
      return [...health.value, clashes.length
        ? { name: 'Hotkeys', ok: false, warn: true, detail: 'Same key used twice: ' + clashes.join('; ') + '. Change one in Settings → Hotkeys.' }
        : { name: 'Hotkeys', ok: true, detail: 'no key used twice' }]
    })

    ask('remote-info').then(e => { remote.value = e.remote ?? null }, () => {})
    async function setRemote (on: boolean) { remote.value = (await ask('remote-set', { enabled: on })).remote ?? null }
    async function newKey () { remote.value = (await ask('remote-newkey')).remote ?? null }
    function restart () { ask('restart').then(() => {}, () => {}) }
    // first link's QR open by default (the usual one is the Wi-Fi address)
    const qrFor = ref('')
    watch(() => remote.value?.urls[0], (u) => { if (u && !qrFor.value) qrFor.value = u })
    function qrSvg (text: string): string {
      const qr = qrcode(0, 'M')
      qr.addData(text)
      qr.make()
      // our own link only (local address + key), no user text
      return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
    }
    function copy (text: string) {
      Host.sendEvent({ name: 'CLIENT->MAIN::write-clipboard', payload: { text } })
      copied.value = text
      setTimeout(() => { if (copied.value === text) copied.value = '' }, 2000)
    }

    async function saveBackup () {
      busy.value = 'backup'
      backupMsg.value = ''
      try {
        const res = (await ask('backup-save', { text: makeBackup(props.config as Config) })).backup
        if (res?.ok) { backupErr.value = false; backupMsg.value = `Saved: ${res.path}` } else if (res?.error) { backupErr.value = true; backupMsg.value = res.error }
      } finally { busy.value = null }
    }
    async function openBackup () {
      busy.value = 'backup'
      backupMsg.value = ''
      try {
        const res = (await ask('backup-open')).backup
        if (!res?.ok) { if (res?.error) { backupErr.value = true; backupMsg.value = res.error } return }
        const r = readBackup(res.text ?? '', props.config as Config)
        backupErr.value = !r.ok
        backupMsg.value = r.message
      } finally { busy.value = null }
    }

    return { busy, health, allHealth, runHealth, remote, setRemote, newKey, restart, qrFor, qrSvg, copy, copied, saveBackup, openBackup, backupMsg, backupErr }
  }
})
</script>
