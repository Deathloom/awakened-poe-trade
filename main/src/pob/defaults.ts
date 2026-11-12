// Deathloom fork: default Path of Building paths, so friends need no setup.
//
// - PoB folder: the PoB fork bundled inside the installed app
//   (resources\PathOfBuilding, added by the Release workflow).
// - Builds folder: Documents\Loot Goblin\Builds (the bundled PoB's default
//   build save path; not the install folder, which updates replace).
// - Player: the player folder set in the bundled PoB's build sync
//   (Documents\Loot Goblin\PathOfBuilding\BuildSync.json). With no player the
//   builds folder itself is used (PoB without build sharing).
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

// Player folder from the bundled PoB's sync settings ('' if not set up)
export function syncPlayer (env: PobDefaultsEnv): string {
  try {
    const file = path.join(env.documents, APP_DOCS_FOLDER, 'PathOfBuilding', 'BuildSync.json')
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    const player = data?.settings?.player
    return (typeof player === 'string' && /^[\w.-]+$/.test(player)) ? player : ''
  } catch {
    return ''
  }
}

export function pobDefaults (env: PobDefaultsEnv): PobDefaults {
  return {
    pobDir: bundledPobDir(env),
    buildsDir: defaultBuildsDir(env),
    player: syncPlayer(env)
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
