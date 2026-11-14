// Deathloom fork: reads Client.txt lines (sent by main as they're written) for
// the trade companion and the campaign guide. Reading the log is allowed by
// GGG; nothing here sends anything to the game.

import { CLIENT_STRINGS as _$ } from '@/assets/data'
import { TRADE_WHISPER, TRADE_BULK_WHISPER } from '@/web/client-log/client-log'

export type LogEvent =
  | { type: 'trade', direction: 'from' | 'to', char: string, item: string, price: string, league: string, tab?: { name: string, left: number, top: number }, message?: string, bulk: boolean }
  | { type: 'joined' | 'left', char: string }
  | { type: 'zone', name: string }
  | { type: 'area', level: number, code: string }
  | { type: 'tradeResult', accepted: boolean }
  | { type: 'level', char: string, cls: string, level: number }
  // quest rewards ("You have received a Passive Skill Point." / "2 Passive Respec Points.")
  | { type: 'questPoint', kind: 'passive' | 'respec', count: number }
  // someone speaking (NPC / boss dialogue; local chat looks the same, so only
  // match it against known boss names)
  | { type: 'speech', speaker: string }
  // /passives: "22 Passive Skill Points from quests:" then "(1 from The Marooned Mariner)" per quest
  | { type: 'passivesList', total: number }
  | { type: 'passiveFrom', quest: string, count: number }
  // a passive taken / refunded (character tree, or the atlas tree for atlas_* ids)
  | { type: 'passiveAlloc', id: string, name: string, on: boolean, atlas: boolean }
  | { type: 'death', char: string }
  | { type: 'kitava', which: 'cruel' | 'merciless' }
  | { type: 'atlasPoint', count: number }
  | { type: 'afk', on: boolean }
  // "[LOADING SCREEN] (The Coast) Duration = 4.1 seconds"
  | { type: 'loading', zone: string, seconds: number }
  | { type: 'disconnect' }

// English only (the game client's language must be English for these)
const JOINED = /^: (?<char>.+) has joined the area\.$/
const LEFT = /^: (?<char>.+) has left the area\.$/
const ENTERED = /^: You have entered (?<zone>.+)\.$/
const TRADE_ACCEPTED = /^: Trade accepted\.$/
const TRADE_CANCELLED = /^: Trade cancelled\.$/
// also shown for party members in the same area
const LEVEL_UP = /^: (?<char>.+) \((?<cls>[^)]+)\) is now level (?<level>\d+)$/
const PASSIVE_POINT = /^: You have received (?:a|(?<n>\d+)) Passive Skill Points?\.$/
const RESPEC_POINTS = /^: You have received (?:a|(?<n>\d+)) Passive Respec Points?\.$/
// "Brutus, the Warden: Your crime is trespass." (no channel prefix like # $ % & @)
const SPEECH = /^(?<speaker>[A-Z][^:#$%&@<>]{1,40}): \S/
const PASSIVES_LIST = /^: (?<n>\d+) Passive Skill Points? from quests:$/
const PASSIVE_FROM = /^: \((?<n>\d+) from (?<quest>.+)\)$/
const ALLOC = /^Successfully (?<un>un)?allocated passive skill id: (?<id>[^,]+), name: (?<name>.+)$/
const SLAIN = /^: (?<char>.+) has been slain\.$/
const KITAVA = /^: You have been permanently weakened by Kitava's (?<which>cruel|merciless) affliction/
const ATLAS_POINT = /^: You have received (?:an|(?<n>\d+)) Atlas Skill Points?\.$/
const AFK = /^: AFK mode is now (?<on>ON|OFF)/
const LOADING = /^\[LOADING SCREEN\] \((?<zone>.+)\) Duration = (?<s>[\d.]+) seconds/
const GENERATING = /Generating level (?<level>\d+) area "(?<code>[^"]+)"/

export function parseLogLine (line: string, language = 'en'): LogEvent | null {
  const gen = line.match(GENERATING)
  if (gen) return { type: 'area', level: Number(gen.groups!.level), code: gen.groups!.code }

  const text = line.split('] ').slice(1).join('] ')
  if (!text) return null

  let m: RegExpMatchArray | null
  if ((m = text.match(ENTERED))) return { type: 'zone', name: m.groups!.zone }
  if (TRADE_ACCEPTED.test(text)) return { type: 'tradeResult', accepted: true }
  if (TRADE_CANCELLED.test(text)) return { type: 'tradeResult', accepted: false }
  if ((m = text.match(LEVEL_UP))) return { type: 'level', char: m.groups!.char, cls: m.groups!.cls, level: Number(m.groups!.level) }
  if ((m = text.match(PASSIVE_POINT))) return { type: 'questPoint', kind: 'passive', count: Number(m.groups!.n ?? 1) }
  if ((m = text.match(RESPEC_POINTS))) return { type: 'questPoint', kind: 'respec', count: Number(m.groups!.n ?? 1) }
  if ((m = text.match(PASSIVES_LIST))) return { type: 'passivesList', total: Number(m.groups!.n) }
  if ((m = text.match(PASSIVE_FROM))) return { type: 'passiveFrom', quest: m.groups!.quest, count: Number(m.groups!.n) }
  if ((m = text.match(ALLOC))) return { type: 'passiveAlloc', id: m.groups!.id.trim(), name: m.groups!.name.trim(), on: !m.groups!.un, atlas: m.groups!.id.startsWith('atlas_') }
  if ((m = text.match(SLAIN))) return { type: 'death', char: m.groups!.char }
  if ((m = text.match(KITAVA))) return { type: 'kitava', which: m.groups!.which as 'cruel' | 'merciless' }
  if ((m = text.match(ATLAS_POINT))) return { type: 'atlasPoint', count: Number(m.groups!.n ?? 1) }
  if ((m = text.match(AFK))) return { type: 'afk', on: m.groups!.on === 'ON' }
  if ((m = text.match(LOADING))) return { type: 'loading', zone: m.groups!.zone, seconds: Number(m.groups!.s) }
  if (text.startsWith('Abnormal disconnect')) return { type: 'disconnect' }
  if ((m = text.match(JOINED))) return { type: 'joined', char: m.groups!.char }
  if ((m = text.match(LEFT))) return { type: 'left', char: m.groups!.char }

  let direction: 'from' | 'to'
  if ((m = text.match(_$.CHAT_WHISPER_FROM))) direction = 'from'
  else if ((m = text.match(_$.CHAT_WHISPER_TO))) direction = 'to'
  else {
    if ((m = text.match(SPEECH))) return { type: 'speech', speaker: m.groups!.speaker.trim() }
    return null
  }
  const char = m.groups!.char_name
  const body = m.groups!.body

  const single = TRADE_WHISPER[language]
  const bulk = TRADE_BULK_WHISPER[language]
  if (single && (m = body.match(single))) {
    return {
      type: 'trade',
      direction,
      char,
      item: m.groups!.item,
      price: m.groups!.price,
      league: m.groups!.league,
      tab: { name: m.groups!.tab_name, left: Number(m.groups!.tab_left), top: Number(m.groups!.tab_top) },
      message: m.groups!.message?.trim() || undefined,
      bulk: false
    }
  }
  if (bulk && (m = body.match(bulk)) && m.groups?.item) {
    return {
      type: 'trade',
      direction,
      char,
      item: m.groups.item,
      price: m.groups.price,
      league: m.groups.league,
      message: m.groups.message?.trim() || undefined,
      bulk: true
    }
  }
  return null
}
