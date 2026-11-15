import { execFile } from 'child_process'
import { promises as fs, watchFile, unwatchFile, createReadStream, writeFileSync } from 'fs'
import readline from 'readline'
import path from 'path'
import { app } from 'electron'
import { guessFileLocation } from './utils'
import { ServerEvents } from '../server'
import { Logger } from '../RemoteLogger'
import { GAME_FOLDER, exeMatchesGame, type Game } from '../../../ipc/game'

// Deathloom fork: default Client.txt locations per game (PoE2 mode)
function possiblePaths (game: Game): string[] {
  const dir = GAME_FOLDER[game]
  return (process.platform === 'win32') ? [
    `C:\\Program Files (x86)\\Grinding Gear Games\\${dir}\\logs\\Client.txt`,
    `C:\\Program Files (x86)\\Steam\\steamapps\\common\\${dir}\\logs\\Client.txt`
  ] : (process.platform === 'linux') ? [
    path.join(app.getPath('home'), `.wine/drive_c/Program Files (x86)/Grinding Gear Games/${dir}/logs/Client.txt`),
    path.join(app.getPath('home'), `.local/share/Steam/steamapps/common/${dir}/logs/Client.txt`)
  ] : (process.platform === 'darwin' && game === 'poe1') ? [
    path.join(app.getPath('home'), 'Library/Caches/com.GGG.PathOfExile/Logs/Client.txt')
  ] : []
}

// lines Orbhoarder reads (levels, quest rewards, zones, passives, deaths, dialogue)
const KEEP = /\] : |Successfully (un)?allocated|Generating level|LOADING SCREEN|Abnormal disconnect|\] [A-Z][^:#$%&@<>]{1,40}: /

export class GameLogWatcher {
  private _wantedPath: string | null = null
  private _game: Game = 'poe1'
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

  // Deathloom fork: where reading stopped last time (saved after every read), so
  // lines written while Orbhoarder was closed (an update, a restart) aren't missed
  private posFile = path.join(app.getPath('userData'), 'game-log-position.json')
  private posSaving = Promise.resolve()
  private catchUp: string[] | null = null
  private catchUpAsked = false

  constructor (
    private server: ServerEvents,
    private logger: Logger,
  ) {
    // the position not yet written (see savePosition) is saved on quit, so lines
    // aren't read twice by the next start's catch-up
    app.on('before-quit', () => {
      if (!this.posTimer || !this._state) return
      clearTimeout(this.posTimer)
      this.posTimer = null
      try { writeFileSync(this.posFile, JSON.stringify({ path: this._state.path, offset: this._state.offset })) } catch {}
    })
  }

  // Deathloom fork: written at most every few seconds while the log grows
  private posTimer: NodeJS.Timeout | null = null
  private savePosition () {
    if (this.posTimer) return
    this.posTimer = setTimeout(() => {
      this.posTimer = null
      this.writePosition()
    }, 3000)
  }

  private writePosition () {
    if (!this._state) return
    const data = JSON.stringify({ path: this._state.path, offset: this._state.offset })
    this.posSaving = this.posSaving.then(() => fs.writeFile(this.posFile, data)).catch(() => {})
  }

  private async readSavedPosition (): Promise<{ path: string, offset: number } | null> {
    try {
      const v = JSON.parse(await fs.readFile(this.posFile, 'utf8'))
      return typeof v?.path === 'string' && Number.isFinite(v.offset) ? v : null
    } catch { return null }
  }

  // Lines (levels, passives, atlas, session) written since Orbhoarder last read
  // the log, once. The overlay asks when it starts; if the log isn't open yet,
  // they're broadcast as soon as it is.
  takeCatchUp (): string[] | null {
    if (!this._state) { this.catchUpAsked = true; return null }
    const lines = this.catchUp
    this.catchUp = null
    return lines ?? []
  }

  async restart (logFile: string, game: Game = 'poe1') {
    if (this._wantedPath !== logFile || this._game !== game) {
      this._wantedPath = logFile
      this._game = game
      if (this._state) {
        unwatchFile(this._state.path)
        await this._state.file.close()
        this._state = null
      }
    } else {
      return
    }

    if (!logFile.length) {
      const guessedPath = await guessFileLocation(possiblePaths(game))
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
  // running game process (PoE1 or PoE2, per the game setting), i.e.
  // <game folder>\logs\Client.txt.
  // Only lists processes; nothing reads the game's memory.
  async findFromGameProcess () {
    if (this._state || this._wantedPath || process.platform !== 'win32') return
    const game = this._game
    const exe = await findGameExe(game)
    if (!exe || this._state || this._wantedPath || this._game !== game) return
    const logFile = path.join(path.dirname(exe), 'logs', 'Client.txt')
    try {
      await fs.access(logFile)
    } catch {
      this.logger.write(`warn [GameLogWatcher] No log at ${logFile}`)
      return
    }
    await this.open(logFile)
  }

  // Deathloom fork: the whole Client.txt, only the lines Orbhoarder reads
  // (levels, quest rewards, zones, passives, deaths, dialogue): the levelling
  // planner rebuilds every character's progress from them
  async readHistory (): Promise<string[]> {
    if (!this._state) throw new Error('Client.txt not found yet (start the game, or set the path in Settings → General)')
    // streamed line by line: Client.txt can be several GB
    const out: string[] = []
    const lines = readline.createInterface({ input: createReadStream(this._state.path, { encoding: 'utf8' }), crlfDelay: Infinity })
    for await (const line of lines) {
      if (KEEP.test(line)) out.push(line)
    }
    return out
  }

  private async readCatchUp (file: fs.FileHandle, logFile: string, size: number) {
    const saved = await this.readSavedPosition()
    if (!saved || saved.path !== logFile || saved.offset >= size || saved.offset < 0) return null
    // the log was replaced (smaller than before) or the gap is huge: skip it
    const gap = size - saved.offset
    if (gap > 32 * 1024 * 1024) return null
    const buf = Buffer.allocUnsafe(gap)
    const { bytesRead } = await file.read(buf, 0, gap, saved.offset)
    const lines = buf.toString('utf8', 0, bytesRead).split('\n').map(l => l.trim()).filter(l => KEEP.test(l))
    this.logger.write(`info [GameLogWatcher] ${lines.length} lines written while Orbhoarder was closed`)
    return lines
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
      this.catchUp = await this.readCatchUp(file, logFile, stats.size).catch(() => null)
      this.savePosition()
      if (this.catchUpAsked) {
        this.catchUpAsked = false
        const lines = this.takeCatchUp()
        if (lines?.length) this.server.sendEventTo('broadcast', { name: 'MAIN->CLIENT::game-log-catchup', payload: { lines } })
      }
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

    // Deathloom fork: only whole lines; a line cut at the end of the buffer is read
    // again next time (unless one line fills the whole buffer)
    let used = bytesRead
    if (bytesRead) {
      const lastNl = readBuff.lastIndexOf(0x0a, bytesRead - 1)
      if (lastNl >= 0) used = lastNl + 1
      else if (bytesRead < readBuff.length) used = 0
    }

    if (used) {
      const str = readBuff.toString('utf8', 0, used)
      const lines = str.split('\n').map(line => line.trim()).filter(line => line.length)
      this.onLines?.(lines, false)
      this.server.sendEventTo('broadcast', {
        name: 'MAIN->CLIENT::game-log',
        payload: { lines }
      })
    }

    if (used) {
      this._state.offset += used
      this.savePosition()
      this.readToEOF()
    } else {
      this._state.isReading = false
    }
  }
}

// Deathloom fork: path of the running game's executable (PoE2 lives in a "Path of Exile 2" folder)
function findGameExe (game: Game): Promise<string | null> {
  const script = "Get-Process | Where-Object { $_.ProcessName -like 'PathOfExile*' } | " +
    'ForEach-Object { $_.Path } | Where-Object { $_ }'
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => {
        if (err) return resolve(null)
        const exe = stdout.split(/\r?\n/).map(l => l.trim()).find(l => l && exeMatchesGame(l, game))
        resolve(exe ?? null)
      })
  })
}
