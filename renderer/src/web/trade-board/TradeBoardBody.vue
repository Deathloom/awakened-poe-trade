<template>
  <!-- Deathloom fork: friends' trade board (Loot Goblin window, All tab and the overlay).
       Listings are GitHub issues in the group's builds repo; chat buttons send or copy
       one message per click, never automatically. -->
  <div class="widget-default-style flex flex-col text-gray-200 leading-tight text-sm"
    :style="fill ? { width: '100%', height: '100%' } : { width: '28rem', maxHeight: '75vh' }">
    <div class="flex items-center gap-x-2 px-2 py-1 bg-gray-900 rounded-t shrink-0">
      <span class="text-gray-500 shrink-0"><i class="fas fa-people-carry mr-1" />Friends' board</span>
      <div class="flex gap-px shrink-0">
        <button v-for="k of KINDS" :key="k.key" class="px-2 rounded" :title="k.hint"
          :class="tab === k.key ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-200'"
          @click="tab = k.key"><i class="fas mr-1" :class="k.icon" />{{ k.label }}<span v-if="count(k.key)" class="text-yellow-400"> {{ count(k.key) }}</span></button>
      </div>
      <label class="text-xs text-gray-400 shrink-0 cursor-pointer" title="Only your own listings">
        <input v-model="onlyMine" type="checkbox" class="mr-1 align-middle">Mine</label>
      <span class="ml-auto text-xs text-gray-500 truncate" :title="statusTitle">{{ statusText }}</span>
      <button class="text-gray-400 hover:text-gray-100 shrink-0" title="Refresh" :disabled="!!state.busy" @click="refreshBoard">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': state.busy === 'Loading…' }" /></button>
      <button v-if="state.signedIn" class="px-2 rounded bg-blue-700 hover:bg-blue-600 text-white shrink-0" @click="openForm()">
        <i class="fas fa-plus mr-1" />Post</button>
    </div>

    <div v-if="state.error" class="px-2 py-1 bg-red-900 text-red-100 text-xs shrink-0">{{ state.error }}</div>

    <div v-if="state.signedIn === false" class="p-2 text-gray-400">
      The board uses your GitHub sign-in (the same as build sync). Sign in under
      Settings → Path of Building → Build sync, then come back here.
    </div>

    <!-- post form -->
    <div v-else-if="form" class="overflow-y-auto min-h-0 p-2 flex flex-col gap-y-1">
      <div class="flex gap-px">
        <button v-for="k of KINDS" :key="k.key" class="px-2 rounded" :title="k.hint"
          :class="form.kind === k.key ? 'bg-gray-600 text-gray-100' : 'bg-gray-800 text-gray-400 hover:text-gray-200'"
          @click="form.kind = k.key"><i class="fas mr-1" :class="k.icon" />{{ k.label }}</button>
      </div>
      <textarea v-model="form.item" rows="4" spellcheck="false" class="rounded bg-gray-900 px-1 font-mono text-xs"
        :placeholder="form.kind === 'wanted' ? 'Optional: paste item text (Ctrl+C on an item in game)' : 'Paste the item text (Ctrl+C on the item in game), or just type a name below'"
        @input="fromItem" />
      <input v-model="form.name" class="rounded bg-gray-900 px-1" maxlength="120"
        :placeholder="form.kind === 'wanted' ? 'What do you need? (e.g. Tabula Rasa, 6-link body armour)' : 'Item name'">
      <div v-if="form.kind === 'sell'" class="flex items-center gap-x-2">
        <span class="text-gray-400">Price</span>
        <input v-model.number="form.amount" type="number" min="0" step="0.5" class="w-20 rounded bg-gray-900 px-1">
        <select v-model="form.currency" class="rounded bg-gray-900 px-1">
          <option v-for="c of CURRENCIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
      <input v-model="form.note" class="rounded bg-gray-900 px-1" maxlength="300" placeholder="Note (optional)">
      <div class="flex items-center gap-x-2">
        <span class="text-gray-400 shrink-0" title="Friends whisper this character">Whisper me as</span>
        <input v-model="form.character" class="flex-1 rounded bg-gray-900 px-1" maxlength="23" placeholder="Character name">
      </div>
      <div v-if="formProblem" class="text-xs text-yellow-400">{{ formProblem }}</div>
      <div class="flex items-center gap-x-2 pt-1">
        <button class="px-3 rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-40" :disabled="!!formProblem || !!state.busy" @click="submit">
          {{ state.busy === 'Posting…' ? 'Posting…' : 'Post to the board' }}</button>
        <button class="px-2 rounded text-gray-400 hover:text-gray-100" @click="form = null">Cancel</button>
        <span class="ml-auto text-xs text-gray-500">Only your group (POE-Builds members) sees it.</span>
      </div>
    </div>

    <!-- listings -->
    <div v-else class="overflow-y-auto min-h-0 p-1">
      <div v-if="state.signedIn == null || (state.busy === 'Loading…' && !state.updated)" class="p-1 text-gray-500">Loading the board…</div>
      <div v-else-if="!shown.length" class="p-1 text-gray-500">
        {{ onlyMine ? 'You have nothing on this tab.' : emptyText }}
      </div>
      <div v-for="l of shown" :key="l.number" class="rounded mb-1 p-1" :class="l.mine ? 'bg-gray-800 border-l-2 border-blue-600' : 'bg-gray-900'">
        <div class="flex items-baseline gap-x-2">
          <span class="font-semibold truncate" :class="rarityClass(l.rarity)" :title="l.name">{{ l.name }}</span>
          <span v-if="l.base && l.base !== l.name" class="text-gray-400 truncate text-xs" :title="l.base">{{ l.base }}</span>
          <span v-if="l.kind === 'sell' && l.price" class="text-yellow-300 shrink-0">{{ l.price.amount }} {{ l.price.currency }}</span>
          <span class="ml-auto text-gray-500 text-xs shrink-0" :title="new Date(l.created).toLocaleString()">{{ ago(l.created) }}</span>
        </div>
        <div class="flex flex-wrap gap-x-2 text-xs text-gray-400">
          <span :title="`GitHub: ${l.author}`"><i class="fab fa-github mr-0.5" />{{ l.author }}</span>
          <span v-if="l.character" class="text-gray-300">@{{ l.character }}</span>
          <span v-if="l.league" :class="l.league === league ? 'text-gray-500' : 'text-orange-400'" :title="l.league === league ? 'Your league' : 'Another league than yours'">{{ l.league }}</span>
          <button v-if="l.item" class="text-gray-500 hover:text-gray-200" @click="toggle(l.number)">{{ open.has(l.number) ? 'hide item' : 'item text' }}</button>
        </div>
        <div v-if="l.note" class="text-xs text-gray-300 break-words">"{{ l.note }}"</div>
        <pre v-if="l.item && open.has(l.number)" class="text-xs text-gray-300 bg-gray-950 rounded p-1 mt-1 whitespace-pre-wrap break-words">{{ l.item }}</pre>

        <!-- claims / "I have one" / notes -->
        <div v-for="(c, i) of l.comments" :key="i" class="flex items-center gap-x-1 text-xs mt-0.5 pl-2 border-l border-gray-700">
          <i class="fas shrink-0" :class="c.type === 'claim' ? 'fa-hand-paper text-green-400' : c.type === 'have' ? 'fa-check text-green-400' : 'fa-comment text-gray-500'" />
          <span class="text-gray-400 shrink-0">{{ c.author }}</span>
          <span v-if="c.character" class="text-gray-300 shrink-0">@{{ c.character }}</span>
          <span class="truncate text-gray-400" :title="c.text">{{ c.type === 'claim' ? 'wants it' : c.type === 'have' ? 'has one' : '' }}{{ c.text ? ` "${c.text}"` : '' }}</span>
          <template v-if="l.mine && c.character && c.author !== state.login">
            <button class="ml-auto bg-gray-700 hover:bg-gray-600 rounded px-1 shrink-0" :title="replyWhisper(l, c.character)"
              @click="chat(`${l.number}-${i}-w`, replyWhisper(l, c.character))"><i v-if="pressed === `${l.number}-${i}-w`" class="fas fa-check text-green-400" /> Whisper</button>
            <button v-if="l.kind !== 'wanted'" class="bg-gray-700 hover:bg-gray-600 rounded px-1 shrink-0" :title="inviteCommand(c.character)"
              @click="chat(`${l.number}-${i}-i`, inviteCommand(c.character))"><i v-if="pressed === `${l.number}-${i}-i`" class="fas fa-check text-green-400" /> Invite</button>
          </template>
        </div>

        <div class="flex flex-wrap items-center gap-1 pt-1">
          <template v-if="!l.mine">
            <button v-if="l.kind === 'give'" class="bg-green-800 hover:bg-green-700 rounded px-1.5 disabled:opacity-40"
              :disabled="hasMine(l, 'claim') || !!state.busy || !myCharacter" :title="myCharacter ? 'Tell the poster you want it (shows on the listing)' : 'Fill in your character first (Post → Whisper me as)'"
              @click="react(l, 'claim')">{{ hasMine(l, 'claim') ? 'Claimed' : 'Claim' }}</button>
            <button v-if="l.kind === 'wanted'" class="bg-green-800 hover:bg-green-700 rounded px-1.5 disabled:opacity-40"
              :disabled="hasMine(l, 'have') || !!state.busy || !myCharacter" :title="myCharacter ? 'Tell them you have one (shows on the listing)' : 'Fill in your character first (Post → Whisper me as)'"
              @click="react(l, 'have')">{{ hasMine(l, 'have') ? 'Offered' : 'I have one' }}</button>
            <button v-if="whisperFor(l)" class="bg-gray-700 hover:bg-gray-600 rounded px-1.5" :title="whisperFor(l)"
              @click="chat(`${l.number}-w`, whisperFor(l)!)"><i v-if="pressed === `${l.number}-w`" class="fas fa-check text-green-400" /> Whisper</button>
          </template>
          <template v-else>
            <button class="bg-gray-700 hover:bg-gray-600 rounded px-1.5" :disabled="!!state.busy"
              :title="l.kind === 'wanted' ? 'Got it: take it off the board' : 'Handed over / sold: take it off the board'"
              @click="close(l, 'completed')">{{ l.kind === 'wanted' ? 'Got it' : l.kind === 'sell' ? 'Sold' : 'Given' }}</button>
            <button class="rounded px-1.5" :class="confirmRemove === l.number ? 'bg-red-700 text-white' : 'text-gray-400 hover:text-gray-100'"
              :disabled="!!state.busy" @click="close(l, 'not_planned')">{{ confirmRemove === l.number ? 'Remove? Click again' : 'Remove' }}</button>
          </template>
          <span class="ml-auto text-xs text-gray-600">#{{ l.number }}</span>
        </div>
      </div>
      <div v-if="state.updated" class="px-1 pt-1 text-xs text-gray-600">
        {{ modeHelp }} Claims and offers show on the listing for everyone in the group.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  KINDS, CURRENCIES, useBoard, refreshBoard, postListing, commentOn, closeListing, whisperFor, replyWhisper,
  inviteCommand, itemFromText, validCharacter, oneLine, loadMyCharacter, saveMyCharacter, currentLeague, postDraft,
  type BoardKind, type Currency, type Listing, type ListingData
} from './board'
import { chatMode, runChat } from '../companion/chat'

defineProps<{ fill?: boolean }>()

const { state, listings } = useBoard()
const tab = ref<BoardKind>('sell')
const onlyMine = ref(false)
const open = ref(new Set<number>())
const league = currentLeague()

const shown = computed(() => listings.value
  .filter(l => l.kind === tab.value && (!onlyMine.value || l.mine))
  .sort((a, b) => b.created - a.created))
function count (k: BoardKind) { return listings.value.filter(l => l.kind === k && !l.mine).length }
const emptyText = computed(() => tab.value === 'give' ? 'Nothing to give away yet.'
  : tab.value === 'sell' ? 'Nothing for sale yet.' : 'Nobody is looking for anything yet.')

function toggle (n: number) {
  const s = new Set(open.value)
  if (s.has(n)) s.delete(n); else s.add(n)
  open.value = s
}

// ---- status ---------------------------------------------------------------
const now = ref(Date.now())
const statusText = computed(() => state.value.busy ?? (state.value.updated ? `updated ${ago(state.value.updated)}` : ''))
const statusTitle = 'Refreshes when you open it and every few minutes while it is open.'
function ago (t: number) {
  const s = Math.max(0, Math.round((now.value - t) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
function rarityClass (r?: string) {
  return r === 'Unique' ? 'text-orange-300' : r === 'Rare' ? 'text-yellow-200' : r === 'Magic' ? 'text-blue-300' : r === 'Gem' ? 'text-teal-300' : r === 'Currency' ? 'text-yellow-100' : ''
}

// ---- chat buttons (one message per click) ------------------------------------
const mode = chatMode()
const modeHelp = mode === 'send' ? 'Whisper / Invite type one message into game chat per click.' : 'Whisper / Invite copy the message: paste it in game chat.'
const pressed = ref<string | null>(null)
let pressedTimer: ReturnType<typeof setTimeout> | null = null
function chat (key: string, text: string) {
  runChat(text)
  pressed.value = key
  if (pressedTimer) clearTimeout(pressedTimer)
  pressedTimer = setTimeout(() => { pressed.value = null }, 1500)
}

// ---- claims, offers, closing -----------------------------------------------------
const myCharacter = ref(loadMyCharacter())
function hasMine (l: Listing, type: 'claim' | 'have') {
  return l.comments.some(c => c.type === type && c.author === state.value.login)
}
function react (l: Listing, type: 'claim' | 'have') {
  commentOn(l, { type, character: myCharacter.value || undefined })
}
const confirmRemove = ref<number | null>(null)
function close (l: Listing, reason: 'completed' | 'not_planned') {
  if (reason === 'not_planned' && confirmRemove.value !== l.number) {
    confirmRemove.value = l.number
    return
  }
  confirmRemove.value = null
  closeListing(l, reason)
}

// ---- post form ----------------------------------------------------------------
interface Form { kind: BoardKind, item: string, name: string, base?: string, rarity?: string, amount: number | '', currency: Currency, note: string, character: string }
const form = ref<Form | null>(null)
function openForm (item = '') {
  form.value = { kind: tab.value, item: '', name: '', amount: '', currency: 'chaos', note: '', character: myCharacter.value }
  if (item) {
    form.value.item = item
    if (form.value.kind === 'wanted') form.value.kind = 'sell'
    fromItem()
  }
}
function fromItem () {
  const f = form.value
  if (!f) return
  const it = itemFromText(f.item)
  f.base = it?.base
  f.rarity = it?.rarity
  if (it) f.name = it.name
}
const formProblem = computed(() => {
  const f = form.value
  if (!f) return ''
  if (!oneLine(f.name, 120)) return f.kind === 'wanted' ? 'Say what you need.' : 'Paste the item text or type a name.'
  if (f.kind === 'sell' && !(typeof f.amount === 'number' && f.amount > 0)) return 'Set a price.'
  if (!validCharacter(f.character)) return 'Fill in the character friends should whisper (letters, numbers and _).'
  return ''
})
function submit () {
  const f = form.value
  if (!f || formProblem.value) return
  const character = validCharacter(f.character)!
  myCharacter.value = character
  saveMyCharacter(character)
  const d: ListingData = {
    kind: f.kind,
    name: oneLine(f.name, 120),
    character,
    league: league || undefined
  }
  if (f.base && f.base !== d.name) d.base = oneLine(f.base, 80)
  if (f.rarity) d.rarity = oneLine(f.rarity, 20)
  if (f.item.trim() && itemFromText(f.item)) d.item = f.item.replace(/\r/g, '').trim().slice(0, 4000)
  if (f.kind === 'sell' && typeof f.amount === 'number') d.price = { amount: f.amount, currency: f.currency }
  const note = oneLine(f.note, 300)
  if (note) d.note = note
  postListing(d)
  tab.value = f.kind
}
// close the form once the post went through
watch(() => state.value.done, () => {
  if (form.value && !state.value.error) form.value = null
})

// item sent by the "Post to friends' board" hotkey
watch(postDraft, (d) => { if (d) { openForm(d.item); postDraft.value = null } }, { immediate: true })

// ---- refresh --------------------------------------------------------------------
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  refreshBoard()
  timer = setInterval(() => {
    now.value = Date.now()
    if (document.visibilityState === 'visible' && Date.now() - (state.value.updated ?? 0) > 180_000) refreshBoard()
  }, 30_000)
})
onUnmounted(() => { if (timer) clearInterval(timer) })

defineExpose({ openForm })
</script>
