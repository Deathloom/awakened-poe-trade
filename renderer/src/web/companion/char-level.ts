// Deathloom fork: character levels from Client.txt ("<name> (<class>) is now
// level N"). The overlay window records them (it runs as long as Loot Goblin
// does); the Loot Goblin window reads them for the levelling planner. Party
// members' level-ups show up too, so every name is kept and the player picks
// theirs (the most recent one by default). Nothing is sent anywhere.

import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { parseLogLine } from './game-log'

export interface CharLevel { name: string, cls: string, level: number, at: number }
export interface CharLevels {
  chars: CharLevel[]
  // the player's pick; '' = most recent level-up
  selected: string
  // level typed in by the player for the selected character (null = from Client.txt)
  manual: { name: string, level: number } | null
  // quest passive points typed in (null = from the campaign guide)
  questPoints: number | null
}

export const CHAR_LEVELS_KEY = 'deathloom.char-levels.v1'
const MAX_CHARS = 20

export function loadCharLevels (): CharLevels {
  const empty: CharLevels = { chars: [], selected: '', manual: null, questPoints: null }
  try {
    const raw = JSON.parse(localStorage.getItem(CHAR_LEVELS_KEY) ?? 'null')
    if (!raw || !Array.isArray(raw.chars)) return empty
    return {
      chars: raw.chars.filter((c: Partial<CharLevel> | null) => typeof c?.name === 'string' && Number.isFinite(c.level)).slice(0, MAX_CHARS),
      selected: typeof raw.selected === 'string' ? raw.selected : '',
      manual: raw.manual && typeof raw.manual.name === 'string' && Number.isFinite(raw.manual.level) ? raw.manual : null,
      questPoints: Number.isFinite(raw.questPoints) ? raw.questPoints : null
    }
  } catch { return empty }
}

export function saveCharLevels (v: CharLevels) {
  try { localStorage.setItem(CHAR_LEVELS_KEY, JSON.stringify(v)) } catch {}
}

export function recordLevel (v: CharLevels, name: string, cls: string, level: number, at = Date.now()): CharLevels {
  const chars = [{ name, cls, level, at }, ...v.chars.filter(c => c.name !== name)]
    .sort((a, b) => b.at - a.at).slice(0, MAX_CHARS)
  // a real level-up replaces a level typed in for that character
  const manual = v.manual?.name === name ? null : v.manual
  return { ...v, chars, manual }
}

// The character the planner follows and its level
export function currentChar (v: CharLevels): { name: string, cls: string, level: number, manual: boolean } | null {
  const ch = (v.selected && v.chars.find(c => c.name === v.selected)) || v.chars[0]
  const name = ch?.name ?? v.manual?.name ?? ''
  if (v.manual && v.manual.name === name) {
    return { name, cls: ch?.cls ?? '', level: v.manual.level, manual: true }
  }
  return ch ? { name: ch.name, cls: ch.cls, level: ch.level, manual: false } : null
}

// Called once in the overlay window
export function startLevelRecorder () {
  Host.onEvent('MAIN->CLIENT::game-log', (e) => {
    const lang = AppConfig().language
    let v: CharLevels | null = null
    for (const line of e.lines) {
      const ev = parseLogLine(line, lang)
      if (ev?.type !== 'level') continue
      v = recordLevel(v ?? loadCharLevels(), ev.char, ev.cls, ev.level)
    }
    if (v) saveCharLevels(v)
  })
}
