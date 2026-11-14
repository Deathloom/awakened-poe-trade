// Deathloom fork: atlas builds as files in the player folder, so build sync
// carries them: <buildsDir>/<player>/Atlas/<name>.txt holds the pathofexile.com
// atlas tree link. PoB's sync already handles .txt files (BuildSyncCore
// allowedExtensions), so Push uploads your own and Pull brings friends' (the
// ones you may see). Friends' atlas builds are read-only here: only your own
// folder is ever written. Delete moves the file to "Deleted builds" like builds.

import path from 'path'
import { promises as fs } from 'fs'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { AtlasFileBuild, AtlasFilesState } from '../../../ipc/types'
import { safeSegment } from './BuildFiles'

const DIR = 'Atlas'
const MAX_PER_PLAYER = 100
const MAX_PLAYERS = 50
const MAX_BYTES = 16 * 1024
const CODE_RE = /^[A-Za-z0-9_-]{8,1000}$/
const PLAYER_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/
const SITE = 'https://www.pathofexile.com/fullscreen-atlas-skill-tree/'

export function atlasFileText (code: string): string {
  return `# Loot Goblin atlas build: open the link to see the tree on pathofexile.com\n${SITE}${code}\n`
}

// first link / code line of the file -> the tree code
export function codeFromFile (text: string): string | null {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const last = line.replace(/[?#].*$/, '').split('/').filter(Boolean).pop() ?? ''
    const code = last.replace(/=+$/, '')
    return CODE_RE.test(code) ? code : null
  }
  return null
}

export function cleanAtlasName (name: unknown): string | null {
  const n = String(name ?? '').trim().replace(/\.txt$/i, '').replace(/\s+/g, ' ').slice(0, 60).trim()
  return safeSegment(n) ? n : null
}

async function exists (p: string) {
  try { await fs.access(p); return true } catch { return false }
}

interface Paths { buildsDir: string, player: string }

export interface AtlasFileOp {
  op: 'list' | 'save' | 'rename' | 'delete'
  requestId?: number
  name?: string
  code?: string
  // rename: the new name; save: keep the name (true) or pick a free one (false)
  newName?: string
  overwrite?: boolean
}

export class AtlasFiles {
  private state: AtlasFilesState = { available: false, own: '', builds: [] }
  private queue = Promise.resolve()

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private paths: () => Paths | null,
    private onChanged: () => void
  ) {
    this.server.onEventAnyClient('CLIENT->MAIN::atlas-files', (req) => {
      this.queue = this.queue.then(async () => { await this.handle(req as AtlasFileOp) })
    })
  }

  private publish (patch: Partial<AtlasFilesState> = {}) {
    this.state = { ...this.state, ...patch }
    this.server.sendEventTo('broadcast', { name: 'MAIN->CLIENT::atlas-files', payload: this.state })
  }

  private ownDir (p: Paths) { return path.join(p.buildsDir, p.player, DIR) }

  private async handle (req: AtlasFileOp) {
    const p = this.paths()
    if (!p?.buildsDir) {
      this.publish({ available: false, own: '', builds: [], requestId: req.requestId, error: req.op === 'list' ? undefined : 'Missing in settings: Builds folder' })
      return
    }
    try {
      let saved: string | undefined
      if (req.op === 'save') saved = await this.save(p, req)
      else if (req.op === 'rename') saved = await this.rename(p, req)
      else if (req.op === 'delete') await this.remove(p, req)
      if (req.op !== 'list') this.onChanged()
      this.publish({ available: true, own: p.player, builds: await this.list(p), requestId: req.requestId, saved, error: undefined })
    } catch (e) {
      this.logger.write(`error [Atlas] ${req.op}: ${(e as Error).message}`)
      let builds = this.state.builds
      try { builds = await this.list(p) } catch {}
      this.publish({ available: true, own: p.player, builds, requestId: req.requestId, saved: undefined, error: (e as Error).message })
    }
  }

  // yours first, then each other player folder (pulled by build sync)
  private async list (p: Paths): Promise<AtlasFileBuild[]> {
    const out: AtlasFileBuild[] = []
    const players: string[] = [p.player]
    if (p.player) {
      let entries: import('fs').Dirent[] = []
      try { entries = await fs.readdir(p.buildsDir, { withFileTypes: true }) } catch {}
      for (const e of entries) {
        if (!e.isDirectory() || !PLAYER_RE.test(e.name) || e.name.toLowerCase() === p.player.toLowerCase()) continue
        players.push(e.name)
        if (players.length > MAX_PLAYERS) break
      }
    }
    for (const player of players) {
      const dir = path.join(p.buildsDir, player, DIR)
      let entries: import('fs').Dirent[] = []
      try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { continue }
      let n = 0
      for (const e of entries) {
        if (!e.isFile() || !/\.txt$/i.test(e.name) || e.name.startsWith('.')) continue
        const name = e.name.replace(/\.txt$/i, '')
        // conflict copies from Pull ("name (conflict ...)") are shown too: they're real trees
        try {
          const full = path.join(dir, e.name)
          const st = await fs.stat(full)
          if (st.size > MAX_BYTES) continue
          const code = codeFromFile(await fs.readFile(full, 'utf8'))
          if (!code) continue
          out.push({ player, name, code, at: st.mtimeMs, own: player === p.player })
          if (++n >= MAX_PER_PLAYER) break
        } catch {}
      }
    }
    return out
  }

  private async write (file: string, code: string) {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.lg-tmp`
    await fs.writeFile(tmp, atlasFileText(code), 'utf8')
    await fs.rename(tmp, file)
  }

  private async save (p: Paths, req: AtlasFileOp): Promise<string> {
    const code = String(req.code ?? '').replace(/=+$/, '')
    if (!CODE_RE.test(code)) throw new Error("That isn't an atlas tree code")
    const name = cleanAtlasName(req.name)
    if (!name) throw new Error("That name has characters Windows doesn't allow")
    const dir = this.ownDir(p)
    let final = name
    if (!req.overwrite) {
      let i = 1
      while (await exists(path.join(dir, `${final}.txt`))) final = `${name} (${++i})`
    }
    await this.write(path.join(dir, `${final}.txt`), code)
    this.logger.write(`info [Atlas] saved ${final}`)
    return final
  }

  private async rename (p: Paths, req: AtlasFileOp): Promise<string> {
    const from = cleanAtlasName(req.name)
    const to = cleanAtlasName(req.newName)
    if (!from) throw new Error('Atlas build not found')
    if (!to) throw new Error("That name has characters Windows doesn't allow")
    const dir = this.ownDir(p)
    const a = path.join(dir, `${from}.txt`)
    const b = path.join(dir, `${to}.txt`)
    if (!(await exists(a))) throw new Error('Atlas build not found')
    if (a === b) return to
    if (a.toLowerCase() === b.toLowerCase()) {
      const tmp = path.join(dir, `.lg-rename-${Date.now()}.txt`)
      await fs.rename(a, tmp)
      await fs.rename(tmp, b)
    } else {
      if (await exists(b)) throw new Error('An atlas build with that name already exists')
      await fs.rename(a, b)
    }
    return to
  }

  private async remove (p: Paths, req: AtlasFileOp) {
    const name = cleanAtlasName(req.name)
    if (!name) throw new Error('Atlas build not found')
    const from = path.join(this.ownDir(p), `${name}.txt`)
    if (!(await exists(from))) return
    const target = path.join(path.dirname(path.resolve(p.buildsDir)), 'Deleted builds', p.player, DIR)
    await fs.mkdir(target, { recursive: true })
    let file = `${name}.txt`
    let i = 1
    while (await exists(path.join(target, file))) file = `${name} (${++i}).txt`
    try {
      await fs.rename(from, path.join(target, file))
    } catch {
      await fs.copyFile(from, path.join(target, file))
      await fs.unlink(from)
    }
    this.logger.write(`info [Atlas] deleted ${name}`)
  }
}
