// Deathloom fork: build sync from Loot Goblin.
//
// Runs Path of Building's src\SyncServer.lua (headless, PoB itself isn't
// loaded) for each sync job: sign in with GitHub (device flow), Pull, Push,
// Sync now, player folder and auto sync. It uses PoB's own BuildSync.json and
// the Windows Credential Manager sign-in, so the PoB window and Loot Goblin
// share one sign-in and one sync state.
//
// Auto sync (PoB's "Sync automatically" setting): a quiet Pull when Loot Goblin
// starts, and a quiet Push a few seconds after Loot Goblin changes a file in
// the player folder (import, active build).

import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { app, clipboard, shell } from 'electron'
import type { PobSyncState, PobSyncStatus, IpcEventPayload } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import type { PobImpact } from './PobImpact'
import { openWebLink } from '../safe-open'

const REPLY_PREFIX = '@pob '
const START_TIMEOUT = 30_000
const SHORT_TIMEOUT = 60_000
// a first Pull of many builds is one request per file
const LONG_TIMEOUT = 15 * 60_000
const AUTO_PUSH_DELAY = 8_000

type SyncOp = IpcEventPayload<'CLIENT->MAIN::pob-sync'>

interface Device {
  code: string
  interval: number
  expiresAt: number
  timer: NodeJS.Timeout | null
}

export class PobSync {
  private state: PobSyncState = { busy: null, status: null, signIn: null, last: null }
  // one SyncServer job at a time
  private queue: Promise<unknown> = Promise.resolve()
  private device: Device | null = null
  private pushTimer: NodeJS.Timeout | null = null
  private startupDone = false
  private lastPobDir = ''

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private impact: PobImpact
  ) {
    this.server.onEventAnyClient('CLIENT->MAIN::pob-sync', (req) => {
      void this.handle(req)
    })
  }

  private publish (patch: Partial<PobSyncState> = {}) {
    this.state = { ...this.state, ...patch }
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::pob-sync-state',
      payload: this.state
    })
  }

  // Settings arrived or changed: read the sync status; once per app start, Pull
  configure () {
    const pobDir = this.pobDir()
    if (pobDir === this.lastPobDir && this.state.status) return
    this.lastPobDir = pobDir
    void this.enqueue(async () => {
      await this.refreshStatus()
      const st = this.state.status
      if (!this.startupDone && st) {
        this.startupDone = true
        if (st.signedIn && st.prefs.autoSync) {
          await this.runSync('pull', true)
        }
      }
    })
  }

  // Loot Goblin changed a file in the player folder: Push it soon (auto sync)
  schedulePush () {
    const st = this.state.status
    if (!st?.signedIn || !st.prefs.autoSync || !st.settings.player) return
    if (this.pushTimer) clearTimeout(this.pushTimer)
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null
      void this.enqueue(async () => { await this.runSync('push', true) })
    }, AUTO_PUSH_DELAY)
  }

  private pobDir () {
    return this.impact.resolved()?.pobDir ?? this.impact.pobDir()
  }

  private enqueue (work: () => Promise<void>) {
    const next = this.queue.then(work).catch((err: Error) => {
      this.logger.write(`error [PoB sync] ${err.message}`)
      this.publish({ busy: null, error: err.message })
    })
    this.queue = next
    return next
  }

  private async handle (req: SyncOp) {
    switch (req.op) {
      case 'status':
        // answer at once with what we have, then refresh
        this.publish()
        await this.enqueue(async () => { await this.refreshStatus() })
        return
      case 'signIn':
        await this.enqueue(async () => { await this.startSignIn() })
        return
      case 'cancelSignIn':
        this.stopDevice()
        this.publish({ signIn: null, busy: null })
        return
      case 'signOut':
        this.stopDevice()
        await this.enqueue(async () => {
          const [reply] = await this.run([{ cmd: 'signOut' }])
          this.setStatus(reply)
          this.publish({ notice: undefined })
        })
        return
      case 'configure':
        await this.enqueue(async () => {
          const repoPrefix = req.repoPrefix === undefined ? undefined
            : (req.repoPrefix === '' || req.repoPrefix === 'builds-') ? req.repoPrefix : undefined
          const [reply] = await this.run([{ cmd: 'configure', player: req.player, autoSync: req.autoSync, repoPrefix }])
          this.setStatus(reply)
          this.impact.refreshDefaults()
          this.publish({ error: undefined })
        })
        return
      case 'pull':
      case 'push':
      case 'syncNow':
        await this.enqueue(async () => { await this.runSync(req.op as 'pull' | 'push' | 'syncNow', false) })
    }
  }

  private async refreshStatus () {
    try {
      const [reply] = await this.run([{ cmd: 'status' }])
      this.setStatus(reply)
      this.publish({ error: undefined })
    } catch (err) {
      this.publish({ status: null, error: (err as Error).message })
    }
  }

  private setStatus (reply: any) {
    const status: PobSyncStatus = {
      credAvailable: reply.credAvailable === true,
      signedIn: reply.signedIn === true,
      login: reply.login ?? undefined,
      usingToken: reply.usingToken === true,
      settings: reply.settings,
      prefs: reply.prefs,
      buildPath: String(reply.buildPath ?? '')
    }
    this.publish({ status, mismatch: this.mismatch(status) })
  }

  // Loot Goblin's builds folder / player vs. what PoB syncs
  private mismatch (st: PobSyncStatus): string | undefined {
    const cfg = this.impact.resolved()
    if (!cfg?.buildsDir || !st.buildPath) return undefined
    const norm = (p: string) => {
      const out = path.resolve(p).replace(/[\\/]+$/, '')
      return process.platform === 'win32' ? out.toLowerCase() : out
    }
    if (norm(cfg.buildsDir) !== norm(st.buildPath)) {
      return `Loot Goblin reads builds from ${cfg.buildsDir}, but Path of Building syncs ${st.buildPath}. ` +
        'Clear the Builds folder in Settings → Path of Building to use PoB\'s.'
    }
    if (st.settings.player && cfg.player && cfg.player !== st.settings.player) {
      return `Loot Goblin uses the player folder "${cfg.player}", but sync uploads "${st.settings.player}". ` +
        'Clear the Player field in Settings → Path of Building, or change the player folder here.'
    }
    return undefined
  }

  private async runSync (op: 'pull' | 'push' | 'syncNow', auto: boolean) {
    const title = op === 'pull' ? 'Pull' : op === 'push' ? 'Push' : 'Sync now'
    this.publish({ busy: op === 'push' ? 'Pushing…' : 'Pulling…' })
    try {
      const [reply] = await this.run([{ cmd: op }], (text) => { this.publish({ busy: text }) })
      this.setStatus(reply)
      const lines = Array.isArray(reply.lines) ? reply.lines.map(String) : []
      const success = reply.success === true
      this.logger.write(`${success ? 'info' : 'warn'} [PoB sync] ${title}${auto ? ' (auto)' : ''}: ${lines.join(' / ')}`)
      this.publish({ busy: null, error: undefined, last: { time: Date.now(), title, success, auto, lines } })
    } catch (err) {
      this.publish({ busy: null, last: { time: Date.now(), title, success: false, auto, lines: [(err as Error).message] } })
    }
  }

  // Problem report (ErrorReporter): only when signed in; runs after any sync job
  async report (r: { key: string, title: string, body: string, seen: string }): Promise<{ sent: boolean, reason?: string }> {
    if (!this.state.status?.signedIn) return { sent: false, reason: 'not signed in to GitHub' }
    let out: { sent: boolean, reason?: string } = { sent: false, reason: 'not run' }
    await this.enqueue(async () => {
      const [reply] = await this.run([{ cmd: 'report', ...r }])
      out = { sent: reply.sent === true, reason: reply.reason ? String(reply.reason) : undefined }
    })
    return out
  }

  // Lua errors from SyncServer (code bugs, not "not signed in" messages)
  onCodeError: (message: string) => void = () => {}

  // ---- Sign in with GitHub (device flow) --------------------------------
  private async startSignIn () {
    this.stopDevice()
    this.publish({ busy: 'Contacting GitHub…', notice: undefined })
    const [reply] = await this.run([{ cmd: 'signInStart' }])
    const expiresAt = Date.now() + Number(reply.expiresIn ?? 900) * 1000
    this.device = { code: reply.deviceCode, interval: Number(reply.interval ?? 5), expiresAt, timer: null }
    this.publish({
      busy: null,
      signIn: { userCode: reply.userCode, verificationUri: reply.verificationUri, expiresAt }
    })
    // like PoB: the code is on the clipboard and GitHub opens in the browser
    await clipboard.writeText(String(reply.userCode)).catch(() => { /* code is shown in the panel too */ })
    openWebLink(String(reply.verificationUri), 'github.com')
    this.schedulePoll()
  }

  private schedulePoll () {
    const d = this.device
    if (!d) return
    d.timer = setTimeout(() => {
      d.timer = null
      void this.enqueue(async () => { await this.poll(d) })
    }, d.interval * 1000)
  }

  private async poll (d: Device) {
    if (this.device !== d) return
    if (Date.now() >= d.expiresAt) {
      this.stopDevice()
      this.publish({ signIn: null, notice: 'The sign-in code expired before it was approved. Start the sign-in again.' })
      return
    }
    let reply
    try {
      [reply] = await this.run([{ cmd: 'signInPoll', deviceCode: d.code }])
    } catch (err) {
      // network trouble: keep trying until the code expires
      this.logger.write(`warn [PoB sync] sign-in poll: ${(err as Error).message}`)
      if (this.device === d) this.schedulePoll()
      return
    }
    if (this.device !== d) return
    if (reply.state === 'pending') {
      this.schedulePoll()
    } else if (reply.state === 'slow_down') {
      d.interval = Number(reply.interval) || d.interval + 5
      this.schedulePoll()
    } else if (reply.state === 'done') {
      this.stopDevice()
      this.logger.write(`info [PoB sync] signed in as ${String(reply.login)}`)
      this.publish({ signIn: null, notice: reply.hint ? String(reply.hint) : undefined })
      await this.refreshStatus()
      this.impact.refreshDefaults()
      if (this.state.status?.prefs.autoSync && !reply.hint) {
        await this.runSync('pull', false)
      }
    } else {
      this.stopDevice()
      this.publish({ signIn: null, notice: `Sign-in failed: ${String(reply.error ?? 'unknown error')}` })
    }
  }

  private stopDevice () {
    if (this.device?.timer) clearTimeout(this.device.timer)
    this.device = null
  }

  // ---- SyncServer.lua process --------------------------------------------
  // Runs the commands one after another in one SyncServer process and returns the replies
  private async run (commands: Array<Record<string, unknown>>, onProgress?: (text: string) => void): Promise<any[]> {
    const pobDir = this.pobDir()
    if (!pobDir) {
      throw new Error(this.impact.installStatus() ?? 'No Path of Building folder (Settings → Path of Building).')
    }
    const srcDir = path.join(pobDir, 'src')
    const exe = path.join(pobDir, 'runtime', 'PoBHeadless.exe')
    if (!fs.existsSync(path.join(srcDir, 'SyncServer.lua'))) {
      throw new Error(`This Path of Building has no build sync for Loot Goblin yet (${path.join(srcDir, 'SyncServer.lua')} missing). Update it, or clear the PoB folder setting to use the bundled one.`)
    }
    // For testing on Linux: APT_POB_LAUNCHER="wine" runs the exe through Wine
    const launcher = process.env.APT_POB_LAUNCHER
    const args = ['SyncServer.lua', '--documents', app.getPath('documents')]
    if (process.env.APT_POB_SYNC_TEST_BASE) args.push('--test-base', process.env.APT_POB_SYNC_TEST_BASE)
    const cmd = launcher ?? exe
    const proc = spawn(cmd, launcher ? [exe, ...args] : args, { cwd: srcDir, windowsHide: true })

    return await new Promise<any[]>((resolve, reject) => {
      const replies: any[] = []
      const stderrTail: string[] = []
      let buf = ''
      let next = 0
      let timer: NodeJS.Timeout | null = null
      let done = false
      let c: Record<string, unknown> = {}
      const finish = (err?: Error) => {
        if (done) return
        done = true
        if (timer) clearTimeout(timer)
        if (err) {
          proc.kill()
          reject(err)
        } else {
          proc.stdin.end(JSON.stringify({ id: next + 1, cmd: 'quit' }) + '\n')
          resolve(replies)
        }
      }
      const arm = (ms: number, what: string) => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => { finish(new Error(`Path of Building sync did not answer '${what}' in time`)) }, ms)
      }
      const sendNext = () => {
        if (next >= commands.length) {
          finish()
          return
        }
        c = commands[next++]
        const long = ['pull', 'push', 'syncNow'].includes(String(c.cmd))
        arm(long ? LONG_TIMEOUT : SHORT_TIMEOUT, String(c.cmd))
        proc.stdin.write(JSON.stringify({ id: next, ...c }) + '\n')
      }
      arm(START_TIMEOUT, 'start')
      proc.on('error', (err) => {
        finish(new Error(`Can't start Path of Building's sync (${err.message}). Check that runtime\\PoBHeadless.exe exists.`))
      })
      proc.on('exit', (code) => {
        const detail = stderrTail.slice(-3).join(' | ')
        finish(new Error(`Path of Building sync stopped (code ${String(code)})${detail ? ': ' + detail : ''}`))
      })
      proc.stderr.setEncoding('utf8')
      proc.stderr.on('data', (chunk: string) => {
        for (const line of chunk.split(/\r?\n/)) {
          if (line.trim()) {
            stderrTail.push(line.trim())
            if (stderrTail.length > 20) stderrTail.shift()
          }
        }
      })
      proc.stdout.setEncoding('utf8')
      proc.stdout.on('data', (chunk: string) => {
        buf += chunk
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).replace(/\r$/, '')
          buf = buf.slice(nl + 1)
          if (!line.startsWith(REPLY_PREFIX)) continue
          let reply: any
          try {
            reply = JSON.parse(line.slice(REPLY_PREFIX.length))
          } catch {
            continue
          }
          if (reply.event === 'progress') {
            onProgress?.(String(reply.text))
          } else if (reply.id === 0 && reply.ready) {
            sendNext()
          } else if (reply.id === next) {
            if (!reply.ok) {
              const msg = String(reply.error ?? 'Unknown error')
              if (/\.lua:\d+:/.test(msg) && c.cmd !== 'report') this.onCodeError(msg)
              finish(new Error(msg))
              return
            }
            replies.push(reply)
            sendNext()
          }
        }
      })
    })
  }
}
