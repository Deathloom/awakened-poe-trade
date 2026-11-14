// Deathloom fork: character levels from Client.txt ("<name> (<class>) is now
// level N"). The overlay window records them (it runs as long as Loot Goblin
// does); the Loot Goblin window reads them for the levelling planner. Party
// members' level-ups show up too, so every name is kept and the player picks
// theirs (the most recent one by default). Nothing is sent anywhere.

import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { parseLogLine } from './game-log'
import { applySessionLines, loadPlaySession, savePlaySession } from './play-session'
import { STEPS, loadCampaignStep, actFromAreaCode, findStep, onlyActive } from './campaign-route'

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
  // /passives listed these quests (exact; replaces the ticks from received points)
  questsExact?: boolean
  // passives taken, by name (count; refunds subtract). Followed from level 2 = complete
  alloc?: Record<string, number>
  atlasPoints?: number
  deaths?: number
  deathsByAct?: Record<string, number>
  // time per act (ms between zone changes, gaps over 20 min not counted)
  actMs?: Record<string, number>
  kitava?: Array<'cruel' | 'merciless'>
  // where the character was and since when (for the act timer)
  lastAct?: number
  lastAt?: number
}

// Not per character (nothing in the log says whose it is)
export interface SessionInfo {
  afk: boolean
  disconnects: number
  loadingSeconds: number
  loadingCount: number
}
export const SESSION_KEY = 'deathloom.session.v1'
export function loadSession (): SessionInfo {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    if (raw && typeof raw === 'object') return { afk: !!raw.afk, disconnects: raw.disconnects || 0, loadingSeconds: raw.loadingSeconds || 0, loadingCount: raw.loadingCount || 0 }
  } catch {}
  return { afk: false, disconnects: 0, loadingSeconds: 0, loadingCount: 0 }
}
function saveSession (v: SessionInfo) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(v)) } catch {}
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
    if (!onlyActive(STEPS[i].only)) continue
    for (const t of STEPS[i].tasks) {
      if (!onlyActive(t.only)) continue
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

const ACT_GAP_MS = 20 * 60 * 1000
// /passives list being read (its lines can arrive in more than one batch)
let passivesList: string[] | null = null

// "2026/11/14 10:18:03 …" (local time of the PC)
function lineTime (line: string): number | null {
  const m = line.match(/^(\d{4})\/(\d\d)\/(\d\d) (\d\d):(\d\d):(\d\d)/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime()
}

// Rebuild every character's progress from the whole Client.txt (button in the
// levelling planner): replays the lines with a guide position per character,
// so counts and ticks are complete for characters made since the log started.
export function rebuildFromLog (current: CharLevels, lines: string[], lang: string): CharLevels {
  let v: CharLevels = { ...current, chars: [], progress: {} }
  const guide = new Map<string, number>()
  let act: number | null = null
  for (const line of lines) {
    const ev = parseLogLine(line, lang)
    if (ev?.type === 'level' && ev.level <= 2) guide.set(ev.char, 0)
    const name = currentChar(v)?.name ?? ''
    if (ev?.type === 'area') act = actFromAreaCode(ev.code)
    if (ev?.type === 'zone') {
      const j = findStep(ev.name, guide.get(name) ?? 0, act)
      if (j >= 0) guide.set(name, j)
    }
    v = applyLogLines(v, [line], lang, guide.get(name) ?? 0) ?? v
  }
  // keep the player's own choices
  return { ...v, selected: current.selected, manual: current.manual, questPoints: current.questPoints }
}

// Client.txt lines -> updated store (null: nothing changed)
export function applyLogLines (start: CharLevels, lines: string[], lang: string, guideIndex = loadCampaignStep(), session?: SessionInfo, now = Date.now()): CharLevels | null {
  let v: CharLevels | null = null
  const prog = () => {
    v ??= { ...start, progress: { ...start.progress } }
    const name = currentChar(v)?.name ?? ''
    const p = v.progress[name] = { ...(v.progress[name] ?? emptyProgress(name ? 99 : 1)) }
    return p
  }
  for (const line of lines) {
    const ev = parseLogLine(line, lang)
    if (!ev) continue
    const ts = lineTime(line) ?? now
    // /passives: the quest lines follow the header; anything else ends the list
    if (passivesList && ev.type !== 'passiveFrom') {
      const p = prog()
      p.quests = passivesList
      p.questsExact = true
      passivesList = null
    }
    if (ev.type === 'level') {
      v = recordLevel(v ?? start, ev.char, ev.cls, ev.level)
    } else if (ev.type === 'passivesList') {
      passivesList = []
      prog().passives = ev.total
    } else if (ev.type === 'passiveFrom') {
      if (passivesList) passivesList.push(ev.quest)
    } else if (ev.type === 'passiveAlloc') {
      const p = prog()
      if (ev.atlas) continue
      const alloc = { ...(p.alloc ?? {}) }
      alloc[ev.name] = Math.max(0, (alloc[ev.name] ?? 0) + (ev.on ? 1 : -1))
      p.alloc = alloc
    } else if (ev.type === 'death') {
      // only our character's deaths (party members die too)
      const cur = currentChar(v ?? start)?.name
      if (cur && ev.char !== cur) continue
      const p = prog()
      p.deaths = (p.deaths ?? 0) + 1
      if (p.lastAct) p.deathsByAct = { ...p.deathsByAct, [p.lastAct]: (p.deathsByAct?.[p.lastAct] ?? 0) + 1 }
    } else if (ev.type === 'kitava') {
      const p = prog()
      if (!p.kitava?.includes(ev.which)) p.kitava = [...(p.kitava ?? []), ev.which]
    } else if (ev.type === 'atlasPoint') {
      const p = prog()
      p.atlasPoints = (p.atlasPoints ?? 0) + ev.count
    } else if (ev.type === 'area') {
      // act timer: time between zone changes goes to the act you were in
      const act = actFromAreaCode(ev.code)
      const p = prog()
      if (p.lastAct && p.lastAt && ts - p.lastAt < ACT_GAP_MS && ts > p.lastAt) {
        p.actMs = { ...p.actMs, [p.lastAct]: (p.actMs?.[p.lastAct] ?? 0) + (ts - p.lastAt) }
      }
      p.lastAct = act ?? undefined
      p.lastAt = ts
    } else if (session && ev.type === 'afk') {
      session.afk = ev.on
    } else if (session && ev.type === 'disconnect') {
      session.disconnects++
    } else if (session && ev.type === 'loading') {
      session.loadingSeconds += ev.seconds
      session.loadingCount++
    } else if (ev.type === 'questPoint' || ev.type === 'speech') {
      const p = prog()
      if (ev.type === 'questPoint') {
        if (ev.kind === 'passive') p.passives += ev.count
        else p.respec += ev.count
        // single respec points come from elsewhere; quests give 2
        if (ev.kind === 'respec' && ev.count < 2) continue
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
  // the list may continue in the next batch of lines: store what we have so far
  if (passivesList) {
    const p = prog()
    p.quests = [...passivesList]
    p.questsExact = true
  }
  return v
}

// Called once in the overlay window
export function startLevelRecorder () {
  Host.onEvent('MAIN->CLIENT::game-log', (e) => {
    const session = loadSession()
    const before = JSON.stringify(session)
    const v = applyLogLines(loadCharLevels(), e.lines, AppConfig().language, loadCampaignStep(), session)
    if (v) saveCharLevels(v)
    if (JSON.stringify(session) !== before) saveSession(session)
    const levels = v ?? loadCharLevels()
    const play = applySessionLines(loadPlaySession(), e.lines, AppConfig().language, currentChar(levels)?.name ?? '')
    if (play) savePlaySession(play)
  })
}
