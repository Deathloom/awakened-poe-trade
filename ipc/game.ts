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

// Deathloom fork (wave 6): automatic game switch. Settings → Game is Auto by
// default; PoE1 / PoE2 pin one game (manual override).
export type GameMode = 'auto' | Game

export function asGameMode (value: unknown): GameMode {
  return value === 'poe1' || value === 'poe2' ? value : 'auto'
}

// Which game a window title belongs to (default titles only)
export function gameForWindowTitle (title: string | null | undefined): Game | undefined {
  return GAMES.find(g => GAME_WINDOW_TITLE[g] === title)
}

export function isDefaultWindowTitle (title: string | null | undefined): boolean {
  const t = (title ?? '').trim()
  return !t || gameForWindowTitle(t) !== undefined
}

// Titles the overlay watches. Auto with the stock titles watches both games when
// the overlay library can (live switch); otherwise the current game's title only
// (then Orbhoarder relaunches itself when the other game starts). A custom
// window title is watched on its own and turns Auto off.
export function overlayTitles (opts: { mode: GameMode, game: Game, windowTitle: string | null | undefined, multiTitle: boolean }): { titles: string[], auto: boolean, live: boolean } {
  const custom = (opts.windowTitle ?? '').trim()
  if (custom && !isDefaultWindowTitle(custom)) return { titles: [custom], auto: false, live: false }
  const auto = opts.mode === 'auto'
  if (opts.multiTitle) {
    // both titles even when one game is pinned, so switching mode needs no restart
    return { titles: GAMES.map(g => GAME_WINDOW_TITLE[g]), auto, live: true }
  }
  const game = opts.mode === 'auto' ? opts.game : opts.mode
  return { titles: [GAME_WINDOW_TITLE[game]], auto, live: false }
}

// Game window titles in `tasklist /V /FO CSV /NH` output (fallback detection;
// the last CSV column is the window title)
export function gamesInTasklist (stdout: string): Game[] {
  const found = new Set<Game>()
  for (const line of stdout.split(/\r?\n/)) {
    const m = /"([^"]*)"\s*$/.exec(line.trim())
    const game = m ? gameForWindowTitle(m[1]) : undefined
    if (game) found.add(game)
  }
  return GAMES.filter(g => found.has(g))
}

// Settings changes for a switch: each game keeps its own league; a custom window
// title is kept. Returns false when nothing changes.
export interface GameSwitchable {
  game: Game
  leagueId?: string
  leagueIdByGame?: Partial<Record<Game, string>>
  windowTitle: string
}
export function applyGameSwitch (cfg: GameSwitchable, to: Game): boolean {
  const from = cfg.game
  if (to === from) return false
  const byGame = { ...cfg.leagueIdByGame }
  if (cfg.leagueId) byGame[from] = cfg.leagueId
  cfg.leagueIdByGame = byGame
  cfg.leagueId = byGame[to]
  cfg.windowTitle = windowTitleOnSwitch(to, cfg.windowTitle)
  cfg.game = to
  return true
}
