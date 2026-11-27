// Deathloom fork (wave 6): automatic PoE1 / PoE2 switch.
// Live path: the patched overlay library watches both game window titles and
// re-attaches to whichever game gets focus; the attach event says which title
// matched, and the overlay window switches settings (league, data, log) live.
// Fallback (stock library, one title): while no game is attached, look for the
// other game's window title with `tasklist /V` every 15 s; when found the
// settings switch and Orbhoarder relaunches itself (~2 s) to watch that title.
// Only window titles are read: no memory reading, no input automation.
import { app } from 'electron'
import { execFile } from 'node:child_process'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { GameWindow } from './GameWindow'
import { asGame, asGameMode, gameForWindowTitle, gamesInTasklist, overlayTitles, type Game, type GameMode } from '../../../ipc/game'

const FALLBACK_POLL_MS = 15_000
const RELAUNCH_DELAY_MS = 1500

export class GameSwitch {
  private mode: GameMode = 'auto'
  private game: Game = 'poe1'
  private auto = false
  private live = false
  private polling?: ReturnType<typeof setInterval>
  private relaunching = false
  private lastDetected?: Game

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private poeWindow: GameWindow
  ) {
    this.poeWindow.onAttach((_access, title) => {
      this.updatePolling()
      const game = gameForWindowTitle(title)
      if (game) this.detected(game)
    })
    this.poeWindow.onDetach(() => { this.updatePolling() })
  }

  // Titles for the overlay's first start (later settings changes can't re-target
  // the library; configure() relaunches when it must)
  configure (cfg: { game?: unknown, gameMode?: unknown, windowTitle?: string | null }): string[] | undefined {
    this.mode = asGameMode(cfg.gameMode)
    this.game = asGame(cfg.game)
    const plan = overlayTitles({ mode: this.mode, game: this.game, windowTitle: cfg.windowTitle, multiTitle: this.poeWindow.supportsMultiTitle })
    this.auto = plan.auto
    this.live = plan.live
    if (!this.poeWindow.isTracking) {
      this.logger.write(`info [GameSwitch] watching ${plan.titles.map(t => `"${t}"`).join(' + ')} (${plan.live ? 'live switch' : 'one title'}, ${this.mode})`)
      this.updatePolling()
      return plan.titles
    }
    // fallback: the library still watches the old game's title only
    const watched = this.poeWindow.titles
    const needed = plan.titles
    if (!needed.every(t => watched.includes(t))) this.relaunch(`now ${needed.join(' + ')}`)
    this.updatePolling()
    return undefined
  }

  private detected (game: Game) {
    if (!this.auto) return
    if (game === this.game && this.lastDetected === game) return
    this.lastDetected = game
    if (game === this.game) return
    this.logger.write(`info [GameSwitch] ${game} window found, switching (${this.live ? 'live' : 'relaunch'})`)
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::game-detected',
      payload: { game, live: this.live }
    })
  }

  private updatePolling () {
    const want = this.auto && !this.live && !this.relaunching && this.poeWindow.attachedTitle === undefined && process.platform === 'win32'
    if (want && !this.polling) {
      this.polling = setInterval(() => { this.poll() }, FALLBACK_POLL_MS)
    } else if (!want && this.polling) {
      clearInterval(this.polling)
      this.polling = undefined
    }
  }

  private poll () {
    execFile('tasklist.exe', ['/V', '/FO', 'CSV', '/NH', '/FI', 'IMAGENAME eq PathOfExile*'],
      { timeout: 5000, windowsHide: true },
      (err, stdout) => {
        if (err || this.poeWindow.attachedTitle !== undefined) return
        const running = gamesInTasklist(stdout)
        // the current game is running but not focused yet: keep it
        if (running.includes(this.game)) return
        const other = running.find(g => g !== this.game)
        if (other) this.detected(other)
      })
  }

  private relaunch (why: string) {
    if (this.relaunching) return
    this.relaunching = true
    this.updatePolling()
    this.logger.write(`info [GameSwitch] relaunching to watch the other game (${why})`)
    // give the settings file a moment to be written
    setTimeout(() => { app.relaunch(); app.quit() }, RELAUNCH_DELAY_MS)
  }
}
