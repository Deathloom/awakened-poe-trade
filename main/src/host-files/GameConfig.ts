import fs from 'fs/promises'
import path from 'path'
import ini from 'ini'
import { app } from 'electron'
import { hotkeyToString, CodeToKey } from '../../../ipc/KeyToCode'
import { guessFileLocation } from './utils'
import { GAME_FOLDER, GAME_CONFIG_FILE, type Game } from '../../../ipc/game'
import type { Logger } from '../RemoteLogger'
import type { ServerEvents } from '../server'

// Deathloom fork: default config file locations per game (PoE2 mode)
function possiblePaths (game: Game): string[] {
  const dir = GAME_FOLDER[game]
  const file = GAME_CONFIG_FILE[game]
  const steamId = game === 'poe2' ? '2694490' : '238960'
  return (process.platform === 'win32') ? [
    path.join(app.getPath('documents'), `My Games\\${dir}\\${file}`)
  ] : (process.platform === 'linux') ? [
    path.join(app.getPath('documents'), `My Games/${dir}/${file}`),
    path.join(app.getPath('home'), `.local/share/Steam/steamapps/compatdata/${steamId}/pfx/drive_c/users/steamuser/Documents/My Games/${dir}/${file}`)
  ] : (process.platform === 'darwin') ? [
    path.join(app.getPath('appData'), `${dir}/Preferences/${file}`)
  ] : []
}

export class GameConfig {
  private _wantedPath: string | null = null
  private _game: Game = 'poe1'
  private _actualPath: string | null = null
  get actualPath () { return this._actualPath }

  private _showModsKey: string | null = null
  get showModsKeyNullable () { return this._showModsKey }
  get showModsKey () { return this._showModsKey ?? 'Alt' }

  constructor (
    private server: ServerEvents,
    private logger: Logger
  ) {}

  async readConfig (filePath: string, game: Game = 'poe1') {
    if (this._wantedPath !== filePath || this._game !== game) {
      this._wantedPath = filePath
      this._game = game
      this._actualPath = null
    } else {
      return
    }

    if (!filePath.length) {
      const guessedPath = await guessFileLocation(possiblePaths(game))
      if (guessedPath != null) {
        filePath = guessedPath
      } else {
        this.logger.write('error [GameConfig] Failed to find game configuration file in the default location.')
        return
      }
    }

    try {
      let contents = await fs.readFile(filePath, { encoding: 'utf-8', flag: 'r' })
      contents = contents.trimStart() // remove BOM
      const parsed = ini.parse(contents)

      this._showModsKey = this.parseConfigHotkey(
        parsed['ACTION_KEYS']?.['show_advanced_item_descriptions'])

      this._actualPath = filePath
    } catch {
      this.logger.write('error [GameConfig] Failed to read game configuration file.')
    }
  }

  private parseConfigHotkey (cfgKey?: string): string | null {
    if (!cfgKey) return null

    const [keyMain, keyMod] = cfgKey.split(' ')

    let key1: string
    if (CodeToKey[keyMain]) {
      key1 = CodeToKey[keyMain]
    } else {
      this.logger.write(`error [GameConfig] Failed to read key: ${cfgKey}.`)
      return null
    }

    let key2: string | undefined
    if (keyMod) {
      if (keyMod === '1') {
        key2 = 'Shift'
      } else if (keyMod === '2') {
        key2 = 'Ctrl'
      } else if (keyMod === '3') {
        key2 = 'Alt'
      } else {
        this.logger.write(`error [GameConfig] Failed to read modifier key: ${cfgKey}.`)
        return null
      }
    }

    return hotkeyToString(
      [key1],
      key2 === 'Ctrl',
      key2 === 'Shift',
      key2 === 'Alt'
    )
  }
}
