// Deathloom fork: follow the character being played.
// Client.txt shows when you go back to character select / log in and when you
// enter the world, but not which character. After entering the world we ask
// pathofexile.com (public Characters tab) which character logged in last (lastLoginTime).
// The build picked for a character is remembered in apt-data\pob-characters.json
// and restored when that character is played again.

import { promises as fs } from 'fs'
import path from 'path'

// Game start or back to login / character select
export const LOGIN = /\*{5} LOG FILE OPENING \*{5}|Async connecting to \S+\.login\./
// Entered an area (any client language for the first form)
export const ZONE = /Generating level \d+ area "|\] : You have entered /
// ": MyWitch (Necromancer) is now level 93"
export const LEVEL_UP = /\] : ([^\s(]+) \([^)]+\) is now level \d+/

export interface LogScanState {
  // true until the first area after the game started or after character select
  atLogin: boolean
}

export interface LogScanResult {
  // entered the world from login / character select (character may have changed)
  entered: boolean
  // names seen levelling up (yours, possibly party members')
  levelUps: string[]
}

export function scanLog (lines: string[], state: LogScanState): LogScanResult {
  const result: LogScanResult = { entered: false, levelUps: [] }
  for (const line of lines) {
    if (LOGIN.test(line)) {
      state.atLogin = true
    } else if (ZONE.test(line)) {
      if (state.atLogin) result.entered = true
      state.atLogin = false
    } else {
      const m = LEVEL_UP.exec(line)
      if (m) result.levelUps.push(m[1])
    }
  }
  return result
}

// get-characters answer -> name of the character played last.
// pathofexile.com sends lastLoginTime (unix seconds) per character; older
// answers had a lastActive flag, which still wins if present.
export function pickLastActive (list: unknown): string | null {
  if (!Array.isArray(list)) return null
  let best: { name: string, time: number } | null = null
  for (const c of list) {
    if (!c || typeof c !== 'object') continue
    const { name, lastActive, lastLoginTime } = c as { name?: unknown, lastActive?: unknown, lastLoginTime?: unknown }
    if (typeof name !== 'string' || !name) continue
    if (lastActive === true) return name
    const time = typeof lastLoginTime === 'number' ? lastLoginTime : -1
    if (!best || time > best.time) best = { name, time }
  }
  return best && best.time >= 0 ? best.name : null
}

// Build per character, kept by the main process (the HUD can't save settings)
export class CharacterBuilds {
  private data: Record<string, string> | null = null

  constructor (private file: string) {}

  private async load () {
    if (this.data) return this.data
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'))
      this.data = (parsed && typeof parsed.builds === 'object' && parsed.builds) || {}
    } catch {
      this.data = {}
    }
    return this.data!
  }

  async get (character: string): Promise<string | undefined> {
    const data = await this.load()
    return data[character]
  }

  async set (character: string, build: string) {
    const data = await this.load()
    if (data[character] === build) return
    data[character] = build
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    await fs.writeFile(this.file, JSON.stringify({ builds: data }, null, 2), 'utf8')
  }
}
