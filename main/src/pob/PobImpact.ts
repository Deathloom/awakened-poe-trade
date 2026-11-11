// Deathloom fork: runs Path of Building headless (src/ImpactServer.lua) and
// answers "what does this item do to my active build?" for the overlay.
//
// PoB runs as one long-lived child process. The active build is read from
// <buildsDir>/<player>/active.txt and reloaded whenever that file or the build
// file changes, so pulling builds in PoB is picked up automatically.

import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { PobConfig, PobBuildInfo, PobImpactResult } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'

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

  constructor (
    private server: ServerEvents,
    private logger: Logger
  ) {
    this.server.onEventAnyClient('CLIENT->MAIN::pob-impact', ({ requestId, itemText }) => {
      this.queue = this.queue
        .then(async () => await this.impact(itemText))
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
  }

  configure (cfg: PobConfig | undefined) {
    this.logger.write(`info [PoB] settings: ${JSON.stringify(cfg ?? null)}`)
    const same = JSON.stringify(cfg) === JSON.stringify(this.cfg)
    this.cfg = cfg
    if (!same || !cfg?.enabled) {
      this.stop()
    }
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

  async impact (itemText: string): Promise<{ build: PobBuildInfo, result: PobImpactResult }> {
    if (!this.cfg?.enabled) throw new Error('Build impact is turned off')
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
    if (key !== this.loadedKey || !this.loadedBuild) {
      const reply = await this.call('load', { path: buildPath })
      this.loadedKey = key
      this.loadedBuild = reply.build as PobBuildInfo
      this.logger.write(`info [PoB] loaded build "${this.loadedBuild.name}"`)
    }
    const reply = await this.call('impact', { item: itemText })
    return {
      build: this.loadedBuild,
      result: { item: reply.item, compares: reply.compares, lines: reply.lines }
    }
  }
}
