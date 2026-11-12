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

// One entry of the account's character list (cached for the build panel dropdown)
export interface CharacterEntry {
  name: string
  league?: string
  class?: string
  level?: number
  lastLoginTime?: number
}

// get-characters answer -> clean list (newest login first)
export function parseCharacters (list: unknown): CharacterEntry[] {
  if (!Array.isArray(list)) return []
  const out: CharacterEntry[] = []
  for (const c of list) {
    if (!c || typeof c !== 'object') continue
    const { name, league, class: cls, level, lastLoginTime, lastActive } = c as Record<string, unknown>
    if (typeof name !== 'string' || !name) continue
    out.push({
      name,
      league: typeof league === 'string' ? league : undefined,
      class: typeof cls === 'string' ? cls : undefined,
      level: typeof level === 'number' ? level : undefined,
      // an old-style lastActive flag counts as the newest login
      lastLoginTime: lastActive === true ? Number.MAX_SAFE_INTEGER : (typeof lastLoginTime === 'number' ? lastLoginTime : undefined)
    })
  }
  out.sort((a, b) => (b.lastLoginTime ?? -1) - (a.lastLoginTime ?? -1))
  return out
}

// get-characters answer -> name of the character played last.
// pathofexile.com sends lastLoginTime (unix seconds) per character; older
// answers had a lastActive flag, which still wins if present.
export function pickLastActive (list: unknown): string | null {
  const first = parseCharacters(list)[0]
  return first && first.lastLoginTime !== undefined ? first.name : null
}

interface StoreData {
  builds: Record<string, string>
  account?: string
  characters?: CharacterEntry[]
}

// Build per character + the cached character list, kept by the main process
// (the HUD can't save settings)
export class CharacterBuilds {
  private data: StoreData | null = null

  constructor (private file: string) {}

  private async load (): Promise<StoreData> {
    if (this.data) return this.data
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'))
      this.data = {
        builds: (parsed && typeof parsed.builds === 'object' && parsed.builds) || {},
        account: typeof parsed?.account === 'string' ? parsed.account : undefined,
        characters: Array.isArray(parsed?.characters) ? parsed.characters : undefined
      }
    } catch {
      this.data = { builds: {} }
    }
    return this.data
  }

  private async save () {
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    await fs.writeFile(this.file, JSON.stringify(this.data, null, 2), 'utf8')
  }

  async get (character: string): Promise<string | undefined> {
    const data = await this.load()
    return data.builds[character]
  }

  async set (character: string, build: string) {
    const data = await this.load()
    if (data.builds[character] === build) return
    data.builds[character] = build
    await this.save()
  }

  // Cached list for this account (empty if none or another account)
  async characters (account: string): Promise<CharacterEntry[]> {
    const data = await this.load()
    return data.account === account ? (data.characters ?? []) : []
  }

  async setCharacters (account: string, list: CharacterEntry[]) {
    const data = await this.load()
    data.account = account
    data.characters = list.map(({ name, league, class: cls, level }) => ({ name, league, class: cls, level }))
    await this.save()
  }
}
