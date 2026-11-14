import { execFile } from 'child_process'
import { promises as fs, watchFile, unwatchFile } from 'fs'
import path from 'path'
import { app } from 'electron'
import { guessFileLocation } from './utils'
import { ServerEvents } from '../server'
import { Logger } from '../RemoteLogger'

const POSSIBLE_PATH =
  (process.platform === 'win32') ? [
    'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile\\logs\\Client.txt',
    'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt'
  ] : (process.platform === 'linux') ? [
    path.join(app.getPath('home'), '.wine/drive_c/Program Files (x86)/Grinding Gear Games/Path of Exile/logs/Client.txt'),
    path.join(app.getPath('home'), '.local/share/Steam/steamapps/common/Path of Exile/logs/Client.txt')
  ] : (process.platform === 'darwin') ? [
    path.join(app.getPath('home'), 'Library/Caches/com.GGG.PathOfExile/Logs/Client.txt')
  ] : []

export class GameLogWatcher {
  private _wantedPath: string | null = null
  // Deathloom fork: main-process listeners (HUD: are we in a zone yet?).
  // Called with the end of the existing log when a file is opened, then with new lines.
  onLines?: (lines: string[], isHistory: boolean) => void
  get actualPath () { return this._state?.path ?? null }
  private _state: {
    offset: number
    path: string
    file: fs.FileHandle
    isReading: boolean
    readBuff: Buffer
  } | null = null

  constructor (
    private server: ServerEvents,
    private logger: Logger,
  ) {}

  async restart (logFile: string) {
    if (this._wantedPath !== logFile) {
      this._wantedPath = logFile
      if (this._state) {
        unwatchFile(this._state.path)
        await this._state.file.close()
        this._state = null
      }
    } else {
      return
    }

    if (!logFile.length) {
      const guessedPath = await guessFileLocation(POSSIBLE_PATH)
      if (guessedPath != null) {
        logFile = guessedPath
      } else {
        // Deathloom fork: found later from the running game (see findFromGameProcess)
        this.logger.write('warn [GameLogWatcher] Client.txt not found in the default folders; will look next to the running game')
        return
      }
    }
    await this.open(logFile)
  }

  // Deathloom fork: no Client.txt path set and none guessed (game installed
  // elsewhere, or both Steam and standalone installed): take it from the
  // running PoE1 process, i.e. <game folder>\logs\Client.txt.
  // Only lists processes; nothing reads the game's memory.
  async findFromGameProcess () {
    if (this._state || this._wantedPath || process.platform !== 'win32') return
    const exe = await findPoe1Exe()
    if (!exe || this._state || this._wantedPath) return
    const logFile = path.join(path.dirname(exe), 'logs', 'Client.txt')
    try {
      await fs.access(logFile)
    } catch {
      this.logger.write(`warn [GameLogWatcher] No log at ${logFile}`)
      return
    }
    await this.open(logFile)
  }

  // Deathloom fork: the whole Client.txt, only the lines Loot Goblin reads
  // (levels, quest rewards, zones, passives, deaths, dialogue): the levelling
  // planner rebuilds every character's progress from them
  async readHistory (): Promise<string[]> {
    if (!this._state) throw new Error('Client.txt not found yet (start the game, or set the path in Settings → General)')
    const KEEP = /\] : |Successfully (un)?allocated|Generating level|LOADING SCREEN|Abnormal disconnect|\] [A-Z][^:#$%&@<>]{1,40}: /
    const text = await fs.readFile(this._state.path, 'utf8')
    return text.split(/\r?\n/).filter(l => KEEP.test(l))
  }

  private async open (logFile: string) {
    try {
      const file = await fs.open(logFile, 'r')
      const stats = await file.stat()
      watchFile(logFile, { interval: 450 }, this.handleFileChange.bind(this))
      this._state = {
        path: logFile,
        file: file,
        offset: stats.size,
        isReading: false,
        readBuff: Buffer.allocUnsafe(64 * 1024),
      }
      this.logger.write(`info [GameLogWatcher] Reading ${logFile}`)
      // Deathloom fork: the last bit of the existing log tells whether we're already in a zone
      if (this.onLines) {
        const tail = Math.min(stats.size, 256 * 1024)
        const buf = Buffer.allocUnsafe(tail)
        const { bytesRead } = await file.read(buf, 0, tail, stats.size - tail)
        const lines = buf.toString('utf8', 0, bytesRead).split('\n').map(l => l.trim()).filter(l => l.length)
        this.onLines(lines, true)
      }
    } catch {
      this.logger.write('error [GameLogWatcher] Failed to watch file.')
    }
  }

  private handleFileChange () {
    if (this._state && !this._state.isReading) {
      this._state.isReading = true
      this.readToEOF()
    }
  }

  private async readToEOF () {
    if (!this._state) return

    const { file, readBuff, offset } = this._state
    const { bytesRead } = await file.read(readBuff, 0, readBuff.length, offset)

    if (bytesRead) {
      const str = readBuff.toString('utf8', 0, bytesRead)
      const lines = str.split('\n').map(line => line.trim()).filter(line => line.length)
      this.onLines?.(lines, false)
      this.server.sendEventTo('broadcast', {
        name: 'MAIN->CLIENT::game-log',
        payload: { lines }
      })
    }

    if (bytesRead) {
      this._state.offset += bytesRead
      this.readToEOF()
    } else {
      this._state.isReading = false
    }
  }
}

// Deathloom fork: path of the running PoE1 executable (PoE2 lives in a "Path of Exile 2" folder)
function findPoe1Exe (): Promise<string | null> {
  const script = "Get-Process | Where-Object { $_.ProcessName -like 'PathOfExile*' } | " +
    'ForEach-Object { $_.Path } | Where-Object { $_ -and $_ -notmatch "Path of Exile 2" } | Select-Object -First 1'
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => { resolve(err ? null : (stdout.trim() || null)) })
  })
}
