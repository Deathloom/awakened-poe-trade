// Deathloom fork: character levels from Client.txt ("<name> (<class>) is now
// level N"). The overlay window records them (it runs as long as Loot Goblin
// does); the Loot Goblin window reads them for the levelling planner. Party
// members' level-ups show up too, so every name is kept and the player picks
// theirs (the most recent one by default). Nothing is sent anywhere.

import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { parseLogLine } from './game-log'
import { STEPS, loadCampaignStep } from './campaign-route'

export interface CharLevel { name: string, cls: string, level: number, at: number }
// Campaign progress from Client.txt, per character: quest rewards received and
// bosses met. Quest hand-ins aren't in the log; a received passive / respec
// point ticks the nearest such quest on the guide's route.
export interface CharProgress {
  // first level-up seen (2 = followed from the start, so the counts are complete)
  firstLevel: number
  passives: number
  respec: number
  // quest names (route) ticked by a received point
  quests: string[]
  // boss names (route kill lines) whose dialogue was seen
  bosses: string[]
}
export interface CharLevels {
  chars: CharLevel[]
  // the player's pick; '' = most recent level-up
  selected: string
  // level typed in by the player for the selected character (null = from Client.txt)
  manual: { name: string, level: number } | null
  // quest passive points typed in (null = from the game log or the campaign guide)
  questPoints: number | null
  progress: Record<string, CharProgress>
}

export const CHAR_LEVELS_KEY = 'deathloom.char-levels.v1'
const MAX_CHARS = 20

export function loadCharLevels (): CharLevels {
  const empty: CharLevels = { chars: [], selected: '', manual: null, questPoints: null, progress: {} }
  try {
    const raw = JSON.parse(localStorage.getItem(CHAR_LEVELS_KEY) ?? 'null')
    if (!raw || !Array.isArray(raw.chars)) return empty
    return {
      chars: raw.chars.filter((c: Partial<CharLevel> | null) => typeof c?.name === 'string' && Number.isFinite(c.level)).slice(0, MAX_CHARS),
      selected: typeof raw.selected === 'string' ? raw.selected : '',
      manual: raw.manual && typeof raw.manual.name === 'string' && Number.isFinite(raw.manual.level) ? raw.manual : null,
      questPoints: Number.isFinite(raw.questPoints) ? raw.questPoints : null,
      progress: raw.progress && typeof raw.progress === 'object' ? raw.progress : {}
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
  // keep the store small: progress only for known characters
  const progress = Object.fromEntries(Object.entries(v.progress).filter(([key]) => !key || chars.some(c => c.name === key)))
  progress[name] ??= emptyProgress(level)
  return { ...v, chars, manual, progress }
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

function emptyProgress (firstLevel: number): CharProgress {
  return { firstLevel, passives: 0, respec: 0, quests: [], bosses: [] }
}

// Progress of the character the planner follows ('' before any level-up is seen)
export function progressOf (v: CharLevels, name: string | undefined): CharProgress | null {
  return v.progress[name ?? ''] ?? null
}

// A quest passive / respec point arrived: tick the first quest on the route up
// to a few steps past the guide's position that gives one and isn't ticked yet
// returns the points that quest gives (0: nothing to tick)
function tickQuest (p: CharProgress, kind: 'passive' | 'respec', guideIndex: number): number {
  const end = Math.min(STEPS.length, guideIndex + 4)
  for (let i = 0; i < end; i++) {
    for (const t of STEPS[i].tasks) {
      for (const part of t.parts) {
        if (typeof part === 'string' || part.k !== 'quest') continue
        const name = String(part.v)
        const gives = kind === 'passive' ? (part.passive ?? 0) > 0 : (part.respec ?? 0) > 0 && !part.passive
        if (gives && !p.quests.includes(name)) {
          p.quests.push(name)
          return kind === 'passive' ? part.passive ?? 1 : part.respec ?? 2
        }
      }
    }
  }
  return 0
}

// "Brutus, the Warden: …" -> route kill "Brutus, Lord Incarcerator" near the guide's position
function tickBoss (p: CharProgress, speaker: string, guideIndex: number) {
  const key = speaker.split(',')[0].trim().toLowerCase()
  if (key.length < 4) return
  for (let i = Math.max(0, guideIndex - 2); i < Math.min(STEPS.length, guideIndex + 5); i++) {
    for (const t of STEPS[i].tasks) {
      for (const part of t.parts) {
        if (typeof part === 'string' || (part.k !== 'kill' && part.k !== 'arena')) continue
        const name = String(part.v)
        if (name.toLowerCase().startsWith(key) && !p.bosses.includes(name)) {
          p.bosses.push(name)
          if (p.bosses.length > 80) p.bosses.shift()
          return
        }
      }
    }
  }
}

// Client.txt lines -> updated store (null: nothing changed)
export function applyLogLines (start: CharLevels, lines: string[], lang: string, guideIndex = loadCampaignStep()): CharLevels | null {
  let v: CharLevels | null = null
  for (const line of lines) {
    const ev = parseLogLine(line, lang)
    if (!ev) continue
    if (ev.type === 'level') {
      v = recordLevel(v ?? start, ev.char, ev.cls, ev.level)
    } else if (ev.type === 'questPoint' || ev.type === 'speech') {
      v ??= { ...start, progress: { ...start.progress } }
      const name = currentChar(v)?.name ?? ''
      const p = v.progress[name] ??= emptyProgress(name ? 99 : 1)
      if (ev.type === 'questPoint') {
        if (ev.kind === 'passive') p.passives += ev.count
        else p.respec += ev.count
        // one quest can give 2 points (An End to Hunger; respec quests give 2)
        let left = ev.count
        while (left > 0) {
          const got = tickQuest(p, ev.kind, guideIndex)
          if (!got) break
          left -= got
        }
      } else {
        tickBoss(p, ev.speaker, guideIndex)
      }
    }
  }
  return v
}

// Called once in the overlay window
export function startLevelRecorder () {
  Host.onEvent('MAIN->CLIENT::game-log', (e) => {
    const v = applyLogLines(loadCharLevels(), e.lines, AppConfig().language)
    if (v) saveCharLevels(v)
  })
}
