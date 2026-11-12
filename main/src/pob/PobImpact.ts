// Deathloom fork: runs Path of Building headless (src/ImpactServer.lua) and
// answers "what does this item do to my active build?" for the overlay.
//
// PoB runs as one long-lived child process. The active build is read from
// <buildsDir>/<player>/active.txt and reloaded whenever that file or the build
// file changes, so pulling builds in PoB is picked up automatically.

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import { app, net, dialog, BrowserWindow } from 'electron'
import type { PobConfig, PobBuildInfo, PobImpactResult, PobEquippedInfo, PobGearItem, PobLoadoutChoice, PobBuildList, PobLoadouts, PobSocketGroup } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import { LiveGear, type FetchFn } from './LiveGear'

const STARTUP_TIMEOUT = 90_000
const REQUEST_TIMEOUT = 30_000
const REPLY_PREFIX = '@pob '

interface Pending {
  resolve: (reply: any) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

export class PobImpact {
  private cfg: PobConfig | undefined
  private proc: ChildProcessWithoutNullStreams | null = null
  private ready: Promise<void> | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()
  private stdoutBuf = ''
  private stderrTail: string[] = []
  private loadedKey: string | null = null
  private loadedBuild: PobBuildInfo | null = null
  // requests run one at a time
  private queue: Promise<unknown> = Promise.resolve()
  private liveGear: LiveGear
  // fetchedAt of the gear PoB currently holds (0 = not confirmed since the
  // last load or settings change)
  private sentGearAt = 0
  private pobHasGear = false
  private passivesError: string | undefined
  // Loadout choice applied to the loaded build (JSON, '' = PoB's own active sets)
  private appliedLoadout = ''
  private loadedRel = ''

  constructor (
    private server: ServerEvents,
    private logger: Logger
  ) {
    this.liveGear = new LiveGear(
      net.fetch as unknown as FetchFn,
      app.userAgentFallback,
      (msg) => { this.logger.write(msg) }
    )
    this.server.onEventAnyClient('CLIENT->MAIN::pob-pick-folder', ({ requestId, title, defaultPath }) => {
      void this.pickFolder(title, defaultPath).then((picked) => {
        this.server.sendEventTo('last-active', {
          name: 'MAIN->CLIENT::pob-pick-folder',
          payload: { requestId, path: picked }
        })
      })
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-impact', ({ requestId, itemText, refreshGear }) => {
      this.queue = this.queue
        .then(async () => await this.impact(itemText, refreshGear === true))
        .then(({ build, result }) => {
          this.server.sendEventTo('last-active', {
            name: 'MAIN->CLIENT::pob-impact',
            payload: { requestId, ok: true, build, result }
          })
        })
        .catch((err: Error) => {
          this.server.sendEventTo('last-active', {
            name: 'MAIN->CLIENT::pob-impact',
            payload: { requestId, ok: false, error: err.message }
          })
        })
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-builds', ({ requestId, setActive, setLoadout }) => {
      this.reply('MAIN->CLIENT::pob-builds', requestId, async () => await this.builds(setActive, setLoadout))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-gems', ({ requestId, refreshGear }) => {
      this.reply('MAIN->CLIENT::pob-gems', requestId, async () => await this.gems(refreshGear === true))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-gear', ({ requestId }) => {
      this.queue = this.queue
        .then(async () => await this.gear())
        .then(({ build, itemSet, items }) => {
          this.server.sendEventTo('last-active', {
            name: 'MAIN->CLIENT::pob-gear',
            payload: { requestId, ok: true, build, itemSet, items }
          })
        })
        .catch((err: Error) => {
          this.server.sendEventTo('last-active', {
            name: 'MAIN->CLIENT::pob-gear',
            payload: { requestId, ok: false, error: err.message }
          })
        })
    })
  }

  private reply<N extends 'MAIN->CLIENT::pob-builds' | 'MAIN->CLIENT::pob-gems'> (
    name: N, requestId: number, work: () => Promise<Record<string, unknown>>
  ) {
    this.queue = this.queue
      .then(work)
      .then((payload) => {
        this.server.sendEventTo('last-active', { name, payload: { requestId, ok: true, ...payload } } as any)
      })
      .catch((err: Error) => {
        this.server.sendEventTo('last-active', { name, payload: { requestId, ok: false, error: err.message } } as any)
      })
  }

  private async pickFolder (title: string, defaultPath: string): Promise<string | null> {
    try {
      const opts: Electron.OpenDialogOptions = {
        title,
        defaultPath: defaultPath || undefined,
        properties: ['openDirectory']
      }
      const parent = BrowserWindow.getFocusedWindow()
      const res = parent
        ? await dialog.showOpenDialog(parent, opts)
        : await dialog.showOpenDialog(opts)
      return (res.canceled || res.filePaths.length === 0) ? null : res.filePaths[0]
    } catch (e) {
      this.logger.write(`error [PoB] folder picker: ${(e as Error).message}`)
      return null
    }
  }

  configure (cfg: PobConfig | undefined) {
    this.logger.write(`info [PoB] settings: ${JSON.stringify(cfg ?? null)}`)
    // Live-gear settings don't need a PoB restart
    const procKey = (c: PobConfig | undefined) => JSON.stringify(c && [c.enabled, c.pobDir, c.buildsDir, c.player])
    const same = procKey(cfg) === procKey(this.cfg)
    const prevTarget = JSON.stringify(this.liveTarget())
    this.cfg = cfg
    this.liveGear.setTarget(this.liveTarget())
    if (JSON.stringify(this.liveTarget()) !== prevTarget) {
      this.sentGearAt = 0
    }
    if (!same || !cfg?.enabled) {
      this.stop()
    }
  }

  private liveTarget () {
    const cfg = this.cfg
    if (!cfg?.enabled || !cfg.liveGear || !cfg.accountName || !cfg.character) return null
    return { accountName: cfg.accountName, character: cfg.character, tree: cfg.liveTreeAndGems }
  }

  stop () {
    if (this.proc) {
      this.proc.kill()
    }
    this.cleanup(new Error('Path of Building stopped'))
  }

  private cleanup (err: Error) {
    this.proc = null
    this.ready = null
    this.loadedKey = null
    this.loadedBuild = null
    this.appliedLoadout = ''
    this.sentGearAt = 0
    this.pobHasGear = false
    this.stdoutBuf = ''
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.reject(err)
    }
    this.pending.clear()
  }

  private start (): Promise<void> {
    if (this.ready) return this.ready
    const cfg = this.cfg!
    const srcDir = path.join(cfg.pobDir, 'src')
    const exe = path.join(cfg.pobDir, 'runtime', 'PoBHeadless.exe')
    // For testing on Linux: APT_POB_LAUNCHER="wine64" runs the exe through Wine
    const launcher = process.env.APT_POB_LAUNCHER
    const cmd = launcher ?? exe
    const args = launcher ? [exe, 'ImpactServer.lua'] : ['ImpactServer.lua']

    this.ready = new Promise<void>((resolve, reject) => {
      let started = false
      const startTimer = setTimeout(() => {
        if (!started) {
          reject(new Error('Path of Building took too long to start'))
          this.stop()
        }
      }, STARTUP_TIMEOUT)

      const proc = spawn(cmd, args, { cwd: srcDir, windowsHide: true })
      this.proc = proc
      this.logger.write(`info [PoB] starting ${cmd} in ${srcDir}`)

      proc.on('error', (err) => {
        clearTimeout(startTimer)
        const msg = `Can't start Path of Building (${err.message}). Check the PoB folder in settings and that runtime\\PoBHeadless.exe exists.`
        this.logger.write(`error [PoB] ${msg}`)
        if (!started) reject(new Error(msg))
        if (this.proc === proc) this.cleanup(new Error(msg))
      })
      proc.on('exit', (code) => {
        clearTimeout(startTimer)
        const detail = this.stderrTail.slice(-3).join(' | ')
        const msg = `Path of Building exited (code ${String(code)})${detail ? ': ' + detail : ''}`
        this.logger.write(`warn [PoB] ${msg}`)
        if (!started) reject(new Error(msg))
        if (this.proc === proc) this.cleanup(new Error(msg))
      })
      proc.stderr.setEncoding('utf8')
      proc.stderr.on('data', (chunk: string) => {
        for (const line of chunk.split(/\r?\n/)) {
          if (line.trim()) {
            this.stderrTail.push(line.trim())
            if (this.stderrTail.length > 20) this.stderrTail.shift()
          }
        }
      })
      proc.stdout.setEncoding('utf8')
      proc.stdout.on('data', (chunk: string) => {
        this.stdoutBuf += chunk
        let nl: number
        while ((nl = this.stdoutBuf.indexOf('\n')) >= 0) {
          const line = this.stdoutBuf.slice(0, nl).replace(/\r$/, '')
          this.stdoutBuf = this.stdoutBuf.slice(nl + 1)
          if (!line.startsWith(REPLY_PREFIX)) continue
          let reply: any
          try {
            reply = JSON.parse(line.slice(REPLY_PREFIX.length))
          } catch {
            continue
          }
          if (reply.id === 0 && reply.ready) {
            started = true
            clearTimeout(startTimer)
            this.logger.write(`info [PoB] ready (PoB ${String(reply.version)})`)
            resolve()
            continue
          }
          const p = this.pending.get(reply.id)
          if (p) {
            this.pending.delete(reply.id)
            clearTimeout(p.timer)
            if (reply.ok) p.resolve(reply)
            else p.reject(new Error(String(reply.error ?? 'Unknown error')))
          }
        }
      })
    })
    return this.ready
  }

  private async call (cmd: string, params: Record<string, unknown> = {}): Promise<any> {
    await this.start()
    const proc = this.proc
    if (!proc) throw new Error('Path of Building is not running')
    const id = this.nextId++
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Path of Building did not answer '${cmd}' in time`))
      }, REQUEST_TIMEOUT)
      this.pending.set(id, { resolve, reject, timer })
      proc.stdin.write(JSON.stringify({ id, cmd, ...params }) + '\n')
    })
  }

  private async resolveActiveBuild (): Promise<string> {
    const cfg = this.cfg!
    const playerDir = path.join(cfg.buildsDir, cfg.player)
    const activeFile = path.join(playerDir, 'active.txt')
    let text: string
    try {
      text = await fs.readFile(activeFile, 'utf8')
    } catch {
      throw new Error(`No active build: can't read ${activeFile}`)
    }
    const line = text.split(/\r?\n/)
      .map(l => l.trim())
      .find(l => l && !l.startsWith('#'))
    if (!line) {
      throw new Error(`No active build: ${activeFile} is empty`)
    }
    let name = line.replace(/^(active|build)\s*[:=]\s*/i, '')
    if (!name.toLowerCase().endsWith('.xml')) name += '.xml'
    return path.isAbsolute(name) ? name : path.join(playerDir, name)
  }

  // Make sure PoB holds the character's current gear. Returns an error message
  // for the panel instead of throwing: the build comparison still works without it.
  private async syncLiveGear (refresh: boolean): Promise<{ info?: PobEquippedInfo, error?: string }> {
    // sentGearAt is reset when settings change or a build loads; if PoB still
    // holds gear we didn't just confirm, drop it rather than compare to stale gear
    const dropStale = async () => {
      if (this.pobHasGear && this.sentGearAt === 0) {
        await this.call('clearEquipped')
        this.pobHasGear = false
      }
    }
    if (!this.liveTarget()) {
      await dropStale()
      return {}
    }
    let gear
    try {
      gear = await this.liveGear.get(refresh)
    } catch (err) {
      await dropStale()
      return { error: (err as Error).message }
    }
    if (gear.fetchedAt !== this.sentGearAt) {
      const full = this.cfg?.liveTreeAndGems === true
      const reply = await this.call('equipped', {
        items: gear.items,
        passives: full ? gear.passives : undefined,
        skills: full,
        character: gear.character
      })
      this.sentGearAt = gear.fetchedAt
      this.pobHasGear = true
      const info = reply.equipped as PobEquippedInfo
      if (!Array.isArray(info.skipped)) info.skipped = []
      this.passivesError = full ? gear.passivesError : undefined
      if (info.skipped.length) {
        this.logger.write(`warn [PoB] live gear: PoB skipped ${info.skipped.join(', ')}`)
      }
    }
    return {}
  }

  // Start PoB if needed and make sure it holds the current active build
  private async ensureBuild (): Promise<PobBuildInfo> {
    if (!this.cfg?.enabled) throw new Error('Path of Building is turned off in settings (Path of Building page)')
    const missing = [
      !this.cfg.pobDir && 'Path of Building folder',
      !this.cfg.buildsDir && 'Builds folder',
      !this.cfg.player && 'Player'
    ].filter(Boolean)
    if (missing.length) {
      throw new Error(`Missing in settings: ${missing.join(', ')}`)
    }
    if (!this.proc) {
      const exe = path.join(this.cfg.pobDir, 'runtime', 'PoBHeadless.exe')
      const script = path.join(this.cfg.pobDir, 'src', 'ImpactServer.lua')
      for (const file of [exe, script]) {
        try {
          await fs.access(file)
        } catch {
          throw new Error(`Not found: ${file} (check the PoB folder in settings; it needs the Deathloom PoB fork)`)
        }
      }
    }
    const buildPath = await this.resolveActiveBuild()
    let stat
    try {
      stat = await fs.stat(buildPath)
    } catch {
      throw new Error(`Active build not found: ${buildPath}`)
    }
    const key = `${buildPath}|${stat.mtimeMs}`
    const rel = path.relative(path.join(this.cfg.buildsDir, this.cfg.player), buildPath)
    const choice = this.loadoutChoice(rel)
    // Going back to PoB's own sets needs a fresh load
    if (this.appliedLoadout && !choice) this.loadedKey = null
    if (key !== this.loadedKey || !this.loadedBuild) {
      const reply = await this.call('load', { path: buildPath })
      this.loadedKey = key
      this.loadedBuild = reply.build as PobBuildInfo
      // Loading drops PoB's live gear set
      this.sentGearAt = 0
      this.pobHasGear = false
      this.appliedLoadout = ''
      this.loadedRel = rel
      this.logger.write(`info [PoB] loaded build "${this.loadedBuild.name}"`)
    }
    if (choice && choice !== this.appliedLoadout) {
      try {
        const reply = await this.call('setLoadout', JSON.parse(choice))
        this.loadedBuild = reply.build as PobBuildInfo
      } catch (err) {
        // A loadout that no longer exists: fall back to the build's own sets
        this.logger.write(`warn [PoB] loadout ${choice}: ${(err as Error).message}`)
      }
      this.appliedLoadout = choice
      // setLoadout drops PoB's live gear set
      this.sentGearAt = 0
      this.pobHasGear = false
    }
    return this.loadedBuild
  }

  // JSON of the saved loadout choice for a build ('' = none)
  private loadoutChoice (rel: string): string {
    const choice = this.cfg?.loadouts?.[rel]
    if (!choice) return ''
    const clean: PobLoadoutChoice = {}
    if (choice.named) clean.named = choice.named
    else {
      if (choice.spec) clean.spec = choice.spec
      if (choice.itemSet) clean.itemSet = choice.itemSet
      if (choice.skillSet) clean.skillSet = choice.skillSet
    }
    return Object.keys(clean).length ? JSON.stringify(clean) : ''
  }

  private playerDir (): string {
    const cfg = this.cfg
    if (!cfg?.buildsDir || !cfg.player) throw new Error('Missing in settings: Builds folder, Player')
    return path.join(cfg.buildsDir, cfg.player)
  }

  // All PoB builds in the player's folder (relative paths), newest folders first as PoB sorts them
  async listBuilds (): Promise<PobBuildList> {
    const root = this.playerDir()
    const builds: string[] = []
    const walk = async (dir: string, depth: number) => {
      let entries
      try {
        entries = await fs.readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory() && depth < 6) {
          await walk(full, depth + 1)
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
          builds.push(path.relative(root, full))
        }
      }
    }
    await walk(root, 0)
    builds.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    let active: string | null = null
    try {
      active = path.relative(root, await this.resolveActiveBuild())
    } catch {}
    return { builds, active }
  }

  // Write active.txt: keeps comment lines, replaces the build line
  async setActiveBuild (rel: string) {
    const root = this.playerDir()
    const list = await this.listBuilds()
    if (!list.builds.includes(rel)) throw new Error(`Build not found in your folder: ${rel}`)
    const activeFile = path.join(root, 'active.txt')
    let lines: string[] = []
    try {
      lines = (await fs.readFile(activeFile, 'utf8')).split(/\r?\n/)
    } catch {}
    const idx = lines.findIndex(l => l.trim() && !l.trim().startsWith('#'))
    if (idx >= 0) lines[idx] = rel
    else {
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
      lines.push(rel)
    }
    // Same line endings as PoB's files on Windows; Push/Pull compares bytes
    await fs.writeFile(activeFile, lines.join('\r\n').replace(/(\r\n)*$/, '') + '\r\n', 'utf8')
    this.logger.write(`info [PoB] active build set to ${rel}`)
  }

  async builds (setActive?: string, setLoadout?: PobLoadoutChoice): Promise<{ list: PobBuildList, build?: PobBuildInfo, loadouts?: PobLoadouts }> {
    if (setActive) await this.setActiveBuild(setActive)
    if (setLoadout && this.cfg) {
      // The renderer saves the same choice in its config; apply it now so this
      // reply already shows it
      const list = await this.listBuilds()
      if (list.active) {
        this.cfg.loadouts = { ...this.cfg.loadouts, [list.active]: setLoadout }
      }
    }
    const list = await this.listBuilds()
    if (!list.active) return { list }
    const build = await this.ensureBuild()
    const reply = await this.call('loadouts')
    const loadouts = reply.loadouts as PobLoadouts
    for (const key of ['trees', 'itemSets', 'skillSets', 'named'] as const) {
      // PoB's JSON encoder writes empty lists as {}
      if (!Array.isArray(loadouts[key])) (loadouts as any)[key] = []
    }
    return { list, build: (reply.build as PobBuildInfo | undefined) ?? build, loadouts }
  }

  async gems (refreshGear: boolean): Promise<{ build: PobBuildInfo, groups: PobSocketGroup[], live?: PobSocketGroup[], character?: string, liveError?: string }> {
    await this.ensureBuild()
    let liveError: string | undefined
    if (!this.liveTarget()) {
      liveError = 'Turn on "Also compare with my equipped gear" in Settings → Path of Building to compare with your character.'
    } else if (!this.cfg?.liveTreeAndGems) {
      liveError = 'Turn on "Use the character\'s passive tree, level and gems too" to compare gems.'
    }
    const live = await this.syncLiveGear(refreshGear)
    if (live.error) liveError = live.error
    const reply = await this.call('gems')
    const fix = (groups: unknown) => (Array.isArray(groups) ? groups as PobSocketGroup[] : [])
      .map(g => ({ ...g, gems: Array.isArray(g.gems) ? g.gems : [] }))
    return {
      build: reply.build as PobBuildInfo,
      groups: fix(reply.groups),
      live: reply.live ? fix(reply.live) : undefined,
      character: reply.character,
      liveError: reply.live ? undefined : liveError
    }
  }

  // The build's own items (active item set) for the build gear panel
  async gear (): Promise<{ build: PobBuildInfo, itemSet: string, items: PobGearItem[] }> {
    const build = await this.ensureBuild()
    const reply = await this.call('gear')
    return {
      build: (reply.build as PobBuildInfo | undefined) ?? build,
      itemSet: String(reply.itemSet ?? ''),
      // PoB's JSON encoder writes empty lists as {}
      items: (Array.isArray(reply.items) ? reply.items as PobGearItem[] : [])
        .map(item => ({ ...item, mods: Array.isArray(item.mods) ? item.mods : [] }))
    }
  }

  async impact (itemText: string, refreshGear = false): Promise<{ build: PobBuildInfo, result: PobImpactResult }> {
    await this.ensureBuild()
    const live = await this.syncLiveGear(refreshGear)
    const reply = await this.call('impact', { item: itemText })
    const result: PobImpactResult = { item: reply.item, compares: reply.compares, lines: reply.lines }
    if (reply.equipped) {
      const info = reply.equipped.info as PobEquippedInfo | undefined
      if (info) {
        info.fetchedAt = this.sentGearAt
        info.passivesError = this.passivesError
        if (!Array.isArray(info.skipped)) info.skipped = []
        if (!Array.isArray(info.summary)) info.summary = []
      }
      result.equipped = { compares: reply.equipped.compares, lines: reply.equipped.lines, info }
    }
    if (live.error ?? reply.equippedError) {
      result.equippedError = String(live.error ?? reply.equippedError)
    }
    return { build: this.loadedBuild!, result }
  }
}
