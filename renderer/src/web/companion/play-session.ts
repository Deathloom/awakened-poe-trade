// Deathloom fork: this play session from Client.txt: maps run and their time,
// league mechanics met (by the NPC that speaks), deaths, trades, levelling
// pace, loading screens and disconnects. Only reads the game's own log
// (allowed by GGG); nothing is sent anywhere. Recorded by the overlay window,
// shown in the Loot Goblin window.

import { parseLogLine } from './game-log'

export interface MapRun {
  code: string
  name: string
  level: number
  seed: string
  start: number
  // time spent inside this map instance (town / hideout trips not counted)
  ms: number
  deaths: number
  mechanics: string[]
}

export interface PlaySession {
  start: number
  lastAt: number
  maps: MapRun[]
  // instance you're in now
  here?: { seed: string, code: string, at: number, mechanics: string[] }
  mechanics: Record<string, number>
  deaths: number
  trades: number
  // last loading screens (seconds) + total count
  loads: number[]
  loadCount: number
  disconnects: Array<{ at: number, reason: string }>
  // level-up times per character
  levels: Record<string, Array<{ level: number, at: number }>>
}

export const PLAY_SESSION_KEY = 'deathloom.play-session.v1'
// no log line for this long: a new session starts
const NEW_SESSION_MS = 2 * 60 * 60 * 1000
// time between two area changes longer than this isn't counted (AFK / closed game)
const GAP_MS = 20 * 60 * 1000

// League NPCs that speak when their mechanic is in the area: speaker (name
// before the comma, lower case) -> mechanic
const MECHANIC_SPEAKERS: Record<string, string> = {
  'einhar': 'Bestiary',
  'alva valai': 'Incursion',
  'alva': 'Incursion',
  'niko': 'Delve',
  'jun': 'Betrayal',
  'sister cassia': 'Blight',
  'oshabi': 'Harvest',
  'strange voice': 'Delirium',
  'the envoy': 'Envoy',
  'the maven': 'Maven',
  'sirus': 'Sirus',
  'al-hezmin': 'Conqueror',
  'veritania': 'Conqueror',
  'drox': 'Conqueror',
  'baran': 'Conqueror',
  'zana': 'Zana',
  'tujen': 'Expedition',
  'rog': 'Expedition',
  'gwennen': 'Expedition',
  'dannig': 'Expedition',
  'the trialmaster': 'Ultimatum'
}

export function mechanicOf (speaker: string): string | null {
  const key = speaker.split(',')[0].trim().toLowerCase()
  return MECHANIC_SPEAKERS[key] ?? null
}

export function isMapArea (code: string): boolean {
  return /^Map/i.test(code) && !/Hideout/i.test(code)
}

export function emptySession (now = Date.now()): PlaySession {
  return { start: now, lastAt: now, maps: [], mechanics: {}, deaths: 0, trades: 0, loads: [], loadCount: 0, disconnects: [], levels: {} }
}

export function loadPlaySession (): PlaySession {
  try {
    const raw = JSON.parse(localStorage.getItem(PLAY_SESSION_KEY) ?? 'null')
    if (raw && typeof raw === 'object' && Array.isArray(raw.maps)) return { ...emptySession(raw.start), ...raw }
  } catch {}
  return emptySession()
}

export function savePlaySession (s: PlaySession) {
  try { localStorage.setItem(PLAY_SESSION_KEY, JSON.stringify(s)) } catch {}
}

function lineTime (line: string): number | null {
  const m = line.match(/^(\d{4})\/(\d\d)\/(\d\d) (\d\d):(\d\d):(\d\d)/)
  if (!m) return null
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime()
}

// Client.txt lines -> updated session (null: nothing changed). `me`: the
// character the levelling planner follows (party members die and level too).
export function applySessionLines (start: PlaySession, lines: string[], lang: string, me: string, now = Date.now()): PlaySession | null {
  let s: PlaySession | null = null
  const edit = (ts: number) => {
    if (!s) {
      s = structuredClone(start)
      if (ts - s.lastAt > NEW_SESSION_MS) s = emptySession(ts)
    }
    s.lastAt = Math.max(s.lastAt, ts)
    return s
  }
  const currentRun = (v: PlaySession) => {
    const run = v.maps[v.maps.length - 1]
    return run && v.here && run.seed === v.here.seed && run.code === v.here.code ? run : null
  }
  for (const line of lines) {
    const ev = parseLogLine(line, lang)
    if (!ev) continue
    const ts = lineTime(line) ?? now
    if (ev.type === 'area') {
      const v = edit(ts)
      // time in the instance we're leaving
      const run = currentRun(v)
      if (run && v.here && ts > v.here.at && ts - v.here.at < GAP_MS) run.ms += ts - v.here.at
      const seed = ev.seed ?? `${ev.code}@${ts}`
      const back = v.here?.seed === seed
      v.here = { seed, code: ev.code, at: ts, mechanics: back ? v.here!.mechanics : [] }
      // a new map, or back into one opened earlier (portal from hideout)
      if (isMapArea(ev.code) && !v.maps.some(m => m.seed === seed && m.code === ev.code)) {
        v.maps.push({ code: ev.code, name: '', level: ev.level, seed, start: ts, ms: 0, deaths: 0, mechanics: [] })
        if (v.maps.length > 60) v.maps.shift()
      } else if (isMapArea(ev.code)) {
        // returning to an earlier map: move it to the end so it's the current one
        const i = v.maps.findIndex(m => m.seed === seed && m.code === ev.code)
        v.maps.push(...v.maps.splice(i, 1))
        v.here.mechanics = v.maps[v.maps.length - 1].mechanics.slice()
      }
    } else if (ev.type === 'zone') {
      const v = edit(ts)
      const run = currentRun(v)
      if (run && !run.name) run.name = ev.name
    } else if (ev.type === 'speech') {
      const mech = mechanicOf(ev.speaker)
      if (!mech) continue
      const v = edit(ts)
      if (!v.here || v.here.mechanics.includes(mech)) continue
      v.here.mechanics.push(mech)
      v.mechanics[mech] = (v.mechanics[mech] ?? 0) + 1
      const run = currentRun(v)
      if (run && !run.mechanics.includes(mech)) run.mechanics.push(mech)
    } else if (ev.type === 'death') {
      if (me && ev.char !== me) continue
      const v = edit(ts)
      v.deaths++
      const run = currentRun(v)
      if (run) run.deaths++
    } else if (ev.type === 'tradeResult') {
      if (!ev.accepted) continue
      edit(ts).trades++
    } else if (ev.type === 'loading') {
      const v = edit(ts)
      v.loads = [...v.loads, ev.seconds].slice(-30)
      v.loadCount++
    } else if (ev.type === 'disconnect') {
      const v = edit(ts)
      v.disconnects = [...v.disconnects, { at: ts, reason: ev.reason }].slice(-20)
    } else if (ev.type === 'level') {
      const v = edit(ts)
      const list = (v.levels[ev.char] ?? []).filter(l => l.level < ev.level)
      v.levels[ev.char] = [...list, { level: ev.level, at: ts }].slice(-15)
      // keep a few characters only
      const names = Object.keys(v.levels)
      if (names.length > 6) {
        const last = (n: string) => v.levels[n][v.levels[n].length - 1]?.at ?? 0
        names.sort((a, b) => last(a) - last(b))
        v.levels = Object.fromEntries(Object.entries(v.levels).filter(([n]) => n !== names[0]))
      }
    }
  }
  return s
}

// Time in the current map so far (live timer)
export function currentMapMs (s: PlaySession, now = Date.now()): number | null {
  const run = s.maps[s.maps.length - 1]
  if (!run || !s.here || run.seed !== s.here.seed || run.code !== s.here.code) return null
  const live = now > s.here.at && now - s.here.at < GAP_MS ? now - s.here.at : 0
  return run.ms + live
}

export interface SessionHint { text: string, warn?: boolean }

export function sessionHints (s: PlaySession, now = Date.now()): SessionHint[] {
  const hints: SessionHint[] = []
  const recent = s.loads.slice(-15)
  if (recent.length >= 5) {
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length
    if (avg > 6) hints.push({ text: `Loading screens average ${avg.toFixed(1)} s. The game on an SSD loads much faster; closing other heavy programs helps too.` })
  }
  const lastHour = s.disconnects.filter(d => now - d.at < 60 * 60 * 1000)
  if (lastHour.length >= 2) hints.push({ text: `${lastHour.length} disconnects in the last hour. Try another gateway (on the login screen) or check your connection.`, warn: true })
  const maps = s.maps.filter(m => m.ms > 0)
  const deathMaps = maps.filter(m => m.deaths > 0).length
  if (maps.length >= 5 && deathMaps / maps.length >= 0.4) hints.push({ text: `You died in ${deathMaps} of ${maps.length} maps. Check your resistances and life/ES in the Build tab, or drop to lower-tier maps.`, warn: true })
  return hints
}
