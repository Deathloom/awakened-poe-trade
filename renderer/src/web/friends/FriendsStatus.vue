<template>
  <!-- Deathloom fork (ideas 10, 12): friends online and friends' race, through build sync.
       Friends' statuses are their own text: shown as plain text only. -->
  <div class="border-b border-gray-700 text-xs">
    <button class="w-full flex items-center gap-x-2 px-2 py-1 text-left hover:bg-gray-700" @click="toggleOpen">
      <i class="fas fa-user-friends text-gray-500" />
      <span class="text-gray-300">Friends</span>
      <span class="text-gray-500">{{ summary }}</span>
      <i class="fas ml-auto text-gray-500" :class="open ? 'fa-chevron-up' : 'fa-chevron-down'" />
    </button>
    <div v-if="open" class="px-2 pb-2 space-y-1">
      <div class="flex flex-wrap gap-x-3 gap-y-1 items-center">
        <ui-toggle :modelValue="cfg.share" @update:modelValue="set('share', $event)">Share my status</ui-toggle>
        <ui-toggle v-if="cfg.share" :modelValue="cfg.activity" @update:modelValue="set('activity', $event)">and the area I'm in</ui-toggle>
        <ui-toggle :modelValue="cfg.autoPull" @update:modelValue="set('autoPull', $event)">Refresh every 15 min</ui-toggle>
        <button class="ml-auto text-gray-400 hover:text-gray-100" title="Pull (build sync): get friends' latest status" @click="refresh">
          <i class="fas fa-sync-alt mr-1" :class="{ 'fa-spin': pulling }" />Pull</button>
      </div>
      <div class="text-gray-500">
        Shared through build sync: your character, level, league and act splits{{ cfg.activity ? ', and the area you\'re in' : '' }},
        written at most every 10 min and pushed by automatic sync. Friends see it after a Pull.
      </div>
      <div v-if="!state?.available" class="text-gray-500">Needs build sync set up (a builds folder and your player name).</div>
      <div v-if="state?.error" class="text-red-300">{{ state.error }}</div>
      <table v-if="rows.length" class="w-full">
        <tr v-for="r of rows" :key="r.player">
          <td class="pr-2 whitespace-nowrap">
            <span :class="r.online ? 'text-green-400' : 'text-gray-600'" :title="r.online ? 'Active in the last 30 min' : 'Not seen lately'">●</span>
            <span class="ml-1" :class="r.own ? 'text-gray-400' : 'text-gray-200'">{{ r.player }}{{ r.own ? ' (you)' : '' }}</span>
          </td>
          <td class="pr-2 text-gray-300 truncate max-w-0 w-1/2" :title="r.charTitle">{{ r.charText }}</td>
          <td class="pr-2 text-gray-400 truncate max-w-0 w-1/3" :title="r.zone">{{ r.zone }}</td>
          <td class="text-gray-500 whitespace-nowrap text-right">{{ r.ago }}</td>
        </tr>
      </table>

      <div v-if="race.acts.length" class="pt-1">
        <div class="text-gray-300 mb-0.5" title="Campaign time when each act was first entered (from each player's Client.txt)">
          <i class="fas fa-flag-checkered mr-1 text-gray-500" />Friends' race: act splits</div>
        <table class="text-gray-300">
          <tr class="text-gray-500">
            <th class="text-left pr-3 font-normal">Act</th>
            <th v-for="p of race.players" :key="p.player" class="text-right pr-3 font-normal" :title="p.title">{{ p.player }}</th>
          </tr>
          <tr v-for="act of race.acts" :key="act">
            <td class="pr-3">{{ act }}</td>
            <td v-for="p of race.players" :key="p.player" class="text-right pr-3 font-mono"
              :class="p.splits[act] != null && p.splits[act] === race.best[act] ? 'text-green-400' : ''">
              {{ p.splits[act] != null ? clock(p.splits[act]) : '–' }}</td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import UiToggle from '@/web/ui/UiToggle.vue'
import { Host } from '@/web/background/IPC'
import { AppConfig, saveConfig } from '@/web/Config'
import { IS_HUD } from '@/web/hud/is-hud'
import { friendsState, listFriends, pullFriends, friendsConfig, maybeShareStatus, ago, ONLINE_MS, type FriendsConfig } from './friends-status'

const OPEN_KEY = 'deathloom.friends.open.v1'
const open = ref((() => { try { return localStorage.getItem(OPEN_KEY) === '1' } catch { return false } })())
function toggleOpen () {
  open.value = !open.value
  try { localStorage.setItem(OPEN_KEY, open.value ? '1' : '0') } catch {}
  if (open.value) listFriends()
}

const cfg = computed(() => friendsConfig())
function set (key: keyof FriendsConfig, on: boolean) {
  if (IS_HUD) return
  AppConfig().friends = { ...friendsConfig(), [key]: on }
  saveConfig()
  if (key === 'share' && !on) Host.sendEvent({ name: 'CLIENT->MAIN::player-status', payload: { op: 'clear' } })
  else if (key === 'share' || key === 'activity') maybeShareStatus(true)
}

const state = friendsState
const now = ref(Date.now())
const clockTimer = setInterval(() => { now.value = Date.now() }, 60_000)

const rows = computed(() => (state.value?.entries ?? [])
  .slice()
  .sort((a, b) => Number(b.own) - Number(a.own) || b.status.updated - a.status.updated)
  .map(e => {
    const c = e.status.character
    return {
      player: e.player,
      own: e.own,
      online: now.value - e.status.updated < ONLINE_MS,
      charText: c ? `${c.name} · ${c.cls} ${c.level}` : '',
      charTitle: c ? `${c.name} (${c.cls}) level ${c.level}${e.status.league ? ` · ${e.status.league}` : ''}` : '',
      zone: e.status.zone ?? '',
      ago: ago(Math.max(0, now.value - e.status.updated))
    }
  }))

const summary = computed(() => {
  const list = rows.value.filter(r => !r.own)
  if (!list.length) return ''
  const on = list.filter(r => r.online).length
  return `${on} of ${list.length} active`
})

function clock (ms: number) {
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${String(m).padStart(2, '0')}` : `${m}m`
}
const race = computed(() => {
  const players = (state.value?.entries ?? [])
    .filter(e => e.status.splits && Object.keys(e.status.splits).length)
    .map(e => ({
      player: e.player,
      splits: e.status.splits!,
      title: `${e.status.character?.name ?? ''}${e.status.fromStart ? '' : ' (not followed from level 2)'}`
    }))
  const acts = Array.from({ length: 10 }, (_, i) => i + 1).filter(a => players.some(p => p.splits[a] != null))
  const best: Record<number, number> = {}
  for (const a of acts) {
    const vals = players.map(p => p.splits[a]).filter((v): v is number => v != null && v > 0)
    if (vals.length > 1) best[a] = Math.min(...vals)
  }
  return { players: players.length > 0 ? players : [], acts: players.length ? acts : [], best }
})

// after a Pull finishes, list again
const pulling = ref(false)
const syncListener = Host.onEvent('MAIN->CLIENT::pob-sync-state', (e) => {
  if (pulling.value && !e.busy) { pulling.value = false; listFriends() }
})
function refresh () {
  pulling.value = true
  pullFriends()
  // not signed in / no answer: stop the spinner and show what's on disk
  setTimeout(() => { if (pulling.value) { pulling.value = false; listFriends() } }, 60_000)
}
const autoTimer = setInterval(() => {
  if (open.value && cfg.value.autoPull && document.visibilityState === 'visible') refresh()
}, 15 * 60 * 1000)
watch(open, (o) => { if (o) listFriends() }, { immediate: true })
onUnmounted(() => { clearInterval(clockTimer); clearInterval(autoTimer); syncListener.abort() })
</script>
