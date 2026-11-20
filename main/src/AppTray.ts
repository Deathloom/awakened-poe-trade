import path from 'path'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { spawn } from 'child_process'
import { issueUrl } from './ErrorReporter'
import { app, Tray, Menu, shell, nativeImage, dialog } from 'electron'
import type { ServerEvents } from './server'

export class AppTray {
  public overlayKey = 'Shift + Space'
  private tray: Tray
  serverPort = 0
  // Deathloom fork: PoB folder in use (bundled copy or settings), for "Open Path of Building"
  pobDir: () => string = () => ''
  // Deathloom fork: why Orbhoarder's PoB can't open yet (still downloading…), null = fine
  pobStatus: (() => string | null) | null = null
  // Deathloom fork: "Restart to update" item once an update is downloaded
  updateReady: string | null = null
  installUpdate: () => void = () => {}
  // Deathloom fork: desktop window (all panels, for a second screen)
  openDesktop: () => void = () => {}
  // Deathloom fork: optional second window (Settings → Path of Building)
  openDesktop2: (() => void) | null = null

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
    this.tray.setToolTip(`Orbhoarder v${app.getVersion()}`)
    if (process.platform === 'win32') this.tray.on('double-click', () => { this.openDesktop() })
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
        label: 'Open Orbhoarder window',
        click: () => { this.openDesktop() }
      },
      ...(this.openDesktop2
        ? [{ label: 'Open second Orbhoarder window', click: () => { this.openDesktop2?.() } }]
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
        click: () => { void this.openPob() }
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
    void shell.openExternal(issueUrl('bug', '', ''))
  }

  // Deathloom fork: starts the PoB window (same as runtime\Path of Building.exe from the PoB folder).
  // With a build file and a PoB fork that knows --orbhoarder-import: opens that build on the
  // Import tab. A running PoB picks it up from runtime\orbhoarder-open.txt (checked once a
  // second); if nobody took it after a moment, PoB isn't running and is started with it.
  async openPob (buildFile?: string) {
    const dir = this.pobDir()
    // the git repo (and so the bundled copy) names it "Path{space}of{space}Building.exe";
    // PoB's own installer renames it to "Path of Building.exe"
    const exe = dir && ['Path of Building.exe', 'Path{space}of{space}Building.exe']
      .map(name => path.join(dir, 'runtime', name))
      .find(file => existsSync(file))
    if (!exe) {
      dialog.showMessageBox({
        title: 'Path of Building',
        message: this.pobStatus?.() ?? 'Path of Building was not found. Set the Path of Building folder in Settings → Path of Building.'
      })
      return
    }
    let args: string[] = []
    if (buildFile && pobOpensImport(dir)) {
      const request = path.join(path.dirname(exe), 'orbhoarder-open.txt')
      try {
        writeFileSync(request, buildFile + '\n', 'utf8')
        await new Promise(resolve => setTimeout(resolve, 2500))
        if (!existsSync(request)) return // a running PoB opened it
        unlinkSync(request)
      } catch {}
      args = ['--orbhoarder-import', buildFile]
    }
    try {
      const proc = spawn(exe, args, { cwd: path.dirname(exe), detached: true, stdio: 'ignore' })
      proc.on('error', (err) => {
        dialog.showMessageBox({ title: 'Path of Building', message: `Can't start Path of Building: ${err.message}` })
      })
      proc.unref()
    } catch (err) {
      dialog.showMessageBox({ title: 'Path of Building', message: `Can't start Path of Building: ${(err as Error).message}` })
    }
  }
}

// Deathloom fork: does this PoB know --orbhoarder-import (PoB fork, Nov 2026 or newer)?
// Older PoBs and PoB Community would treat it as a build link, so they just get opened.
function pobOpensImport (dir: string): boolean {
  try {
    return readFileSync(path.join(dir, 'src', 'Modules', 'Main.lua'), 'utf8').includes('--orbhoarder-import')
  } catch { return false }
}
