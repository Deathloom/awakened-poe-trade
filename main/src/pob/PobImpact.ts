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
import type { PobConfig, PobBuildInfo, PobImpactResult, PobEquippedInfo, PobGearItem, PobLoadoutChoice, PobBuildList, PobLoadouts, PobSocketGroup, PobSocketedItem, PobCharacterEntry, PobTreeSummary, PobTreeAlloc, PobTreeMapLayout } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import { CharacterBuilds, scanLog, type LogScanState } from './ActiveCharacter'
import { LiveGear, HttpError, type FetchFn } from './LiveGear'
import { pobDefaults, withDefaults, isLegacyPobSetting, type PobDefaults } from './defaults'
import { findExistingBuilds, copyBuilds } from './ExistingPob'

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
  // settings as saved (empty fields = defaults)
  private rawCfg: PobConfig | undefined
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
  // panels are told to ask again once the rate limit allows (after a character switch)
  private liveRetryTimer: NodeJS.Timeout | null = null
  private liveRetries = 0
  private pobHasGear = false
  private passivesError: string | undefined
  // Loadout choice applied to the loaded build (JSON, '' = PoB's own active sets)
  private appliedLoadout = ''
  private loadedRel = ''
  // Deathloom fork: character being played (auto mode), from Client.txt + get-characters
  private activeCharacter: string | null = null
  private characterAccount = ''
  private logState: LogScanState = { atLogin: true }
  private resolveTimer: NodeJS.Timeout | null = null
  // Deathloom fork: Lua errors / crashes of the headless PoB (automatic problem report)
  onCodeError: (message: string, detail?: string) => void = () => {}
  // Deathloom fork: Loot Goblin wrote a file in the player folder (auto sync pushes it)
  onPlayerFilesChanged: () => void = () => {}
  // Deathloom fork: why Loot Goblin's PoB isn't usable yet (null = it is), from PobInstaller
  installStatus: () => string | null = () => null
  private characterBuilds = new CharacterBuilds(path.join(app.getPath('userData'), 'apt-data', 'pob-characters.json'))

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
      const send = this.server.replyTo()
      void this.pickFolder(title, defaultPath).then((picked) => {
        send({
          name: 'MAIN->CLIENT::pob-pick-folder',
          payload: { requestId, path: picked }
        })
      })
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-defaults', ({ requestId }) => {
      this.server.replyTo()({
        name: 'MAIN->CLIENT::pob-defaults',
        payload: { requestId, ...this.defaults() }
      })
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-impact', ({ requestId, itemText, refreshGear }) => {
      const send = this.server.replyTo()
      this.queue = this.queue
        .then(async () => await this.impact(itemText, refreshGear === true))
        .then(({ build, result }) => {
          send({
            name: 'MAIN->CLIENT::pob-impact',
            payload: { requestId, ok: true, build, result }
          })
        })
        .catch((err: Error) => {
          send({
            name: 'MAIN->CLIENT::pob-impact',
            payload: { requestId, ok: false, error: err.message }
          })
        })
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-builds', ({ requestId, setActive, setLoadout, setCharacter }) => {
      this.reply('MAIN->CLIENT::pob-builds', requestId, async () => await this.builds(setActive, setLoadout, setCharacter))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-tree', ({ requestId, refreshGear }) => {
      this.reply('MAIN->CLIENT::pob-tree', requestId, async () => await this.tree(refreshGear === true))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-tree-map', ({ requestId, refreshGear, haveVersion }) => {
      this.reply('MAIN->CLIENT::pob-tree-map', requestId, async () =>
        await this.treeMap(refreshGear === true, typeof haveVersion === 'string' ? haveVersion.slice(0, 32) : undefined))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-gems', ({ requestId, refreshGear }) => {
      this.reply('MAIN->CLIENT::pob-gems', requestId, async () => await this.gems(refreshGear === true))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-gear', ({ requestId }) => {
      // the build gear panel can be in the overlay or the HUD window
      const send = this.server.replyTo()
      this.queue = this.queue
        .then(async () => await this.gear())
        .then(({ build, itemSet, items }) => {
          send({
            name: 'MAIN->CLIENT::pob-gear',
            payload: { requestId, ok: true, build, itemSet, items }
          })
        })
        .catch((err: Error) => {
          send({
            name: 'MAIN->CLIENT::pob-gear',
            payload: { requestId, ok: false, error: err.message }
          })
        })
    })
  }

  private reply<N extends 'MAIN->CLIENT::pob-builds' | 'MAIN->CLIENT::pob-gems' | 'MAIN->CLIENT::pob-tree' | 'MAIN->CLIENT::pob-tree-map'> (
    name: N, requestId: number, work: () => Promise<Record<string, unknown>>
  ) {
    const send = this.server.replyTo()
    this.queue = this.queue
      .then(work)
      .then((payload) => {
        send({ name, payload: { requestId, ok: true, ...payload } } as any)
      })
      .catch((err: Error) => {
        send({ name, payload: { requestId, ok: false, error: err.message } } as any)
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

  // Bundled PoB, Documents\Loot Goblin\Builds and the PoB sync player (see defaults.ts)
  defaults (): PobDefaults {
    return pobDefaults({
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      documents: app.getPath('documents')
    }, this.rawCfg?.pobDir ?? '')
  }

  // Deathloom fork: Loot Goblin's PoB was downloaded or updated: use it (defaults
  // change from '' to its folder) and restart the headless PoB on the new files
  usesOwnPob (): boolean {
    return !!this.rawCfg?.pobDir
  }

  refreshPob () {
    this.stop()
    this.configure(this.rawCfg)
  }

  // PoB folder in use (setting, else the bundled copy); '' if none
  pobDir (): string {
    return this.rawCfg?.pobDir || this.defaults().pobDir
  }

  configure (raw: PobConfig | undefined) {
    // Deathloom fork: a PoB folder setting pointing at the copy that used to be
    // inside the install folder means "Loot Goblin's PoB" now
    if (raw?.pobDir && isLegacyPobSetting(raw.pobDir)) raw = { ...raw, pobDir: '' }
    this.rawCfg = raw
    const cfg = raw && withDefaults(raw, this.defaults())
    this.logger.write(`info [PoB] settings: ${JSON.stringify(raw ?? null)}`)
    if (cfg && raw && (cfg.pobDir !== raw.pobDir || cfg.buildsDir !== raw.buildsDir || cfg.player !== raw.player)) {
      this.logger.write(`info [PoB] with defaults: pobDir=${cfg.pobDir} buildsDir=${cfg.buildsDir} player=${cfg.player}`)
    }
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
    if (this.characterAccount !== (cfg?.accountName ?? '')) {
      this.characterAccount = cfg?.accountName ?? ''
      this.activeCharacter = null
    }
    if (this.listsCharacters() && !this.activeCharacter && !this.resolveTimer) {
      // overlay started (maybe while already playing): fill the list, pick the last played
      this.scheduleResolve(1500, false)
    }
  }

  private liveTarget () {
    const cfg = this.cfg
    const character = this.currentCharacter()
    if (!cfg?.enabled || !cfg.liveGear || !cfg.accountName || !character) return null
    return { accountName: cfg.accountName, character, tree: cfg.liveTreeAndGems }
  }

  // ---- Follow the character being played --------------------------------
  private autoCharacter () {
    const cfg = this.cfg
    return Boolean(cfg?.enabled && cfg.liveGear && cfg.accountName && cfg.characterAuto !== false)
  }

  // Character list available (live gear on + account set)
  private listsCharacters () {
    const cfg = this.cfg
    return Boolean(cfg?.enabled && cfg.liveGear && cfg.accountName)
  }

  // Detected or picked in the build panel; else the Character setting
  currentCharacter () {
    if (this.listsCharacters() && this.activeCharacter) return this.activeCharacter
    return this.cfg?.character ?? ''
  }

  // Picked in the build panel's Character dropdown (until the next detected login)
  async pickCharacter (name: string) {
    if (!this.listsCharacters() || name === this.activeCharacter) return
    await this.setCharacter(name, false)
  }

  async characterList () {
    return this.listsCharacters() ? await this.characterBuilds.characters(this.cfg!.accountName) : []
  }

  // Client.txt lines (history = lines that were already in the file at start)
  handleLogLines (lines: string[], isHistory: boolean) {
    const { entered, levelUps } = scanLog(lines, this.logState)
    if (isHistory || !this.autoCharacter()) return
    if (entered) {
      // give the server a moment to mark the character as last active
      this.scheduleResolve(4000, true)
    } else if (levelUps.some(name => name !== this.activeCharacter)) {
      this.scheduleResolve(1000, false)
    }
  }

  private scheduleResolve (delay: number, retryIfSame: boolean) {
    if (this.resolveTimer) clearTimeout(this.resolveTimer)
    this.resolveTimer = setTimeout(() => {
      this.resolveTimer = null
      void this.resolveCharacter(retryIfSame)
    }, delay)
  }

  private async resolveCharacter (retryIfSame: boolean) {
    if (!this.listsCharacters()) return
    const account = this.cfg!.accountName
    let list
    try {
      list = await this.liveGear.characterList(account)
    } catch (err) {
      this.logger.write(`warn [PoB] can't read the character list: ${(err as Error).message}`)
      return
    }
    if (!list?.length) return
    await this.characterBuilds.setCharacters(account, list).catch(() => {})
    const name = list[0].lastLoginTime !== undefined ? list[0].name : null
    if (!this.autoCharacter() || !name) {
      this.announceCharacter()
      return
    }
    if (name === this.activeCharacter) {
      // last login time can lag right after a switch: look once more
      if (retryIfSame) this.scheduleResolve(25_000, false)
      this.announceCharacter()
      return
    }
    await this.setCharacter(name, true)
  }

  // Re-announce the character when a gear fetch is allowed again, so the
  // panels (gear, gems, tree) ask once more and show the new character
  private scheduleLiveRetry () {
    // a few tries per character, so a lasting rate limit can't keep it going
    if (this.liveRetryTimer || this.liveRetries >= 3) return
    this.liveRetries += 1
    const wait = Math.min(Math.max(this.liveGear.retryIn(), 1000), 120_000) + 500
    this.liveRetryTimer = setTimeout(() => {
      this.liveRetryTimer = null
      this.announceCharacter()
    }, wait)
  }

  // Tell the panels (list or character changed)
  private announceCharacter (build?: string) {
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::pob-character',
      payload: { character: this.currentCharacter(), build }
    })
  }

  private async setCharacter (name: string, detected: boolean) {
    const previous = this.activeCharacter
    this.activeCharacter = name
    this.liveRetries = 0
    this.logger.write(`info [PoB] ${detected ? 'playing' : 'picked'} ${name}${previous ? ` (was ${previous})` : ''}`)
    this.liveGear.setTarget(this.liveTarget())
    this.sentGearAt = 0
    let build: string | undefined
    try {
      build = await this.characterBuilds.get(name)
      if (build) {
        const list = await this.listBuilds()
        if (list.active !== build && list.builds.includes(build)) {
          await this.setActiveBuild(build, false)
        } else if (!list.builds.includes(build)) {
          build = undefined
        }
      }
    } catch (err) {
      this.logger.write(`warn [PoB] build for ${name}: ${(err as Error).message}`)
      build = undefined
    }
    this.announceCharacter(build)
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
        // stop() kills it on purpose (code null); anything else is a crash
        if (code !== null && code !== 0 && this.proc === proc) this.onCodeError(`Headless PoB exited (code ${String(code)})`, detail)
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
            else {
              const msg = String(reply.error ?? 'Unknown error')
              if (/\.lua:\d+:/.test(msg)) this.onCodeError(msg)
              p.reject(new Error(msg))
            }
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
      const message = (err as Error).message
      if (/waiting|character changed|rate limit/.test(message)) this.scheduleLiveRetry()
      return { error: message }
    }
    if (gear.passivesError?.includes('rate limit') && this.cfg?.liveTreeAndGems) this.scheduleLiveRetry()
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
    if (!this.cfg.player && this.rawCfg) {
      // PoB's build sharing may have been set up since (player folder in BuildSync.json)
      const next = withDefaults(this.rawCfg, this.defaults())
      if (next.player) this.configure(this.rawCfg)
    }
    const missing = [
      !this.cfg.pobDir && 'Path of Building folder',
      !this.cfg.buildsDir && 'Builds folder'
    ].filter(Boolean)
    if (missing.length) {
      // Deathloom fork: no PoB folder set and Loot Goblin's own isn't there yet
      const pobStatus = !this.cfg.pobDir ? this.installStatus() : null
      if (pobStatus) throw new Error(pobStatus)
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

  // Settings with defaults filled in (undefined before the first settings arrive)
  resolved (): PobConfig | undefined {
    return this.rawCfg && withDefaults(this.rawCfg, this.defaults())
  }

  // Deathloom fork: first-run setup guide. Folders in use (setting or default),
  // whether PoB is there, and with an account name the public character list
  // (one request, same rate limiting as live gear).
  async setupProbe (accountName?: string) {
    const d = this.defaults()
    const cfg = this.resolved()
    const pobDir = cfg?.pobDir || d.pobDir
    let pobOk = false
    if (pobDir) {
      try {
        await fs.access(path.join(pobDir, 'runtime', 'PoBHeadless.exe'))
        pobOk = true
      } catch {}
    }
    const out: {
      pobDir: string
      pobOk: boolean
      buildsDir: string
      player: string
      characters?: Array<{ name: string, league?: string, level?: number, class?: string }>
      charactersError?: string
      existingPob?: { buildsDir: string, count: number }
    } = { pobDir, pobOk, buildsDir: cfg?.buildsDir || d.buildsDir, player: cfg?.player ?? d.player }
    out.existingPob = await this.existingBuilds() ?? undefined
    const account = accountName?.trim()
    if (account) {
      try {
        const list = await this.liveGear.characterList(account)
        if (list === null) {
          out.charactersError = 'pathofexile.com asked us to wait a moment. Try again in a minute.'
        } else {
          out.characters = list.map(({ name, league, level, class: cls }) => ({ name, league, level, class: cls }))
          await this.characterBuilds.setCharacters(account, list).catch(() => {})
        }
      } catch (err) {
        const status = err instanceof HttpError ? err.status : 0
        out.charactersError = status === 403
          ? 'Your Characters tab isn\'t public. On pathofexile.com: My Account → Privacy Settings → untick "Hide characters", then check again.'
          : status === 404
            ? 'Account not found. Use the name exactly as on your profile, including #1234.'
            : (err as Error).message.replace(/^Live gear: /, '')
      }
    }
    return out
  }

  private async existingBuilds () {
    const buildsDir = this.resolved()?.buildsDir || this.defaults().buildsDir
    return await findExistingBuilds(app.getPath('documents'), buildsDir).catch(() => null)
  }

  // Copy the earlier PoB install's builds into the player folder (or the builds folder)
  async copyExistingBuilds () {
    const found = await this.existingBuilds()
    if (!found) throw new Error('No other Path of Building builds found')
    const target = this.playerDir()
    const res = await copyBuilds(found.buildsDir, target)
    this.logger.write(`info [PoB] copied ${res.copied} builds from ${found.buildsDir} (${res.skipped} already there)`)
    return { ...res, target }
  }

  // Sign-in or player folder changed in Loot Goblin's build sync: pick up the new defaults
  refreshDefaults () {
    if (this.rawCfg) this.configure(this.rawCfg)
  }

  playerDir (): string {
    const cfg = this.cfg
    if (!cfg?.buildsDir) throw new Error('Missing in settings: Builds folder')
    // no player folder (PoB without build sharing): the builds folder itself
    return path.join(cfg.buildsDir, cfg.player || '')
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
  async setActiveBuild (rel: string, remember = true) {
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
    this.onPlayerFilesChanged()
    if (remember && this.listsCharacters() && this.activeCharacter) {
      // picked by hand while playing this character: use it again next time
      await this.characterBuilds.set(this.activeCharacter, rel).catch((err: Error) => {
        this.logger.write(`warn [PoB] couldn't save build for ${this.activeCharacter}: ${err.message}`)
      })
    }
  }

  async builds (setActive?: string, setLoadout?: PobLoadoutChoice, setCharacter?: string): Promise<{ list: PobBuildList, build?: PobBuildInfo, loadouts?: PobLoadouts, character?: string, characters?: PobCharacterEntry[] }> {
    if (setCharacter) await this.pickCharacter(setCharacter)
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
    const character = this.currentCharacter() || undefined
    const characters = await this.characterList()
    if (!list.active) return { list, character, characters }
    const build = await this.ensureBuild()
    const reply = await this.call('loadouts')
    const loadouts = reply.loadouts as PobLoadouts
    for (const key of ['trees', 'itemSets', 'skillSets', 'named'] as const) {
      // PoB's JSON encoder writes empty lists as {}
      if (!Array.isArray(loadouts[key])) (loadouts as any)[key] = []
    }
    return { list, build: (reply.build as PobBuildInfo | undefined) ?? build, loadouts, character, characters }
  }

  // Passive tree tab: the build's tree (selected loadout) and the character's
  async tree (refreshGear: boolean): Promise<{ build: PobBuildInfo, tree: PobTreeSummary, live?: PobTreeSummary, character?: string, liveError?: string }> {
    await this.ensureBuild()
    let liveError: string | undefined
    if (!this.liveTarget()) {
      liveError = 'Turn on "Also compare with my equipped gear" in Settings → Path of Building to compare with your character.'
    } else if (!this.cfg?.liveTreeAndGems) {
      liveError = 'Turn on "Use the character\'s passive tree, level and gems too" to compare trees.'
    }
    const live = await this.syncLiveGear(refreshGear)
    if (live.error) liveError = live.error
    const reply = await this.call('tree')
    // PoB's JSON encoder writes empty lists as {}
    const fix = (t: any): PobTreeSummary => ({ ...t, nodes: Array.isArray(t?.nodes) ? t.nodes : [] })
    return {
      build: reply.build as PobBuildInfo,
      tree: fix(reply.tree),
      live: reply.live ? fix(reply.live) : undefined,
      character: reply.character,
      liveError: reply.live ? undefined : (liveError ?? this.passivesError)
    }
  }

  // Tree map (desktop window): whole tree layout (only when the window lacks this
  // version) + allocated node ids of the build's loadout and the character
  async treeMap (refreshGear: boolean, haveVersion?: string): Promise<Record<string, unknown>> {
    await this.ensureBuild()
    let liveError: string | undefined
    if (!this.liveTarget()) {
      liveError = 'Turn on "Also compare with my equipped gear" in Settings → Path of Building to compare with your character.'
    } else if (!this.cfg?.liveTreeAndGems) {
      liveError = 'Turn on "Use the character\'s passive tree, level and gems too" to compare trees.'
    }
    const live = await this.syncLiveGear(refreshGear)
    if (live.error) liveError = live.error
    const reply = await this.call('treeMap', haveVersion ? { haveVersion } : {})
    // PoB's JSON encoder writes empty lists/maps as {}
    const list = (v: unknown) => Array.isArray(v) ? v : []
    const fixAlloc = (a: any): PobTreeAlloc | undefined => a ? { ...a, ids: list(a.ids), masteries: (a.masteries && !Array.isArray(a.masteries)) ? a.masteries : {} } : undefined
    const layout = reply.layout ? {
      nodes: list(reply.layout.nodes).map((n: any[]) => { const c = [...n]; c[8] = list(n[8]); return c }),
      groups: Array.isArray(reply.layout.groups) ? {} : reply.layout.groups,
      links: list(reply.layout.links),
      orbitRadii: list(reply.layout.orbitRadii)
    } as PobTreeMapLayout : undefined
    return {
      build: reply.build as PobBuildInfo,
      version: reply.version,
      layout,
      alloc: fixAlloc(reply.alloc),
      live: fixAlloc(reply.live),
      character: reply.character,
      liveError: reply.live ? undefined : (liveError ?? this.passivesError)
    }
  }

  async gems (refreshGear: boolean): Promise<{ build: PobBuildInfo, groups: PobSocketGroup[], live?: PobSocketGroup[], items: PobSocketedItem[], liveItems?: PobSocketedItem[], character?: string, liveError?: string }> {
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
    // PoB's JSON encoder writes empty lists as {}
    const items = (list: unknown) => (Array.isArray(list) ? list as PobSocketedItem[] : [])
      .filter(i => typeof i?.slot === 'string' && typeof i?.sockets === 'string')
    return {
      build: reply.build as PobBuildInfo,
      groups: fix(reply.groups),
      live: reply.live ? fix(reply.live) : undefined,
      items: items(reply.items),
      liveItems: reply.live ? items(reply.liveItems) : undefined,
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
