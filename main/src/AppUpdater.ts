import { app, Notification } from 'electron'
import { execFile } from 'child_process'
import { autoUpdater } from 'electron-updater'
import type { ServerEvents } from './server'
import type { UpdateInfo } from '../../ipc/types'

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

  // Deathloom fork: show the installer's progress and start Loot Goblin again afterwards
  installNow = () => {
    if (this._info.state !== 'update-downloaded' || this._installing) return
    this._installing = true
    autoUpdater.quitAndInstall(false, true)
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
        this.notify('Updating Loot Goblin', `Installing version ${this._info.version}. Loot Goblin starts again by itself.`)
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
    private server: ServerEvents
  ) {
    setInterval(this.check, 16 * 60 * 60 * 1000)

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

  private check = async () => {
    try {
      await autoUpdater.checkForUpdates()
    } catch {
      // handled by event
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
