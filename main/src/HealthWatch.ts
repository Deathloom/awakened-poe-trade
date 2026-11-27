// Deathloom fork (Q26): crash and slowness watch. PoB start / answer times and
// crashes (from PobImpact) and trade site times (from the price check window) are
// kept for 7 days in apt-data/health-watch.json. Settings → Tools → Speed and crashes shows them with
// fix hints; a crash, a PoB timeout or a very slow answer shows a short notice over
// the game (once per kind per 30 min, can be turned off). Nothing is sent anywhere.

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import type { ServerEvents } from './server'
import type { Logger } from './RemoteLogger'
import {
  addSample, cleanSample, readHealthState, summarize, healthHints, warnNow,
  HEALTH_WARN_GAP_MS, type HealthKind, type HealthSample, type HealthState
} from '../../ipc/health-watch'

function file (): string {
  return path.join(app.getPath('userData'), 'apt-data', 'health-watch.json')
}

const SAVE_DELAY_MS = 10_000

export class HealthWatch {
  private state: HealthState
  private lastWarn = new Map<HealthKind, number>()
  private saveTimer: NodeJS.Timeout | null = null

  constructor (
    private server: ServerEvents,
    private logger: Logger
  ) {
    this.state = this.load()

    this.server.onEventAnyClient('CLIENT->MAIN::health', (req) => {
      const reply = this.server.replyTo()
      switch (req.op) {
        case 'sample': {
          const s = cleanSample(req.sample, Date.now())
          // only the kinds a window measures; PoB times come from main itself
          if (s && (s.k === 'trade-search' || s.k === 'trade-fetch')) this.add(s)
          return
        }
        case 'report':
          reply({ name: 'MAIN->CLIENT::health', payload: this.report() })
          return
        case 'settings':
          if (typeof req.warn === 'boolean') this.state.warn = req.warn
          this.scheduleSave()
          reply({ name: 'MAIN->CLIENT::health', payload: this.report() })
          return
        case 'clear':
          this.state.samples = []
          this.scheduleSave()
          reply({ name: 'MAIN->CLIENT::health', payload: this.report() })
      }
    })

    app.on('before-quit', () => { this.saveNow() })
  }

  // from PobImpact.onHealth
  record (raw: { k: HealthKind, ms: number, ok: boolean, what?: string, timeout?: boolean }) {
    const s = cleanSample(raw, Date.now())
    if (s) this.add(s)
  }

  private add (s: HealthSample) {
    this.state.samples = addSample(this.state.samples, s, s.at)
    this.scheduleSave()
    if (!s.ok || s.k === 'pob-crash') this.logger.write(`warn [health] ${s.k}${s.what ? ` ${s.what}` : ''} ${s.timeout ? 'timed out' : 'failed'} after ${s.ms} ms`)
    const w = warnNow(s)
    if (!w) return
    this.logger.write(`warn [health] ${w.text}`)
    if (!this.state.warn) return
    const last = this.lastWarn.get(s.k) ?? 0
    if (s.at - last < HEALTH_WARN_GAP_MS) return
    this.lastWarn.set(s.k, s.at)
    this.server.sendEventTo('broadcast', { name: 'MAIN->CLIENT::health-warning', payload: { k: s.k, ...w } })
  }

  private report () {
    return {
      warn: this.state.warn,
      summary: summarize(this.state.samples),
      hints: healthHints(this.state.samples),
      recent: this.state.samples.filter(s => !s.ok || s.k === 'pob-crash').slice(-10).reverse()
    }
  }

  private load (): HealthState {
    try {
      return readHealthState(JSON.parse(fs.readFileSync(file(), 'utf8')), Date.now())
    } catch {
      return { samples: [], warn: true }
    }
  }

  private scheduleSave () {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => { this.saveNow() }, SAVE_DELAY_MS)
  }

  private saveNow () {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null }
    try {
      fs.mkdirSync(path.dirname(file()), { recursive: true })
      fs.writeFileSync(file(), JSON.stringify(this.state))
    } catch (e) {
      this.logger.write(`error [health] can't save: ${(e as Error).message}`)
    }
  }
}
