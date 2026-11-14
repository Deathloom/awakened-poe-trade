// Deathloom fork: friends' trade board (Give / Sell / Wanted).
//
// Listings are GitHub issues in the group's builds repo (main → PoB's
// SyncServer.lua, the player's own GitHub sign-in). Each listing's body is
// readable on GitHub and carries its data as base64 JSON in an HTML comment.
// Everything read back is someone else's text: parsed defensively and only
// ever shown as plain text. Contacting a friend is a chat button: one chat
// message per click (copy or send, like the trade companion), never automatic.

import { computed, ref, shallowRef } from 'vue'
import type { BoardState, BoardRawListing } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { loadCharLevels, currentChar } from '../companion/char-level'

export type BoardKind = 'give' | 'sell' | 'wanted'
export const KINDS: Array<{ key: BoardKind, label: string, icon: string, hint: string }> = [
  { key: 'give', label: 'Give', icon: 'fa-gift', hint: 'Free for friends: claim it and the poster hands it over in game' },
  { key: 'sell', label: 'Sell', icon: 'fa-coins', hint: 'Priced items for friends first: whisper the seller' },
  { key: 'wanted', label: 'Wanted', icon: 'fa-search', hint: 'What friends need: tick "I have one" and whisper them' }
]
export const CURRENCIES = ['chaos', 'divine'] as const
export type Currency = typeof CURRENCIES[number]

export interface ListingData {
  kind: BoardKind
  name: string
  base?: string
  rarity?: string
  // full item text copied from the game (Ctrl+C)
  item?: string
  price?: { amount: number, currency: Currency }
  note?: string
  // character to whisper
  character?: string
  league?: string
}

export interface CommentData {
  type: 'claim' | 'have' | 'note'
  character?: string
  text?: string
}

export interface BoardComment extends CommentData {
  author: string
  created: number
}

export interface Listing extends ListingData {
  number: number
  author: string
  created: number
  updated: number
  comments: BoardComment[]
  mine: boolean
}

const DATA_RE = /<!-- lg-board:([A-Za-z0-9+/=]{1,20000}) -->/
const COMMENT_RE = /<!-- lg-board-c:([A-Za-z0-9+/=]{1,8000}) -->/
const MAX_ITEM = 4000
const MAX_NOTE = 300

// ---- encoding --------------------------------------------------------------
function toB64 (v: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(v))
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin)
}
function fromB64 (s: string): unknown {
  const bin = atob(s)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

// one line, no control characters, capped
export function oneLine (v: unknown, max: number): string {
  // eslint-disable-next-line no-control-regex
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''
}
// PoE character names: letters, digits and underscores
export function validCharacter (v: unknown): string | undefined {
  return typeof v === 'string' && /^[A-Za-z0-9_]{3,23}$/.test(v.trim()) ? v.trim() : undefined
}
function md (s: string) {
  // keep a friend's text from becoming links, mentions or HTML on GitHub
  return s.replace(/[\\`*_[\]<>@#|~]/g, c => '\\' + c)
}

// ---- reading -----------------------------------------------------------------
function parseData (body: string): ListingData | null {
  const m = DATA_RE.exec(body)
  if (!m) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let raw: any
  try { raw = fromB64(m[1]) } catch { return null }
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null
  if (!['give', 'sell', 'wanted'].includes(raw.kind)) return null
  const name = oneLine(raw.name, 120)
  if (!name) return null
  const out: ListingData = { kind: raw.kind, name }
  const base = oneLine(raw.base, 80)
  if (base) out.base = base
  const rarity = oneLine(raw.rarity, 20)
  if (rarity) out.rarity = rarity
  // eslint-disable-next-line no-control-regex
  if (typeof raw.item === 'string' && raw.item.trim()) out.item = raw.item.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, MAX_ITEM)
  if (raw.price && Number.isFinite(raw.price.amount) && raw.price.amount > 0 && CURRENCIES.includes(raw.price.currency)) {
    out.price = { amount: Math.round(raw.price.amount * 100) / 100, currency: raw.price.currency }
  }
  const note = oneLine(raw.note, MAX_NOTE)
  if (note) out.note = note
  const ch = validCharacter(raw.character)
  if (ch) out.character = ch
  const league = oneLine(raw.league, 60)
  if (league) out.league = league
  return out
}

function parseComment (body: string): CommentData {
  const m = COMMENT_RE.exec(body)
  if (m) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any = fromB64(m[1])
      if (raw && raw.v === 1 && ['claim', 'have', 'note'].includes(raw.type)) {
        const out: CommentData = { type: raw.type }
        const ch = validCharacter(raw.character)
        if (ch) out.character = ch
        const text = oneLine(raw.text, MAX_NOTE)
        if (text) out.text = text
        return out
      }
    } catch {}
  }
  // written on GitHub: show the text
  return { type: 'note', text: oneLine(body.replace(/<!--[\s\S]*?-->/g, ''), MAX_NOTE) }
}

function time (s: string | undefined): number {
  const t = s ? Date.parse(s) : NaN
  return Number.isFinite(t) ? t : 0
}

export function toListing (raw: BoardRawListing, login: string | undefined): Listing | null {
  const data = parseData(raw.body)
  if (!data || !raw.author) return null
  return {
    ...data,
    number: raw.number,
    author: raw.author,
    created: time(raw.created),
    updated: time(raw.updated),
    comments: raw.comments.filter(c => c.author).map(c => ({ ...parseComment(c.body), author: c.author!, created: time(c.created) })),
    mine: !!login && raw.author.toLowerCase() === login.toLowerCase()
  }
}

// ---- writing -----------------------------------------------------------------
export function listingTitle (d: ListingData): string {
  const price = d.kind === 'sell' && d.price ? ` · ${d.price.amount} ${d.price.currency}` : ''
  return oneLine(`${d.name}${d.base && d.base !== d.name ? ` (${d.base})` : ''}${price}`, 180)
}

export function listingBody (d: ListingData): string {
  const lines: string[] = []
  const kind = KINDS.find(k => k.key === d.kind)!.label
  lines.push(`**${kind}**: ${md(d.name)}${d.base && d.base !== d.name ? ` (${md(d.base)})` : ''}`)
  if (d.kind === 'sell' && d.price) lines.push(`Price: ${d.price.amount} ${d.price.currency}`)
  if (d.character) lines.push(`Whisper: ${md('@' + d.character)}`)
  if (d.league) lines.push(`League: ${md(d.league)}`)
  if (d.note) lines.push(`Note: ${md(d.note)}`)
  if (d.item) {
    lines.push('', '<details><summary>Item text</summary>', '', '```', d.item.replace(/```/g, "'''"), '```', '', '</details>')
  }
  lines.push('', "_Posted with Loot Goblin's friends' trade board._")
  lines.push(`<!-- lg-board:${toB64({ v: 1, ...d })} -->`)
  return lines.join('\n')
}

export function commentBody (c: CommentData, listing: Listing): string {
  const who = c.character ? md('@' + c.character) : 'someone'
  const text = c.type === 'claim' ? `${who} would like this.`
    : c.type === 'have' ? `${who} has one${listing.kind === 'wanted' ? ' for you' : ''}.`
      : md(c.text ?? '')
  return `${text}${c.text && c.type !== 'note' ? `\n\n${md(c.text)}` : ''}\n\n<!-- lg-board-c:${toB64({ v: 1, ...c })} -->`
}

// Name, base and rarity from the item text the game copies (Ctrl+C)
export function itemFromText (text: string): { name: string, base?: string, rarity?: string } | null {
  const block = text.replace(/\r/g, '').split('\n--------\n')[0]?.split('\n').map(l => l.trim()).filter(Boolean) ?? []
  const ri = block.findIndex(l => /^Rarity: /.test(l))
  if (ri < 0) return null
  const rarity = block[ri].slice(8)
  const names = block.slice(ri + 1)
  if (!names.length) return null
  return { name: oneLine(names[0], 120), base: names[1] ? oneLine(names[1], 80) : undefined, rarity }
}

// ---- chat (one message per click; the setting decides copy or send) -------------
function itemRef (l: Listing) { return oneLine(l.name, 60) }
export function whisperFor (l: Listing): string | undefined {
  if (!l.character) return undefined
  const msg = l.kind === 'sell'
    ? `Hi, I'd like your ${itemRef(l)}${l.price ? ` for ${l.price.amount} ${l.price.currency}` : ''} from the friends' board`
    : l.kind === 'give'
      ? `Hi, could I have your ${itemRef(l)} from the friends' board?`
      : `Hi, I have the ${itemRef(l)} you wanted on the friends' board`
  return `@${l.character} ${msg}`
}
export function replyWhisper (l: Listing, character: string): string {
  return l.kind === 'wanted'
    ? `@${character} Hi, thanks! Is the ${itemRef(l)} still free?`
    : `@${character} Hi, the ${itemRef(l)} from the friends' board is yours, sending a party invite`
}
export function inviteCommand (character: string) { return `/invite ${character}` }

// ---- state ---------------------------------------------------------------------
const state = shallowRef<BoardState>({ busy: null, signedIn: null, listings: [], updated: null, done: 0 })
let listening = false
function listen () {
  if (listening) return
  listening = true
  Host.onEvent('MAIN->CLIENT::board-state', (s) => { state.value = s })
  Host.sendEvent({ name: 'CLIENT->MAIN::board', payload: { op: 'state' } })
}

export function useBoard () {
  listen()
  const listings = computed(() => state.value.listings
    .map(l => toListing(l, state.value.login))
    .filter((l): l is Listing => l != null))
  return { state, listings }
}

export function refreshBoard () {
  listen()
  Host.sendEvent({ name: 'CLIENT->MAIN::board', payload: { op: 'list' } })
}

export function postListing (d: ListingData) {
  Host.sendEvent({ name: 'CLIENT->MAIN::board', payload: { op: 'post', kind: d.kind, title: listingTitle(d), body: listingBody(d) } })
}
export function commentOn (l: Listing, c: CommentData) {
  Host.sendEvent({ name: 'CLIENT->MAIN::board', payload: { op: 'comment', number: l.number, body: commentBody(c, l) } })
}
export function closeListing (l: Listing, reason: 'completed' | 'not_planned') {
  Host.sendEvent({ name: 'CLIENT->MAIN::board', payload: { op: 'close', number: l.number, reason } })
}

// The character friends whisper (remembered; defaults to the one you play)
const CHAR_KEY = 'deathloom.board-character.v1'
export function loadMyCharacter (): string {
  try {
    const saved = localStorage.getItem(CHAR_KEY)
    if (saved && validCharacter(saved)) return saved
  } catch {}
  return validCharacter(currentChar(loadCharLevels())?.name) ?? ''
}
export function saveMyCharacter (v: string) {
  try { localStorage.setItem(CHAR_KEY, v) } catch {}
}
export function currentLeague (): string {
  return oneLine(AppConfig().leagueId ?? '', 60)
}

// Item sent by the "Post to friends' board" hotkey (the form picks it up)
export const postDraft = ref<{ item: string, at: number } | null>(null)
