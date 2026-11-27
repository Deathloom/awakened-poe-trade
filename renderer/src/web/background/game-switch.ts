// Deathloom fork (wave 6): automatic PoE1 / PoE2 switch, overlay window side.
// Main says which game's window it found (window title only); in Automatic mode
// the settings switch here (league per game, window title), get saved and
// pushed back to main, which restarts the log watcher, game config reader and
// loot filter for that game. Without the live overlay library main relaunches.
import { shallowRef } from 'vue'
import { Host } from './IPC'
import { AppConfig, saveConfig, pushHostConfig } from '@/web/Config'
import { applyGameSwitch, type Game } from '@ipc/game'

export const lastGameSwitch = shallowRef<{ game: Game, live: boolean, at: number } | null>(null)

export function initGameSwitch () {
  Host.onEvent('MAIN->CLIENT::game-detected', ({ game, live }) => {
    const cfg = AppConfig()
    if (cfg.gameMode !== 'auto') return
    if (!applyGameSwitch(cfg, game)) return
    saveConfig()
    pushHostConfig()
    lastGameSwitch.value = { game, live, at: Date.now() }
  })
}
