// Deathloom fork: default Path of Building paths, so friends need no setup.
//
// - PoB folder: the PoB fork bundled inside the installed app
//   (resources\PathOfBuilding, added by the Release workflow).
// - Builds folder: PoB's build save path as its build sync recorded it in
//   BuildSync.json, else Documents\Loot Goblin\Builds (the bundled PoB's default
//   build save path; not the install folder, which updates replace).
// - Player: the player folder set in PoB's build sync (BuildSync.json: in
//   Documents\Loot Goblin\PathOfBuilding for the bundled copy, in src for a git
//   clone). With no player the builds folder itself is used (PoB without build sharing).
//
// Settings always win over these defaults; empty settings fields mean "default".

import * as fs from 'fs'
import * as path from 'path'
import type { PobConfig } from '../../../ipc/types'

export interface PobDefaults {
  // '' when there is no bundled PoB (dev runs)
  pobDir: string
  buildsDir: string
  player: string
}

export interface PobDefaultsEnv {
  isPackaged: boolean
  resourcesPath: string
  documents: string
}

export const APP_DOCS_FOLDER = 'Loot Goblin'

export function bundledPobDir (env: PobDefaultsEnv): string {
  if (!env.isPackaged) return ''
  const dir = path.join(env.resourcesPath, 'PathOfBuilding')
  return fs.existsSync(path.join(dir, 'src', 'ImpactServer.lua')) ? dir : ''
}

export function defaultBuildsDir (env: PobDefaultsEnv): string {
  return path.join(env.documents, APP_DOCS_FOLDER, 'Builds')
}

// Where PoB keeps its settings and BuildSync.json (same rule as PoB's Main.lua):
// bundled copy (src\bundled.cfg) -> Documents\Loot Goblin\PathOfBuilding, git clone -> src
export function pobUserDir (env: PobDefaultsEnv, pobDir: string): string {
  if (!pobDir || fs.existsSync(path.join(pobDir, 'src', 'bundled.cfg'))) {
    return path.join(env.documents, APP_DOCS_FOLDER, 'PathOfBuilding')
  }
  return path.join(pobDir, 'src')
}

function readBuildSync (env: PobDefaultsEnv, pobDir: string): any {
  try {
    return JSON.parse(fs.readFileSync(path.join(pobUserDir(env, pobDir), 'BuildSync.json'), 'utf8'))
  } catch {
    return null
  }
}

// Player folder from PoB's sync settings ('' if not set up)
export function syncPlayer (env: PobDefaultsEnv, pobDir = bundledPobDir(env)): string {
  const player = readBuildSync(env, pobDir)?.settings?.player
  return (typeof player === 'string' && /^[\w.-]+$/.test(player)) ? player : ''
}

// PoB's build save path as its build sync recorded it ('' if unknown)
export function syncBuildsDir (env: PobDefaultsEnv, pobDir = bundledPobDir(env)): string {
  const dir = readBuildSync(env, pobDir)?.buildPath
  return (typeof dir === 'string' && dir) ? path.normalize(dir).replace(/[\\/]+$/, '') : ''
}

// pobDir: the PoB folder from settings, if set (its sync settings decide the player)
export function pobDefaults (env: PobDefaultsEnv, pobDir = ''): PobDefaults {
  const bundled = bundledPobDir(env)
  const inUse = pobDir || bundled
  return {
    pobDir: bundled,
    buildsDir: syncBuildsDir(env, inUse) || defaultBuildsDir(env),
    player: syncPlayer(env, inUse)
  }
}

// Fills empty fields with the defaults
export function withDefaults (cfg: PobConfig, defaults: PobDefaults): PobConfig {
  return {
    ...cfg,
    pobDir: cfg.pobDir || defaults.pobDir,
    buildsDir: cfg.buildsDir || defaults.buildsDir,
    player: cfg.player || defaults.player
  }
}
