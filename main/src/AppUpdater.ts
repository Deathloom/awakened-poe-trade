import { app, Notification, powerMonitor } from 'electron'
import { execFile } from 'child_process'
import { autoUpdater } from 'electron-updater'
import type { ServerEvents } from './server'
import type { UpdateInfo } from '../../ipc/types'
import type { Logger } from './RemoteLogger'

export class AppUpdater {
  private _checkedAtStartup = false
  private _info: UpdateInfo = { state: 'initial' }
  // Deathloom fork: install with a visible progress window and start the app again
  private _installing = false
  private _notifiedVersion = ''
  onChange: (info: UpdateInfo) => void = () => {}
  private _idleTimer: NodeJS.Timeout | undefined

  public readonly noAutoUpdatesReason:
    Extract<UpdateInfo, { state: 'update-available' }>['noDownloadReason'] = null

  get info () { return this._info }
  set info (info: UpdateInfo) {
    this._info = info
    this.server.sendEventTo('broadcast', {
      name: 'MAIN->CLIENT::updater-state',
      payload: info
    })
    this.onChange(info)
  }

  // Deathloom fork: install silently and start Loot Goblin again afterwards. The
  // installer is the assisted (oneClick: false) kind, so a non-silent run shows the
  // whole wizard and waits for Next; /S skips the pages and --force-run relaunches.
  installNow = () => {
    if (this._info.state !== 'update-downloaded' || this._installing) return
    this._installing = true
    this.notify('Updating Loot Goblin', `Installing version ${this._info.version}. Loot Goblin starts again by itself in a few seconds.`)
    autoUpdater.quitAndInstall(true, true)
  }

  // Deathloom fork: install a downloaded update by itself as soon as no Path of
  // Exile (1 or 2) process is running. Checks once a minute; only lists processes.
  private installWhenGameClosed () {
    if (process.platform !== 'win32' || this._idleTimer) return
    const tick = async () => {
      if (this._info.state !== 'update-downloaded' || this._installing) {
        clearInterval(this._idleTimer)
        this._idleTimer = undefined
        return
      }
      if (await isGameRunning() === false) {
        clearInterval(this._idleTimer)
        this._idleTimer = undefined
        setTimeout(this.installNow, 3000)
      }
    }
    this._idleTimer = setInterval(() => { void tick() }, 60 * 1000)
    void tick()
  }

  private notify (title: string, body: string, onClick?: () => void) {
    if (!Notification.isSupported()) return
    const n = new Notification({ title, body })
    if (onClick) n.on('click', onClick)
    n.show()
  }

  constructor (
    private server: ServerEvents,
    private logger?: Logger
  ) {
    // Deathloom fork: updater messages go to the app log (problem reports include it)
    if (logger) {
      autoUpdater.logger = {
        info: (m?: unknown) => { logger.write(`info [updater] ${String(m)}`) },
        warn: (m?: unknown) => { logger.write(`warn [updater] ${String(m)}`) },
        error: (m?: unknown) => { logger.write(`error [updater] ${String(m)}`) }
      }
    }
    // Deathloom fork: upstream checked every 16 h, so a release made while the PC sat
    // idle wasn't found until the app restarted. Check every 30 min and when the
    // PC wakes up or is unlocked (one request to GitHub Releases each time).
    setInterval(this.check, 30 * 60 * 1000)
    powerMonitor.on('resume', this.checkSoon)
    powerMonitor.on('unlock-screen', this.checkSoon)

    this.server.onEventAnyClient('CLIENT->MAIN::user-action', ({ action }) => {
      if (action === 'check-for-update') {
        this.check()
      } else if (action === 'update-and-restart') {
        this.installNow()
      }
    })

    // https://www.electron.build/configuration/nsis.html#portable
    autoUpdater.autoDownload = !process.env.PORTABLE_EXECUTABLE_DIR

    if (!autoUpdater.autoDownload || process.platform === 'darwin') {
      this.noAutoUpdatesReason = 'not-supported'
    } else if (process.argv.includes('--no-updates')) {
      autoUpdater.autoDownload = false
      this.noAutoUpdatesReason = 'disabled-by-flag'
    }

    // Deathloom fork: upstream installs silently on quit and doesn't start the app
    // again. We install on quit ourselves, with progress, then relaunch.
    autoUpdater.autoInstallOnAppQuit = false
    if (process.platform === 'win32' && app.isPackaged) {
      // needed for Windows notifications to show under the app's name
      app.setAppUserModelId('com.deathloom.loot-goblin')
    }
    app.on('before-quit', (e) => {
      if (this._info.state === 'update-downloaded' && !this._installing) {
        e.preventDefault()
        this.installNow()
      }
    })

    autoUpdater.on('checking-for-update', () => {
      // Deathloom fork: keep "ready to install" / "downloading" on screen while
      // checking again (the check ends in the same state or a newer version)
      if (this._info.state === 'update-downloaded' || this._info.state === 'update-available') return
      this.info = { state: 'checking-for-update' }
    })
    autoUpdater.on('update-available', (info: { version: string }) => {
      this.info = { state: 'update-available', version: info.version, noDownloadReason: this.noAutoUpdatesReason }
      if (this.noAutoUpdatesReason == null && this._notifiedVersion !== info.version) {
        this.notify('Loot Goblin update', `Downloading version ${info.version} in the background…`)
      }
    })
    autoUpdater.on('update-not-available', () => {
      this.info = { state: 'update-not-available', checkedAt: Date.now() }
    })
    autoUpdater.on('error', () => {
      this.info = { state: 'error', checkedAt: Date.now() }
    })
    autoUpdater.on('update-downloaded', (info: { version: string }) => {
      this.info = { state: 'update-downloaded', version: info.version }
      if (this._notifiedVersion !== info.version) {
        this._notifiedVersion = info.version
        this.notify(`Loot Goblin ${info.version} is ready`,
          'It installs by itself while Path of Exile is closed. Click here to update now.',
          this.installNow)
      }
      this.installWhenGameClosed()
    })
    // on('download-progress') https://github.com/electron-userland/electron-builder/issues/2521
  }

  checkAtStartup () {
    if (!this._checkedAtStartup) {
      this._checkedAtStartup = true
      this.check()
    }
  }

  private _lastCheck = 0
  // after wake-up the network needs a moment; at most one extra check per 5 min
  private checkSoon = () => {
    setTimeout(() => {
      if (Date.now() - this._lastCheck < 5 * 60 * 1000) return
      void this.check()
    }, 20 * 1000)
  }

  // Deathloom fork: a check whose request never answers kept "Checking for
  // updates" on screen for good (and every later check waited on the same
  // request). After 90 s it counts as failed and the next check starts afresh.
  private _checkTimer: NodeJS.Timeout | undefined
  private check = async () => {
    this._lastCheck = Date.now()
    clearTimeout(this._checkTimer)
    this._checkTimer = setTimeout(() => {
      if (this._info.state !== 'checking-for-update') return
      this.logger?.write('warn [updater] Update check got no answer in 90 s; giving up on it')
      ;(autoUpdater as unknown as { checkForUpdatesPromise: unknown }).checkForUpdatesPromise = null
      this.info = { state: 'error', checkedAt: Date.now() }
    }, 90 * 1000)
    try {
      const res = await autoUpdater.checkForUpdates()
      // not packaged (dev): no events at all
      if (res == null && this._info.state === 'checking-for-update') this.info = { state: 'update-not-available', checkedAt: Date.now() }
    } catch {
      // handled by event
    } finally {
      clearTimeout(this._checkTimer)
    }
  }
}

// Deathloom fork: true if any PathOfExile* process runs (PoE1 or PoE2, Steam or
// standalone). null when it can't tell; callers treat that as "running".
function isGameRunning (): Promise<boolean | null> {
  return new Promise((resolve) => {
    execFile('tasklist', ['/FI', 'IMAGENAME eq PathOfExile*', '/FO', 'CSV', '/NH'],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        if (err) { resolve(null); return }
        resolve(/pathofexile/i.test(stdout))
      })
  })
}
