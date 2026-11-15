// Deathloom fork: which game Orbhoarder works with (PoE2 mode, phase 1).
// Pure helpers shared by main and renderer; unit-tested in tests/logic.test.mjs.

export type Game = 'poe1' | 'poe2'

export const GAMES: readonly Game[] = ['poe1', 'poe2']

// the game's window title (electron-overlay-window attaches by exact title)
export const GAME_WINDOW_TITLE: Record<Game, string> = {
  poe1: 'Path of Exile',
  poe2: 'Path of Exile 2'
}

// install / My Games folder name
export const GAME_FOLDER: Record<Game, string> = {
  poe1: 'Path of Exile',
  poe2: 'Path of Exile 2'
}

export const GAME_CONFIG_FILE: Record<Game, string> = {
  poe1: 'production_Config.ini',
  poe2: 'poe2_production_Config.ini'
}

export function asGame (value: unknown): Game {
  return value === 'poe2' ? 'poe2' : 'poe1'
}

// Window title after switching game: a custom title is kept, the other
// game's default title (or an empty one) follows the switch.
export function windowTitleOnSwitch (to: Game, current: string | null | undefined): string {
  const title = (current ?? '').trim()
  if (!title || GAMES.some(g => GAME_WINDOW_TITLE[g] === title)) return GAME_WINDOW_TITLE[to]
  return title
}

// Is this a path inside the PoE2 install (exe, logs)?
export function isPoe2Path (p: string): boolean {
  return /[\\/]Path of Exile 2[\\/]/i.test(p)
}

export function exeMatchesGame (exePath: string, game: Game): boolean {
  return isPoe2Path(exePath) === (game === 'poe2')
}

// Default trade league when the saved one is gone: the current challenge
// league (softcore, trade), else Standard, else the first one listed.
export function pickDefaultLeague (ids: readonly string[]): string | undefined {
  const permanent = /^(Standard|Hardcore|標準模式|專家模式)$/
  const hardcore = /^HC\b|Hardcore|專家/i
  const ssf = /SSF|Solo Self-Found/i
  const challenge = ids.find(id => !permanent.test(id) && !hardcore.test(id) && !ssf.test(id) && !/Ruthless/i.test(id))
  return challenge ?? ids.find(id => id === 'Standard') ?? ids[0]
}
