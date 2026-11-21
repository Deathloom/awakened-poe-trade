// Deathloom fork (Q10): loot filter add-on (Market → Shopping ⋯ → Make loot filter add-on…).
// Finds the game's filter folder (Documents\My Games\Path of Exile[ 2]) and lets
// LootFilterFiles list / write in it. This PC only: phones are refused here and in
// request-guard.ts.

import { promises as fs } from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { ServerEvents } from './server'
import type { Logger } from './RemoteLogger'
import { GAME_FOLDER, type Game } from '../../ipc/game'
import { listFilters, makeAddon } from './LootFilterFiles'

function candidates (game: Game): string[] {
  const dir = GAME_FOLDER[game]
  const steamId = game === 'poe2' ? '2694490' : '238960'
  const docs = path.join(app.getPath('documents'), 'My Games', dir)
  if (process.platform === 'linux') {
    return [docs, path.join(app.getPath('home'), `.local/share/Steam/steamapps/compatdata/${steamId}/pfx/drive_c/users/steamuser/Documents/My Games/${dir}`)]
  }
  return [docs]
}

async function filterFolder (game: Game): Promise<string | null> {
  for (const c of candidates(game)) {
    try {
      if ((await fs.stat(c)).isDirectory()) return c
    } catch {}
  }
  return null
}

export class LootFilter {
  game: Game = 'poe1'

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private fromOtherDevice: () => boolean
  ) {
    this.server.onEventAnyClient('CLIENT->MAIN::loot-filter', (req) => {
      const send = this.server.replyTo()
      const reply = (p: { ok: boolean, error?: string, folder?: string, filters?: string[], written?: string, count?: number, refused?: string[] }) => {
        send({ name: 'MAIN->CLIENT::loot-filter', payload: { requestId: Number(req.requestId) || 0, ...p } })
      }
      if (this.fromOtherDevice()) { reply({ ok: false, error: 'Only on the PC.' }); return }
      const game = this.game
      void (async () => {
        const folder = await filterFolder(game)
        if (!folder) {
          reply({ ok: false, error: `Path of Exile's folder was not found (Documents\\My Games\\${GAME_FOLDER[game]}). Start the game once, then try again.` })
          return
        }
        if (req.op === 'list') {
          reply({ ok: true, folder, filters: await listFilters(folder) })
        } else if (req.op === 'make') {
          const res = await makeAddon(folder, req.source, req.wants, game, new Date().toISOString().slice(0, 10))
          if (res.ok) this.logger.write(`info [loot-filter] wrote ${res.written ?? ''} (${res.count ?? 0} names)`)
          reply({ ...res, folder })
        }
      })().catch((err: Error) => {
        this.logger.write(`error [loot-filter] ${String(req.op)}: ${err.message}`)
        reply({ ok: false, error: 'Could not read or write the filter folder.' })
      })
    })
  }
}
