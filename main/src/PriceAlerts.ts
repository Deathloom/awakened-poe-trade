// Deathloom fork (Q6): price alerts. The rules live in main (apt-data/price-alerts.json)
// and are checked whenever the shared poe.ninja price list is downloaded (proxy.ts
// calls onNinjaDownload). Fired alerts go to every connected window, which includes a
// phone paired with the QR link; nothing is sent anywhere else. A Windows notification
// is the fallback when no phone is connected (or always, if the player asks for it).

import * as fs from 'fs'
import * as path from 'path'
import { randomBytes } from 'crypto'
import { app, Notification } from 'electron'
import type { ServerEvents } from './server'
import type { Logger } from './RemoteLogger'
import {
  checkAlerts, ninjaLeague, readAlertState, validateAlertInput, alertText, isDuplicateAlert,
  shouldNotifyPc, cleanAckIds, PHONE_ACK_WAIT_MS,
  type PriceAlertState, type PriceAlertFired
} from '../../ipc/price-alerts'

function file (): string {
  return path.join(app.getPath('userData'), 'apt-data', 'price-alerts.json')
}

export class PriceAlerts {
  private state: PriceAlertState
  // fired alert ids a phone said it got
  private acked = new Set<string>()

  constructor (
    private server: ServerEvents,
    private logger: Logger,
    private phonesConnected: () => number,
    private fromOtherDevice: () => boolean
  ) {
    this.state = this.load()

    this.server.onEventAnyClient('CLIENT->MAIN::price-alerts', (req) => {
      const reply = this.server.replyTo()
      switch (req.op) {
        case 'list':
          reply({ name: 'MAIN->CLIENT::price-alerts', payload: this.state })
          return
        case 'ack':
          // only a phone's word counts (the PC's own windows always get it)
          if (!this.fromOtherDevice()) return
          for (const id of cleanAckIds(req.ids)) this.acked.add(id)
          return
        case 'add': {
          const input = validateAlertInput(req.rule, this.state.rules.length)
          if (typeof input === 'string' || isDuplicateAlert(this.state.rules, input)) {
            reply({ name: 'MAIN->CLIENT::price-alerts', payload: { ...this.state, error: typeof input === 'string' ? input : 'You already have this alert.' } })
            return
          }
          this.state = {
            ...this.state,
            rules: [...this.state.rules, { ...input, id: randomBytes(8).toString('hex'), createdAt: Date.now() }]
          }
          break
        }
        case 'remove':
          if (typeof req.id !== 'string') return
          this.state = { ...this.state, rules: this.state.rules.filter(r => r.id !== req.id) }
          break
        case 'clear-fired':
          this.state = { ...this.state, fired: [] }
          break
        case 'settings':
          this.state = { ...this.state, pcAlways: req.pcAlways === true }
          break
        default:
          return
      }
      this.save()
      this.broadcast()
    })
  }

  // a fresh (not cached) poe.ninja price list arrived; `target` is the path after /proxy/
  onNinjaDownload (target: string, statusCode: number, body: Uint8Array) {
    if (statusCode !== 200 || !this.state.rules.length) return
    const league = ninjaLeague(target)
    if (!league || !this.state.rules.some(r => r.league === league)) return
    try {
      const blob = Buffer.from(body.buffer, body.byteOffset, body.byteLength).toString('utf8')
      const res = checkAlerts(this.state, blob, league, Date.now())
      if (!res.changed) return
      this.state = res.state
      this.save()
      this.broadcast()
      if (res.fired.length) this.announce(res.fired)
    } catch (err) {
      this.logger.write(`error [price-alerts] ${(err as Error).message}`)
    }
  }

  private announce (fired: PriceAlertFired[]) {
    this.server.sendEventTo('broadcast', { name: 'MAIN->CLIENT::price-alert-fired', payload: { fired } })
    const phones = this.phonesConnected()
    this.logger.write(`info [price-alerts] ${fired.length} alert(s) fired; ${phones} phone(s) connected`)
    // a socket can look connected while the phone is locked: notify on the PC
    // unless a phone confirms it got the alert within a few seconds
    const decide = () => {
      const phoneAcked = fired.some(f => this.acked.has(f.id))
      for (const f of fired) this.acked.delete(f.id)
      if (shouldNotifyPc({ pcAlways: this.state.pcAlways, phoneAcked })) this.notifyPc(fired)
    }
    if (phones > 0 && !this.state.pcAlways) setTimeout(decide, PHONE_ACK_WAIT_MS)
    else decide()
  }

  private notifyPc (fired: PriceAlertFired[]) {
    if (!Notification.isSupported()) return
    const body = fired.map(alertText).join('\n')
    new Notification({ title: 'Orbhoarder price alert', body }).show()
  }

  private broadcast () {
    this.server.sendEventTo('broadcast', { name: 'MAIN->CLIENT::price-alerts', payload: this.state })
  }

  private load (): PriceAlertState {
    try {
      return readAlertState(JSON.parse(fs.readFileSync(file(), 'utf8')))
    } catch {
      return readAlertState(null)
    }
  }

  private save () {
    try {
      fs.mkdirSync(path.dirname(file()), { recursive: true })
      fs.writeFileSync(file(), JSON.stringify(this.state), 'utf8')
    } catch (err) {
      this.logger.write(`error [price-alerts] could not save: ${(err as Error).message}`)
    }
  }
}
