// Deathloom fork: keeps Loot Goblin's own Path of Building in
// %LOCALAPPDATA%\Loot Goblin\PathOfBuilding (see PobDownload.ts).
// - First run: downloads it (progress in the setup guide, a notification for
//   people who already finished the guide).
// - Existing installs: the installer moves the old resources\PathOfBuilding
//   there (build/installer.nsh); then only changed files download.
// - Each app start, while the PoB window is closed: one manifest check against
//   master, so the overlay's headless PoB stays current even for people who
//   never open PoB (the PoB window updates itself with its own updater).

import { app, net, Notification } from 'electron'
import { execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import type { PobInstallState } from '../../../ipc/types'
import type { ServerEvents } from '../server'
import type { Logger } from '../RemoteLogger'
import { syncPob, isInstalled, readLocalManifest, type FetchFn } from './PobDownload'
import { managedPobDir, legacyPobDir } from './defaults'

export class PobInstaller {
  state: PobInstallState
  private running: Promise<void> | null = null
  // stop the overlay's PoB processes before files are replaced
  beforeReplace: () => Promise<void> | void = () => {}
  // PoB became usable or changed (refresh defaults, restart headless PoB)
  onChanged: () => void = () => {}

  constructor (
    private server: ServerEvents,
    private logger: Logger
  ) {
    const dir = managedPobDir()
    this.state = {
      state: isInstalled(dir) ? 'ready' : 'missing',
      dir,
      version: readLocalManifest(dir)?.version,
      done: 0,
      total: 0,
      bytes: 0
    }
    this.server.onEventAnyClient('CLIENT->MAIN::pob-install', ({ op }) => {
      if (op === 'start') void this.ensure(true)
      else if (op === 'repair') void this.ensure(true, true)
      this.publish()
    })
  }

  get installed () { return isInstalled(this.state.dir) }

  private publish (patch: Partial<PobInstallState> = {}) {
    this.state = { ...this.state, ...patch }
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::pob-install-state',
      payload: this.state
    })
  }

  // Short text for errors elsewhere ("Path of Building is still downloading (40%)")
  statusText (): string | null {
    const s = this.state
    if (s.state === 'ready' || s.state === 'updating' || s.state === 'checking') return this.installed ? null : 'Path of Building is being prepared…'
    if (s.state === 'installing') {
      return `Path of Building is still downloading${s.total ? ` (${Math.floor(100 * s.done / s.total)}%)` : ''}. It's needed once; try again in a moment.`
    }
    if (s.state === 'error') return `Path of Building couldn't be downloaded: ${s.error ?? 'unknown error'}. Retry in the setup guide (wand button on the top bar).`
    return 'Path of Building isn\'t downloaded yet. Open the setup guide (wand button on the top bar) to get it.'
  }

  // Install if missing, else update when the PoB window is closed.
  // userAsked: from the setup guide (always runs, shows errors); repair: hash every file.
  ensure (userAsked = false, repair = false): Promise<void> {
    if (this.running) return this.running
    this.running = this.run(userAsked, repair).finally(() => { this.running = null })
    return this.running
  }

  private async run (userAsked: boolean, repair: boolean) {
    const dir = this.state.dir
    const fresh = !isInstalled(dir)
    if (!fresh && !repair && await isPobWindowRunning()) {
      this.logger.write('info [PoB install] PoB window open; it updates itself')
      return
    }
    // A copy left inside the install folder (older Loot Goblin, or the installer couldn't move it)
    if (fresh && !fs.existsSync(path.join(dir, 'src'))) {
      const legacy = legacyPobDir()
      if (legacy) {
        try {
          this.publish({ state: 'installing', message: 'Moving Path of Building out of the install folder…', error: undefined })
          await fs.promises.mkdir(path.dirname(dir), { recursive: true })
          await fs.promises.cp(legacy, dir, { recursive: true })
          this.logger.write(`info [PoB install] copied ${legacy} -> ${dir}`)
        } catch (err) {
          this.logger.write(`warn [PoB install] copy from ${legacy} failed: ${(err as Error).message}`)
        }
      }
    }
    const notifyStart = fresh && !userAsked
    const hadCopy = fs.existsSync(path.join(dir, 'src', 'ImpactServer.lua'))
    const startedAt = Date.now()
    this.publish({ state: fresh ? 'installing' : 'checking', error: undefined, message: undefined, done: 0, total: 0, bytes: 0 })
    if (notifyStart) {
      notify('Getting Path of Building', hadCopy
        ? 'Loot Goblin is checking its Path of Building and getting the newest files.'
        : 'Loot Goblin is downloading Path of Building (once, a few hundred MB). The PoB parts of the overlay work when it\'s done.')
    }
    try {
      await fs.promises.mkdir(dir, { recursive: true })
      const res = await syncPob(dir, {
        fetch: net.fetch as unknown as FetchFn,
        full: fresh || repair,
        onProgress: (p) => {
          const state = fresh ? 'installing' : (p.phase === 'checking' ? 'checking' : 'updating')
          this.publish({
            state,
            done: p.done,
            total: p.total,
            bytes: p.bytes,
            message: p.phase === 'checking'
              ? (fresh ? 'Checking which files are needed…' : 'Checking for a Path of Building update…')
              : p.phase === 'finishing' ? 'Finishing…' : undefined
          })
        },
        beforeReplace: async () => { await this.beforeReplace() }
      })
      this.logger.write(`info [PoB install] ${res.changed ? `PoB ${res.version}: ${res.downloaded} files (${Math.round(res.bytes / 1048576)} MB), ${res.removed} removed, ${Math.round((Date.now() - startedAt) / 1000)} s` : `PoB ${res.version} up to date`}`)
      this.publish({ state: 'ready', version: res.version, message: undefined, error: undefined })
      if (res.changed) this.onChanged()
      if (fresh && !userAsked) notify('Path of Building is ready', 'Build impact, the build panel and build sharing work now.')
    } catch (err) {
      const msg = (err as Error).message
      this.logger.write(`error [PoB install] ${msg}`)
      if (isInstalled(dir)) {
        // update failed: the old copy still works; try again next start
        this.publish({ state: 'ready', message: undefined, error: undefined })
      } else {
        this.publish({ state: 'error', error: msg, message: undefined })
      }
    }
  }
}

function notify (title: string, body: string) {
  try {
    if (Notification.isSupported()) new Notification({ title, body }).show()
  } catch {}
}

// PoB window running: it updates itself, and Windows keeps its dlls locked
function isPobWindowRunning (): Promise<boolean> {
  if (process.platform !== 'win32') return Promise.resolve(false)
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq Path*', '/FO', 'CSV', '/NH'],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        if (err) { resolve(true); return }
        resolve(/path(\{space\}| )of(\{space\}| )building/i.test(stdout))
      })
  })
}

export function shouldAutoInstall () {
  return app.isPackaged || process.env.APT_POB_INSTALL === '1'
}
