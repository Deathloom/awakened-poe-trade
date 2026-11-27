// Deathloom fork (wave 6): per-game local storage. PoE1 and PoE2 keep their own
// trade ledger, map sessions, farming runs, watched items, sell and bulk lists:
// PoE1 keeps the existing keys (so nothing moves), PoE2 uses "<key>.poe2".
// On a game switch the windows' existing 'storage' listeners are poked with the
// new key, so open panels reload that game's data without a restart.
// No Config import on purpose (unit-tested modules use this); Config.ts calls
// setStorageGame() whenever settings load or change.
import type { Game } from '@ipc/game'

let current: Game = 'poe1'
const used = new Set<string>()

export function gameKey (base: string, game: Game = current): string {
  used.add(base)
  return game === 'poe2' ? `${base}.poe2` : base
}

export function setStorageGame (game: Game) {
  if (game === current) return
  current = game
  if (typeof window === 'undefined' || typeof StorageEvent === 'undefined') return
  for (const base of used) {
    try { window.dispatchEvent(new StorageEvent('storage', { key: gameKey(base) })) } catch {}
  }
}
