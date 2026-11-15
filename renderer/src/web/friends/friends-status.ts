// Deathloom fork: friends online and friends' race (ideas 10, 12), through build
// sync (main: pob/PlayerStatus.ts). Opt-in: nothing is shared until you turn on
// "Share my status". Your status is written at most every 10 minutes (sooner on
// a level-up) and goes to GitHub with build sync's automatic Push; friends'
// statuses arrive with Pull. No other server is involved.
import { shallowRef } from 'vue'
import type { PlayerStatusData, PlayerStatusEntry } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import { currentChar, loadCharLevels, progressOf } from '../companion/char-level'
import { loadPlaySession } from '../companion/play-session'

export interface FriendsConfig {
  // write my status file (character, level, league, campaign splits)
  share: boolean
  // also the area I'm in
  activity: boolean
  // Pull every 15 minutes while the Friends list is on screen
  autoPull: boolean
}
export const defaultFriendsConfig = (): FriendsConfig => ({ share: false, activity: false, autoPull: false })
export function friendsConfig (): FriendsConfig {
  return { ...defaultFriendsConfig(), ...AppConfig().friends }
}

const WRITE_EVERY = 10 * 60 * 1000
export const ONLINE_MS = 30 * 60 * 1000

let last: { at: number, json: string, level: number } | null = null

export function currentStatus (): Omit<PlayerStatusData, 'updated'> | null {
  const cfg = friendsConfig()
  const levels = loadCharLevels()
  const ch = currentChar(levels)
  if (!ch) return null
  const p = progressOf(levels, ch.name)
  const zone = cfg.activity ? (loadPlaySession().here?.name ?? '') : ''
  return {
    character: { name: ch.name, cls: ch.cls, level: ch.level },
    league: AppConfig().leagueId || undefined,
    zone: zone || undefined,
    splits: p?.splits,
    fromStart: p?.firstLevel === 2 || undefined
  }
}

// called by the overlay's level recorder after each batch of log lines
export function maybeShareStatus (force = false) {
  if (!friendsConfig().share) return
  const s = currentStatus()
  if (!s) return
  const json = JSON.stringify(s)
  const now = Date.now()
  const levelUp = last != null && (s.character?.level ?? 0) > last.level
  if (!force && last && (json === last.json || (now - last.at < WRITE_EVERY && !levelUp))) return
  last = { at: now, json, level: s.character?.level ?? 0 }
  Host.sendEvent({ name: 'CLIENT->MAIN::player-status', payload: { op: 'write', status: { ...s, updated: now } } })
}

export const friendsState = shallowRef<{ available: boolean, entries: PlayerStatusEntry[], error?: string } | null>(null)
let listening = false
export function listFriends () {
  if (!listening) {
    listening = true
    Host.onEvent('MAIN->CLIENT::player-status', (e) => { friendsState.value = e })
  }
  Host.sendEvent({ name: 'CLIENT->MAIN::player-status', payload: { op: 'list' } })
}

// Pull (build sync) brings friends' status files, then list them again
export function pullFriends () {
  Host.sendEvent({ name: 'CLIENT->MAIN::pob-sync', payload: { op: 'pull' } })
}

export function ago (ms: number): string {
  const m = Math.round(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}
