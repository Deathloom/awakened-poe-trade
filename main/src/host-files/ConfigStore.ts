import type { ServerEvents } from '../server'
import { app } from 'electron'
import fs from 'fs/promises'
import path from 'path'

export class ConfigStore {
  private isTmpFile = false
  // Deathloom fork: when running from source (npm run dev), keep settings in a
  // separate config.dev.json so they survive restarts without touching the
  // installed app's config.json. Upstream skips saving in dev mode entirely.
  private isDev = Boolean(process.env.VITE_DEV_SERVER_URL)
  private releasePath = path.join(app.getPath('userData'), 'apt-data', 'config.json')
  private cfgPath = this.isDev
    ? path.join(app.getPath('userData'), 'apt-data', 'config.dev.json')
    : this.releasePath

  constructor (server: ServerEvents) {
    server.onEventAnyClient('CLIENT->MAIN::save-config', (cfg) => {
      this.save(cfg.contents, cfg.isTemporary)
      server.sendEventTo('broadcast', {
        name: 'MAIN->CLIENT::config-changed',
        payload: { contents: cfg.contents }
      })
    })
  }

  async load (): Promise<string | null> {
    let contents: string | null = null
    try {
      contents = await fs.readFile(this.cfgPath, 'utf8')
    } catch {}
    if (contents == null && this.isDev) {
      // first dev run: start from the installed app's settings, if any
      try {
        contents = await fs.readFile(this.releasePath, 'utf8')
      } catch {}
    }
    if (contents == null && !this.isDev) {
      // Deathloom fork, first run of the installed toolkit: start from the
      // settings used when running from source (or upstream APT's), if any
      const old = path.join(app.getPath('appData'), 'awakened-poe-trade', 'apt-data')
      for (const file of ['config.dev.json', 'config.json']) {
        try {
          contents = await fs.readFile(path.join(old, file), 'utf8')
          break
        } catch {}
      }
    }
    return contents
  }

  private async save (contents: string, tmp: boolean) {
    if (tmp && !this.isTmpFile) {
      this.cfgPath += '.tmp'
      this.isTmpFile = true
    }
    try {
      await fs.mkdir(path.dirname(this.cfgPath), { recursive: true })
      await fs.writeFile(this.cfgPath, contents)
    } catch {
      app.exit(1)
    }
  }
}
