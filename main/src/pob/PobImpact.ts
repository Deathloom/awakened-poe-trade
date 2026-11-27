// Deathloom fork: runs Path of Building headless (src/ImpactServer.lua) and
// answers "what does this item do to my active build?" for the overlay.
//
// PoB runs as one long-lived child process. The active build is read from
// <buildsDir>/<player>/active.txt and reloaded whenever that file or the build
// file changes, so pulling builds in PoB is picked up automatically.

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import * as fs from 'fs/promises'
import { readFileSync } from 'fs'
import * as path from 'path'
import { applyBuildOp, realFileInside, type BuildFileOp } from './BuildFiles'
import { parseBuildXml } from './build-xml'
import { lootGoblinUserAgent } from '../proxy'
import { app, net, dialog, BrowserWindow } from 'electron'
import type { PobEditOp, PobConfig, PobBuildInfo, PobImpactResult, PobEquippedInfo, PobGearItem, PobLoadoutChoice, PobBuildList, PobLoadouts, PobSocketGroup, PobSocketedItem, PobCharacterEntry, PobTreeSummary, PobTreeAlloc, PobTreeMapLayout, PobPlan, PobBuildSummary, PobSetSelection } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import { CharacterBuilds, scanLog, type LogScanState } from './ActiveCharacter'
import { LIVE_CHARACTER_DATA, LIVE_CHARACTER_OFF, LiveGear, HttpError, type FetchFn } from './LiveGear'
import { pobDefaults, withDefaults, isLegacyPobSetting, type PobDefaults } from './defaults'
import { findExistingBuilds, copyBuilds } from './ExistingPob'
import { isCodeError } from '../ErrorReporter'
import { pobCapsFromReady, pobCapFor, pobSupports, pobNeedsUpdate, type PobCaps } from '../../../ipc/pob-caps'
import { shouldAnnounce } from './announce'

const STARTUP_TIMEOUT = 90_000
const REQUEST_TIMEOUT = 30_000
// Deathloom fork (Gerhard 19 Nov 2026): loading a big build right after PoB starts (cold
// data caches) can take well over 30 s, which showed as an error in the app
const LOAD_TIMEOUT = 150_000
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
  // Deathloom fork (S6): what the running PoB can do (from its ready line)
  private caps: PobCaps | null = null
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
  // Deathloom fork: names that joined your area (party members), not followed as yours
  private partyNames = new Set<string>()
  private characterAccount = ''
  private logState: LogScanState = { atLogin: true }
  private resolveTimer: NodeJS.Timeout | null = null
  // Deathloom fork: Lua errors / crashes of the headless PoB (automatic problem report)
  onCodeError: (message: string, detail?: string) => void = () => {}
  // Deathloom fork: Orbhoarder wrote a file in the player folder (auto sync pushes it)
  onPlayerFilesChanged: () => void = () => {}
  // Deathloom fork: why Orbhoarder's PoB isn't usable yet (null = it is), from PobInstaller
  installStatus: () => string | null = () => null
  private characterBuilds = new CharacterBuilds(path.join(app.getPath('userData'), 'apt-data', 'pob-characters.json'))

  constructor (
    private server: ServerEvents,
    private logger: Logger
  ) {
    this.liveGear = new LiveGear(
      net.fetch as unknown as FetchFn,
      lootGoblinUserAgent(),
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
    // Deathloom fork: price checks in quick succession: only the newest waiting item is
    // calculated (each one is a full PoB calculation; the overlay shows only the last)
    let impactSeq = 0
    this.server.onEventAnyClient('CLIENT->MAIN::pob-impact', ({ requestId, itemText, refreshGear, myCharacter }) => {
      const send = this.server.replyTo()
      const seq = ++impactSeq
      this.queue = this.queue
        .then(async () => {
          if (seq !== impactSeq) throw new Error('A newer item is being checked.')
          return await this.impact(itemText, refreshGear === true, myCharacter)
        })
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
    this.server.onEventAnyClient('CLIENT->MAIN::pob-builds', ({ requestId, setActive, setLoadout, setCharacter, setPlayer }) => {
      this.reply('MAIN->CLIENT::pob-builds', requestId, async () => {
        if (typeof setPlayer === 'string') await this.setViewPlayer(setPlayer)
        return await this.builds(setActive, setLoadout, setCharacter)
      })
      // Deathloom fork (user report 20 Nov 2026): the reply only reaches the
      // panel that asked, so tell every panel (tree map, tree, gems, other
      // windows) that the build, loadout, character or player changed
      if (shouldAnnounce('CLIENT->MAIN::pob-builds', { setActive, setLoadout, setCharacter, setPlayer })) this.announceAfterQueue()
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-edit', ({ requestId, ops }) => {
      this.reply('MAIN->CLIENT::pob-edit', requestId, async () => await this.editLoadouts(ops))
      if (shouldAnnounce('CLIENT->MAIN::pob-edit', { ops })) this.announceAfterQueue()
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-manage-build', (req) => {
      this.reply('MAIN->CLIENT::pob-manage-build', req.requestId, async () => await this.manageBuild(req))
      // S5: renaming / moving / deleting the active build left other windows'
      // tree, gems and build list stale
      if (shouldAnnounce('CLIENT->MAIN::pob-manage-build', req)) this.announceAfterQueue()
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-tree', ({ requestId, refreshGear }) => {
      this.reply('MAIN->CLIENT::pob-tree', requestId, async () => await this.tree(refreshGear === true))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-tree-map', ({ requestId, refreshGear, haveVersion }) => {
      this.reply('MAIN->CLIENT::pob-tree-map', requestId, async () =>
        await this.treeMap(refreshGear === true, typeof haveVersion === 'string' ? haveVersion.slice(0, 32) : undefined))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-compare', ({ requestId, a, b, selA, selB }) => {
      this.reply('MAIN->CLIENT::pob-compare', requestId, async () => ({
        a: await this.readBuildSummary(a, selA),
        b: await this.readBuildSummary(b, selB)
      }))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-timeless', (req) => {
      this.reply('MAIN->CLIENT::pob-timeless', req.requestId, async () => await this.timeless(req))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-craft', (req) => {
      this.reply('MAIN->CLIENT::pob-craft', req.requestId, async () => await this.craft(req))
    })
    this.server.onEventAnyClient('CLIENT->MAIN::pob-plan', ({ requestId, level, questPoints }) => {
      this.reply('MAIN->CLIENT::pob-plan', requestId, async () => await this.plan(level, questPoints))
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

  private reply<N extends 'MAIN->CLIENT::pob-builds' | 'MAIN->CLIENT::pob-manage-build' | 'MAIN->CLIENT::pob-edit' | 'MAIN->CLIENT::pob-gems' | 'MAIN->CLIENT::pob-tree' | 'MAIN->CLIENT::pob-tree-map' | 'MAIN->CLIENT::pob-plan' | 'MAIN->CLIENT::pob-compare' | 'MAIN->CLIENT::pob-timeless' | 'MAIN->CLIENT::pob-craft'> (
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

  // Deathloom fork (F1 review): folders you picked in the folder dialog this run
  // (Copy builds from another folder only takes one of these)
  private pickedFolders = new Set<string>()

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
      if (res.canceled || res.filePaths.length === 0) return null
      this.pickedFolders.add(path.resolve(res.filePaths[0]).toLowerCase())
      return res.filePaths[0]
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

  // Deathloom fork: Orbhoarder's PoB was downloaded or updated: use it (defaults
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
    // inside the install folder means "Orbhoarder's PoB" now
    if (raw?.pobDir && isLegacyPobSetting(raw.pobDir)) raw = { ...raw, pobDir: '' }
    this.rawCfg = raw
    const cfg = raw && withDefaults(raw, this.defaults())
    // Deathloom fork: the log goes into problem reports, so only say what kind of
    // setting is used, never folder paths, the player name or other values
    const kind = (v: unknown) => v ? 'custom' : 'default'
    this.logger.write(`info [PoB] settings: ${raw ? `enabled=${String(raw.enabled)} pobDir=${kind(raw.pobDir)} buildsDir=${kind(raw.buildsDir)} player=${raw.player ? 'set' : 'not set'} (${Object.keys(raw).length} settings)` : 'none'}`)
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
    if (cfg?.enabled && (!same || !this.warmedUp)) this.warmUp()
  }

  // Deathloom fork (Gerhard 19 Nov 2026): start the headless PoB and load the active build
  // in the background when Orbhoarder starts (or PoB settings change), so the first build
  // panel / price check doesn't wait for a cold start. Runs in the queue like any request;
  // failures are only logged (the next real request tries again and shows the error).
  private warmedUp = false
  private warmTimer: ReturnType<typeof setTimeout> | null = null
  private warmUp () {
    this.warmedUp = true
    if (this.warmTimer) clearTimeout(this.warmTimer)
    this.warmTimer = setTimeout(() => {
      this.warmTimer = null
      if (!this.cfg?.enabled) return
      const t0 = Date.now()
      this.queue = this.queue
        .then(async () => { await this.ensureBuild() })
        .then(() => { this.logger.write(`info [PoB] warmed up in ${Math.round((Date.now() - t0) / 1000)} s`) })
        .catch((err: Error) => { this.logger.write(`warn [PoB] warm-up: ${err.message}`) })
    }, 4000)
  }

  private liveTarget () {
    const cfg = this.cfg
    const character = this.currentCharacter()
    if (!LIVE_CHARACTER_DATA || !cfg?.enabled || !cfg.liveGear || !cfg.accountName || !character) return null
    return { accountName: cfg.accountName, character, tree: cfg.liveTreeAndGems }
  }

  // ---- Follow the character being played --------------------------------
  private autoCharacter () {
    const cfg = this.cfg
    return Boolean(LIVE_CHARACTER_DATA && cfg?.enabled && cfg.liveGear && cfg.accountName && cfg.characterAuto !== false)
  }

  // Character list available (live gear on + account set)
  private listsCharacters () {
    const cfg = this.cfg
    return Boolean(LIVE_CHARACTER_DATA && cfg?.enabled && cfg.liveGear && cfg.accountName)
  }

  // Detected (character list or game log) or picked in the build panel; else the Character setting
  currentCharacter () {
    if (this.activeCharacter) return this.activeCharacter
    return this.cfg?.character ?? ''
  }

  // Picked in the build panel's Character dropdown (until the next detected login / level-up)
  async pickCharacter (name: string) {
    if (!name || name === this.activeCharacter) return
    await this.setCharacter(name, false)
  }

  async characterList () {
    return this.listsCharacters() ? await this.characterBuilds.characters(this.cfg!.accountName) : []
  }

  // Client.txt lines (history = lines that were already in the file at start)
  handleLogLines (lines: string[], isHistory: boolean) {
    const { entered, levelUps, joined } = scanLog(lines, this.logState)
    for (const name of joined) this.partyNames.add(name)
    // Deathloom fork: without the character list (pathofexile.com, off), follow
    // the character from Client.txt: the last one levelling up that isn't a party
    // member who joined your area. Switching restores that character's build.
    if (!this.listsCharacters()) {
      if (!this.cfg?.enabled || this.cfg.characterAuto === false) return
      const mine = levelUps.filter(name => !this.partyNames.has(name))
      const name = mine[mine.length - 1]
      if (!name || name === this.activeCharacter) return
      if (isHistory) this.activeCharacter = name
      else void this.setCharacter(name, true)
      return
    }
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

  // After the queued reply went out (the asking panel has the new state first)
  private announceAfterQueue () {
    this.queue = this.queue.then(() => { this.announceCharacter() }, () => { this.announceCharacter() })
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
      // your character's remembered build is in your own folder
      if (build && !this.viewingOwn()) await this.setViewPlayer('')
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
    this.caps = null
    this.loadedKey = null
    this.loadedBuild = null
    this.appliedLoadout = ''
    this.sentGearAt = 0
    this.pobHasGear = false
    this.fileGearKey = ''
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
            this.caps = pobCapsFromReady(reply)
            this.logger.write(`info [PoB] ready (PoB ${String(reply.version)}, ${this.caps.reported ? `${this.caps.caps.length} caps` : 'no caps list: older copy'})`)
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
              if (isCodeError(msg)) this.onCodeError(msg)
              p.reject(new Error(msg))
            }
          }
        }
      })
    })
    return this.ready
  }

  private async call (cmd: string, params: Record<string, unknown> = {}, timeout = REQUEST_TIMEOUT): Promise<any> {
    await this.start()
    const proc = this.proc
    if (!proc) throw new Error('Path of Building is not running')
    // Deathloom fork (S6): a command this PoB doesn't know gets an explanation, not "Unknown cmd"
    if (!pobSupports(this.caps, pobCapFor(cmd, params))) throw new Error(pobNeedsUpdate(this.caps))
    const id = this.nextId++
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Path of Building did not answer '${cmd}' in time`))
      }, timeout)
      this.pending.set(id, { resolve, reject, timer })
      proc.stdin.write(JSON.stringify({ id, cmd, ...params }) + '\n')
    })
  }

  private async resolveActiveBuild (): Promise<string> {
    const playerDir = this.playerDir()
    const activeFile = this.activeFile(playerDir)
    let line: string | undefined
    try {
      line = (await fs.readFile(activeFile, 'utf8')).split(/\r?\n/)
        .map(l => l.trim())
        .find(l => l && !l.startsWith('#'))
    } catch {}
    if (line) {
      let name = line.replace(/^(active|build)\s*[:=]\s*/i, '')
      if (!name.toLowerCase().endsWith('.xml')) name += '.xml'
      const full = path.isAbsolute(name) ? name : path.join(playerDir, name)
      try {
        await fs.access(full)
        return full
      } catch {}
    }
    // New player, or the active build was renamed/deleted: use the newest build
    // in the folder and remember it (active.txt)
    const builds = await this.findBuilds(playerDir)
    if (!builds.length) {
      throw new Error('No build yet. Open Path of Building from Orbhoarder, create or import a build and save it (it saves into your folder). ' +
        'Builds in another PoB? Settings → Path of Building → Copy builds.')
    }
    let newest = builds[0]
    let newestAt = -1
    for (const rel of builds) {
      const at = await fs.stat(path.join(playerDir, rel)).then(st => st.mtimeMs, () => -1)
      if (at > newestAt) { newest = rel; newestAt = at }
    }
    await this.writeActive(playerDir, newest).catch(() => {})
    return path.join(playerDir, newest)
  }

  // .xml builds under a folder (relative paths, PoB's sort order)
  private async findBuilds (root: string): Promise<string[]> {
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
    return builds
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
        this.fileGearKey = ''
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
      // Deathloom fork: no PoB folder set and Orbhoarder's own isn't there yet
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
      const reply = await this.call('load', { path: buildPath }, LOAD_TIMEOUT)
      this.loadedKey = key
      this.loadedBuild = reply.build as PobBuildInfo
      // Loading drops PoB's live gear set
      this.sentGearAt = 0
      this.pobHasGear = false
      this.fileGearKey = ''
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
      this.fileGearKey = ''
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
    if (account && LIVE_CHARACTER_DATA) {
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
  async copyExistingBuilds (source?: string) {
    if (source && !this.pickedFolders.has(path.resolve(source).toLowerCase())) {
      throw new Error('Choose the folder with Choose folder… first')
    }
    const from = source || (await this.existingBuilds())?.buildsDir
    if (!from) throw new Error('No other Path of Building builds found')
    const target = this.playerDir()
    const res = await copyBuilds(from, target)
    this.logger.write(`info [PoB] copied ${res.copied} builds from ${from} (${res.skipped} already there)`)
    return { ...res, target }
  }

  // Sign-in or player folder changed in Orbhoarder's build sync: pick up the new defaults
  refreshDefaults () {
    if (this.rawCfg) this.configure(this.rawCfg)
  }

  // Folder whose builds Orbhoarder uses: your own, or another player's
  // (their builds come in with Pull; picked in the build panel)
  playerDir (): string {
    const cfg = this.cfg
    if (!cfg?.buildsDir) throw new Error('Missing in settings: Builds folder')
    // no player folder (PoB without build sharing): the builds folder itself
    return path.join(cfg.buildsDir, this.viewingOwn() ? (cfg.player || '') : this.viewPlayer)
  }

  // Your own folder (the one Push uploads)
  ownDir (): string {
    const cfg = this.cfg
    if (!cfg?.buildsDir) throw new Error('Missing in settings: Builds folder')
    return path.join(cfg.buildsDir, cfg.player || '')
  }

  private viewPlayer = ''
  private viewPlayerLoaded = false
  private viewFile () { return path.join(app.getPath('userData'), 'pob-view-player.txt') }

  viewingOwn (): boolean {
    this.loadViewPlayer()
    return !this.viewPlayer || !this.cfg?.player || this.viewPlayer.toLowerCase() === this.cfg.player.toLowerCase()
  }

  private loadViewPlayer () {
    if (this.viewPlayerLoaded) return
    this.viewPlayerLoaded = true
    try {
      const name = readFileSync(this.viewFile(), 'utf8').trim()
      if (/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(name)) this.viewPlayer = name
    } catch {}
  }

  // '' or your own name: your builds
  async setViewPlayer (name: string) {
    this.loadViewPlayer()
    name = name.trim()
    if (name && !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(name)) throw new Error(`Not a player folder: ${name}`)
    if (name && this.cfg?.player && name.toLowerCase() === this.cfg.player.toLowerCase()) name = ''
    if (name) {
      const builds = await this.findBuilds(path.join(this.cfg?.buildsDir ?? '', name))
      if (!builds.length) throw new Error(`No builds in ${name}'s folder (Pull first)`)
    }
    if (name === this.viewPlayer) return
    this.viewPlayer = name
    await fs.writeFile(this.viewFile(), name, 'utf8').catch(() => {})
    this.loadedKey = null
    this.logger.write(`info [PoB] using builds of ${name || 'your own folder'}`)
  }

  // Players with builds in the builds folder (folders with .xml files), yours first
  private async players (): Promise<string[]> {
    const cfg = this.cfg
    if (!cfg?.buildsDir || !cfg.player) return []
    let entries
    try {
      entries = await fs.readdir(cfg.buildsDir, { withFileTypes: true })
    } catch {
      return []
    }
    const out: string[] = []
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || !/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(e.name)) continue
      if (e.name.toLowerCase() === cfg.player.toLowerCase()) continue
      if ((await this.findBuilds(path.join(cfg.buildsDir, e.name))).length) out.push(e.name)
    }
    out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    return [cfg.player, ...out]
  }

  // active.txt: your own is in your folder (synced); for another player's
  // builds it's kept locally so their folder isn't changed
  private activeFile (root: string): string {
    if (this.viewingOwn()) return path.join(root, 'active.txt')
    return path.join(app.getPath('userData'), 'pob-view-active', `${this.viewPlayer}.txt`)
  }

  // Deathloom fork: the active build for build notes (path in the player folder whose builds are used)
  async activeBuild (): Promise<{ playerDir: string, rel: string, own: boolean, player: string }> {
    const playerDir = this.playerDir()
    const rel = path.relative(playerDir, await this.resolveActiveBuild())
    const own = this.viewingOwn()
    return { playerDir, rel, own, player: own ? (this.cfg?.player ?? '') : this.viewPlayer }
  }

  // Deathloom fork (idea 6): one build of the player folder, read from the file
  // (no PoB needed). Only .xml files inside the player folder, at most 8 MB.
  private async readBuildSummary (rel: unknown, sel?: PobSetSelection): Promise<PobBuildSummary> {
    if (typeof rel !== 'string' || !rel.toLowerCase().endsWith('.xml')) throw new Error('Pick two builds')
    const root = path.resolve(this.playerDir())
    if (!path.resolve(root, rel).startsWith(root + path.sep)) throw new Error('Not in your builds folder')
    // Deathloom fork (Q4 review): real paths, so a link inside the folder can't point outside it
    const full = await realFileInside(root, rel).catch(() => undefined)
    if (full === null) throw new Error('Not in your builds folder')
    const st = full ? await fs.stat(full).catch(() => null) : null
    if (!full || !st?.isFile()) throw new Error(`Build not found: ${path.basename(rel)}`)
    if (st.size > 8 * 1024 * 1024) throw new Error(`Build file too big: ${path.basename(rel)}`)
    const clean = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n > 0 && n < 1000) ? n : undefined
    return parseBuildXml(await fs.readFile(full, 'utf8'), sel ? { spec: clean(sel.spec), itemSet: clean(sel.itemSet), skillSet: clean(sel.skillSet) } : {})
  }

  // All PoB builds in the player's folder (relative paths), newest folders first as PoB sorts them
  async listBuilds (): Promise<PobBuildList> {
    const root = this.playerDir()
    const builds = await this.findBuilds(root)
    let active: string | null = null
    try {
      active = path.relative(root, await this.resolveActiveBuild())
    } catch {}
    const players = await this.players()
    return { builds, active, players, player: this.viewingOwn() ? (this.cfg?.player ?? '') : this.viewPlayer, own: this.cfg?.player ?? '' }
  }

  // Deathloom fork: edit the active build's loadouts (sets, gems, passives)
  async editLoadouts (ops: PobEditOp[]) {
    if (!Array.isArray(ops) || !ops.length || ops.length > 200) throw new Error('Nothing to change')
    if (!this.viewingOwn()) throw new Error("You can only edit your own builds (switch Player back to yourself)")
    await this.ensureBuild()
    const buildPath = await this.resolveActiveBuild()
    // missing spec / skill set = the loadout picked in Orbhoarder
    const current = (await this.call('loadouts')).loadouts as PobLoadouts
    const active = (current as unknown as { active?: { spec?: number, itemSet?: number, skillSet?: number } }).active ?? {}
    const filled = ops.map(op => {
      if (op.op === 'node') return { ...op, spec: op.spec ?? active.spec }
      if (op.op === 'gem' || op.op === 'group') return { ...op, skillSet: op.skillSet ?? active.skillSet }
      if (op.op === 'newLoadout') return { ...op, spec: op.spec ?? active.spec, itemSet: op.itemSet ?? active.itemSet, skillSet: op.skillSet ?? active.skillSet }
      return op
    })
    const reply = await this.call('edit', { path: buildPath, ops: filled }, LOAD_TIMEOUT)
    const xml = reply.xml
    if (typeof xml !== 'string' || !xml.includes('<PathOfBuilding')) throw new Error("Path of Building didn't return the build")
    // backup of the file as it was (one per build, replaced on each edit)
    const rel = path.relative(this.ownDir(), buildPath)
    const backup = path.join(path.dirname(path.resolve(this.cfg!.buildsDir)), 'Build backups', this.cfg?.player || '', rel)
    await fs.mkdir(path.dirname(backup), { recursive: true })
    await fs.copyFile(buildPath, backup)
    // same line endings PoB writes on Windows
    const tmp = buildPath + '.lg-edit'
    await fs.writeFile(tmp, xml.replace(/\r?\n/g, '\r\n'), 'utf8')
    await fs.rename(tmp, buildPath)
    this.logger.write(`info [PoB] edited ${rel}: ${ops.map(o => o.op).join(', ')}`)
    this.loadedKey = null
    this.onPlayerFilesChanged()
    return await this.builds()
  }

  // Deathloom fork: rename / move / duplicate / delete one of your builds
  async manageBuild (req: BuildFileOp): Promise<{ path: string | null, list: PobBuildList }> {
    if (!this.viewingOwn()) throw new Error("You can only change builds in your own folder (switch Player back to yourself)")
    const root = this.ownDir()
    const before = await this.listBuilds()
    const wasActive = before.active != null && before.active.toLowerCase() === path.normalize(req.path).toLowerCase()
    const deletedRoot = path.join(path.dirname(path.resolve(this.cfg!.buildsDir)), 'Deleted builds', this.cfg?.player || '')
    const result = await applyBuildOp(root, deletedRoot, req)
    this.logger.write(`info [PoB] build ${req.op}: ${req.path}${result ? ` -> ${result}` : ''}`)
    if (wasActive && result && req.op !== 'duplicate') {
      await this.writeActive(root, result)
    }
    // auto sync pushes the change (a delete is deleted on GitHub too)
    this.onPlayerFilesChanged()
    const list = await this.listBuilds()
    return { path: result, list }
  }

  // Write active.txt: keeps comment lines, replaces the build line
  private async writeActive (root: string, rel: string) {
    const activeFile = this.activeFile(root)
    await fs.mkdir(path.dirname(activeFile), { recursive: true })
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

  async setActiveBuild (rel: string, remember = true) {
    const root = this.playerDir()
    const list = await this.listBuilds()
    if (!list.builds.includes(rel)) throw new Error(`Build not found in your folder: ${rel}`)
    await this.writeActive(root, rel)
    if (!this.viewingOwn()) return
    this.onPlayerFilesChanged()
    if (remember && this.activeCharacter) {
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
    if (!LIVE_CHARACTER_DATA) {
      liveError = LIVE_CHARACTER_OFF
    } else if (!this.liveTarget()) {
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

  // Levelling planner (desktop window "Next" tab). Level and quest points come
  // from the window (Client.txt + campaign guide); no character data is fetched.
  async plan (level: unknown, questPoints: unknown): Promise<Record<string, unknown>> {
    const num = (v: unknown, min: number, max: number) => {
      const n = Math.floor(Number(v))
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
    }
    await this.ensureBuild()
    const reply = await this.call('plan', { level: num(level, 1, 100), questPoints: num(questPoints, 0, 30) })
    // PoB's JSON encoder writes empty lists as {}
    const list = (v: unknown) => Array.isArray(v) ? v : []
    const plan: PobPlan = {
      level: reply.level,
      questPoints: reply.questPoints,
      available: reply.available,
      phases: list(reply.phases),
      phase: reply.phase,
      className: reply.className,
      ascendancyClass: reply.ascendancyClass,
      kept: reply.kept,
      keptIds: list(reply.keptIds),
      taken: reply.taken,
      order: list(reply.order),
      refund: list(reply.refund),
      ascendancy: list(reply.ascendancy),
      skillSet: reply.skillSet,
      gems: list(reply.gems),
      previousGems: reply.previousGems ? list(reply.previousGems) : undefined,
      nextGems: reply.nextGems ? list(reply.nextGems) : undefined,
      nextSkillSet: reply.nextSkillSet,
      bandit: typeof reply.bandit === 'string' ? reply.bandit : undefined
    }
    return { build: reply.build as PobBuildInfo, plan }
  }

  // Deathloom fork: timeless jewel explorer (Craft tab). PoB works it out on a
  // scratch tree; the active build is only read (which passives it allocates).
  async timeless (req: { sockets?: boolean, jewel?: string, conqueror?: string, seed?: number, socket?: number, find?: string, wants?: unknown }): Promise<Record<string, unknown>> {
    await this.ensureBuild()
    const params: Record<string, unknown> = {}
    if (req.sockets === true) params.sockets = true
    const find = req.find === 'options' || req.find === 'search' ? req.find : undefined
    if (typeof req.jewel === 'string') {
      params.jewel = req.jewel.slice(0, 40)
      params.socket = Number(req.socket)
      if (find) {
        params.find = find
        if (find === 'search') params.wants = timelessWants(req.wants)
      } else {
        params.conqueror = String(req.conqueror ?? '').slice(0, 40)
        params.seed = Number(req.seed)
      }
    }
    // a seed search reads every seed of the jewel (up to ~8000), give it longer
    const reply = await this.call('timeless', params, find ? 120_000 : undefined)
    const list = (v: unknown): any[] => Array.isArray(v) ? v : []
    return {
      canFind: pobSupports(this.caps, 'timeless.find'),
      jewels: list(reply.jewels).map((j: any) => ({ ...j, conquerors: list(j.conquerors) })),
      sockets: reply.sockets ? list(reply.sockets).map((s: any) => ({ ...s, notables: list(s.notables) })) : undefined,
      result: reply.result
        ? {
            ...reply.result,
            nodes: list(reply.result.nodes).map((n: any) => ({ ...n, stats: list(n.stats), before: list(n.before) }))
          }
        : undefined,
      options: reply.options
        ? {
            ...reply.options,
            nodes: list(reply.options.nodes).map((n: any) => ({ ...n, options: list(n.options) })),
            labels: list(reply.options.labels)
          }
        : undefined,
      search: reply.search
        ? {
            ...reply.search,
            seeds: list(reply.search.seeds).map((s: any) => ({ ...s, hits: list(s.hits) }))
          }
        : undefined
    }
  }

  // Deathloom fork: crafting simulator (Craft tab): bases, or the mod pool of one
  async craft (req: { base?: string, ilvl?: number, influences?: string[] }): Promise<Record<string, unknown>> {
    const list = (v: unknown): any[] => Array.isArray(v) ? v : []
    if (typeof req.base !== 'string' || !req.base) {
      const reply = await this.call('craftBases')
      return { bases: list(reply.bases) }
    }
    const reply = await this.call('craftMods', {
      base: req.base.slice(0, 80),
      ilvl: Number(req.ilvl) || 84,
      influences: list(req.influences).filter((i): i is string => typeof i === 'string').slice(0, 2)
    })
    return {
      pool: {
        base: reply.base,
        type: reply.type,
        ilvl: reply.ilvl,
        influences: list(reply.influences),
        maxAffixes: reply.maxAffixes,
        mods: list(reply.mods).map((m: any) => ({ ...m, text: list(m.text), tags: list(m.tags) })),
        essences: list(reply.essences).map((e: any) => ({ ...e, text: list(e.text) }))
      }
    }
  }

  // Tree map (desktop window): whole tree layout (only when the window lacks this
  // version) + allocated node ids of the build's loadout and the character
  async treeMap (refreshGear: boolean, haveVersion?: string): Promise<Record<string, unknown>> {
    await this.ensureBuild()
    let liveError: string | undefined
    if (!LIVE_CHARACTER_DATA) {
      liveError = LIVE_CHARACTER_OFF
    } else if (!this.liveTarget()) {
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
    if (!LIVE_CHARACTER_DATA) {
      liveError = LIVE_CHARACTER_OFF
    } else if (!this.liveTarget()) {
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

  // Deathloom fork (19 Nov 2026): "vs character" from your character's file. Path of Building's
  // own Import character filled it (the player clicked it); Orbhoarder only reads the saved
  // file, so no GGG character pages are called. Sent again when the file or the build changes.
  private fileGearKey = ''
  private fileGearInfo: { name: string, mtime: number } | null = null
  private async syncFileGear (my?: { name: string, file?: string }): Promise<{ error?: string }> {
    const clear = async () => {
      if (this.fileGearKey) {
        await this.call('clearEquipped')
        this.pobHasGear = false
        this.fileGearKey = ''
        this.fileGearInfo = null
      }
    }
    const setUp = 'To compare with your character, set up your character file once: Build panel → Gems → Equipped from: my character.'
    if (!my || typeof my.name !== 'string' || !my.name) { await clear(); return { error: setUp } }
    const root = path.resolve(this.playerDir())
    const inRoot = (rel: unknown) => {
      if (typeof rel !== 'string' || !rel.toLowerCase().endsWith('.xml')) return null
      const full = path.resolve(root, rel)
      return full.startsWith(root + path.sep) ? full : null
    }
    const safe = my.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').trim()
    let file: string | null = null
    let mtime = 0
    for (const cand of [inRoot(my.file), inRoot(path.join('My characters', `${safe}.xml`))]) {
      if (!cand) continue
      const st = await fs.stat(cand).catch(() => null)
      if (st?.isFile()) { file = cand; mtime = st.mtimeMs; break }
    }
    if (!file) { await clear(); return { error: setUp } }
    const key = `${file}|${mtime}`
    if (key !== this.fileGearKey) {
      try {
        await this.call('equipped', { file, name: my.name })
      } catch (err) {
        this.fileGearKey = ''
        this.fileGearInfo = null
        this.pobHasGear = false
        const msg = (err as Error).message.replace(/^.*ImpactServer\.lua:\d+: /, '')
        // PoB from before the fork's character-file support (#42): its update waits until the PoB window is closed
        if (/equipped needs 'items'|older than this feature/.test(msg)) {
          return { error: 'Path of Building needs an update for "vs character". Close the Path of Building window: Orbhoarder updates it within a minute, then price check again.' }
        }
        return { error: msg }
      }
      this.fileGearKey = key
      this.fileGearInfo = { name: my.name, mtime }
      this.pobHasGear = true
    }
    return {}
  }

  async impact (itemText: string, refreshGear = false, myCharacter?: { name: string, file?: string }): Promise<{ build: PobBuildInfo, result: PobImpactResult }> {
    await this.ensureBuild()
    // live gear from GGG's pages is off (LIVE_CHARACTER_DATA): use your character file
    const live = this.liveTarget() ? await this.syncLiveGear(refreshGear) : await this.syncFileGear(myCharacter)
    const reply = await this.call('impact', { item: itemText })
    const result: PobImpactResult = { item: reply.item, compares: reply.compares, lines: reply.lines }
    if (reply.equipped) {
      const info = reply.equipped.info as PobEquippedInfo | undefined
      if (info) {
        info.fetchedAt = this.fileGearKey ? this.fileGearInfo?.mtime : this.sentGearAt
        info.passivesError = this.fileGearKey ? undefined : this.passivesError
        if (this.fileGearKey) info.fromFile = true
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

// Deathloom fork: wanted outcomes for the timeless seed search, from the
// renderer. Kept small and typed before they reach PoB.
function timelessWants (v: unknown): Array<{ label: string, node?: number, min?: number }> {
  if (!Array.isArray(v)) return []
  const out: Array<{ label: string, node?: number, min?: number }> = []
  for (const w of v.slice(0, 10)) {
    if (!w || typeof w !== 'object') continue
    const label = (w as any).label
    if (typeof label !== 'string' || !label.trim()) continue
    const want: { label: string, node?: number, min?: number } = { label: label.slice(0, 300) }
    const node = Number((w as any).node)
    if (Number.isInteger(node) && node > 0) want.node = node
    const min = Number((w as any).min)
    if (Number.isInteger(min) && min > 1) want.min = Math.min(min, 20)
    out.push(want)
  }
  return out
}
