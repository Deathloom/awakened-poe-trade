import path from 'path'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import { app, Tray, Menu, shell, nativeImage, dialog } from 'electron'
import type { ServerEvents } from './server'

export class AppTray {
  public overlayKey = 'Shift + Space'
  private tray: Tray
  serverPort = 0
  // Deathloom fork: PoB folder in use (bundled copy or settings), for "Open Path of Building"
  pobDir: () => string = () => ''
  // Deathloom fork: "Restart to update" item once an update is downloaded
  updateReady: string | null = null
  installUpdate: () => void = () => {}

  constructor (server: ServerEvents) {
    let trayImage = nativeImage.createFromPath(
      path.join(
        __dirname,
        process.env.STATIC!,
        process.platform === "win32" ? "icon.ico" : "icon.png"
      )
    )

    if (process.platform === 'darwin') {
      // Mac image size needs to be smaller, or else it looks huge. Size
      // guideline is from https://iconhandbook.co.uk/reference/chart/osx/
      trayImage = trayImage.resize({ width: 22, height: 22 })
    }

    this.tray = new Tray(trayImage)
    this.tray.setToolTip(`Loot Goblin v${app.getVersion()}`)
    this.rebuildMenu()

    server.onEventAnyClient('CLIENT->MAIN::user-action', ({ action }) => {
      if (action === 'quit') {
        app.quit()
      }
    })
  }

  rebuildMenu () {
    const contextMenu = Menu.buildFromTemplate([
      ...(this.updateReady
        ? [{ label: `Restart to update to ${this.updateReady}`, click: () => { this.installUpdate() } },
            { type: 'separator' as const }]
        : []),
      {
        label: 'Settings/League',
        click: () => {
          dialog.showMessageBox({
            title: 'Settings',
            message: `Open Path of Exile and press "${this.overlayKey}". Click on the button with cog icon there.`
          })
        }
      },
      {
        label: 'Open in Browser',
        click: () => {
          shell.openExternal(`http://localhost:${this.serverPort}`)
        }
      },
      {
        label: 'Open Path of Building',
        click: () => { this.openPob() }
      },
      {
        // Deathloom fork: problem reports go to the group's private builds repo
        label: 'Report a problem…',
        click: () => { this.reportProblem() }
      },
      { type: 'separator' },
      {
        label: 'Open config folder',
        click: () => {
          shell.openPath(path.join(app.getPath('userData'), 'apt-data'))
        }
      },
      {
        label: 'Quit',
        click: () => {
          app.quit()
        }
      }
    ])

    this.tray.setContextMenu(contextMenu)
  }

  // Deathloom fork: new issue in POE-Builds/poe-builds with the version filled in
  private reportProblem () {
    const body = [
      `Loot Goblin ${app.getVersion()} · ${process.platform}`,
      '',
      '**What happened?**',
      '',
      '',
      '**What did you expect?**',
      '',
      '',
      '_Log: tray → Open config folder → apt-data (or attach a screenshot)._'
    ].join('\n')
    const url = 'https://github.com/POE-Builds/poe-builds/issues/new?labels=report&body=' + encodeURIComponent(body)
    void shell.openExternal(url)
  }

  // Deathloom fork: starts the PoB window (same as runtime\Path of Building.exe from the PoB folder)
  openPob () {
    const dir = this.pobDir()
    // the git repo (and so the bundled copy) names it "Path{space}of{space}Building.exe";
    // PoB's own installer renames it to "Path of Building.exe"
    const exe = dir && ['Path of Building.exe', 'Path{space}of{space}Building.exe']
      .map(name => path.join(dir, 'runtime', name))
      .find(file => existsSync(file))
    if (!exe) {
      dialog.showMessageBox({
        title: 'Path of Building',
        message: 'Path of Building was not found. Set the Path of Building folder in Settings → Path of Building.'
      })
      return
    }
    try {
      const proc = spawn(exe, [], { cwd: path.dirname(exe), detached: true, stdio: 'ignore' })
      proc.on('error', (err) => {
        dialog.showMessageBox({ title: 'Path of Building', message: `Can't start Path of Building: ${err.message}` })
      })
      proc.unref()
    } catch (err) {
      dialog.showMessageBox({ title: 'Path of Building', message: `Can't start Path of Building: ${(err as Error).message}` })
    }
  }
}
