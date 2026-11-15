import type { ServerEvents } from './server'

// Deathloom fork: the history is kept for new windows and problem reports; cap it
const MAX_HISTORY = 200_000

export class Logger {
  history = ''

  constructor (
    private server: ServerEvents
  ) {}

  write (message: string) {
    message = `[${new Date().toLocaleTimeString()}] ${message}\n`
    this.history += message
    if (this.history.length > MAX_HISTORY) {
      const cut = this.history.indexOf('\n', this.history.length - MAX_HISTORY * 0.75)
      this.history = this.history.slice(cut + 1)
    }
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::log-entry',
      payload: { message }
    })
  }
}
