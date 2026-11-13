// Deathloom fork: Path of Building is no longer inside the Loot Goblin installer.
// Loot Goblin downloads it from the PoB fork's master branch into its own folder
// (%LOCALAPPDATA%\Loot Goblin\PathOfBuilding), file by file from master's
// manifest.xml - the same files and source PoB's own updater uses afterwards.
//
// Layout = the repo's: src\ (Lua, data, trees) + runtime\ (exe, dlls), so
// ImpactServer, SyncServer and PoBHeadless.exe work as with a git clone.
// src\manifest.xml gets branch="master" platform="win32" (an "installed" manifest:
// PoB's updater reads it) and src\bundled.cfg keeps PoB's settings in
// Documents\Loot Goblin.
//
// No Electron imports here, so this runs in plain Node for tests.

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

export const POB_REPO_RAW = 'https://raw.githubusercontent.com/Deathloom/PathOfBuilding/master/'
// part -> folder in the PoB folder (same as manifest.cfg; "default" files go to src like PoB's updater does)
const PART_DIRS: Record<string, string> = { default: 'src', program: 'src', tree: 'src', runtime: 'runtime' }

export interface ManifestFile {
  name: string
  part: string
  sha1: string
}

export interface Manifest {
  version: string
  sources: Record<string, string>
  files: ManifestFile[]
}

export type FetchFn = (url: string) => Promise<{ ok: boolean, status: number, text: () => Promise<string>, arrayBuffer: () => Promise<ArrayBuffer> }>

export interface Progress {
  phase: 'checking' | 'downloading' | 'finishing'
  done: number
  total: number
  bytes: number
}

function attr (tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)
  return m ? unescapeXml(m[1]) : undefined
}

function unescapeXml (s: string) {
  return s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

export function parseManifest (text: string): Manifest {
  const version = /<Version\s[^>]*number="([^"]+)"/.exec(text)?.[1]
  if (!version) throw new Error('Path of Building manifest has no version')
  const sources: Record<string, string> = {}
  for (const m of text.matchAll(/<Source\s[^>]*>/g)) {
    const part = attr(m[0], 'part')
    const url = attr(m[0], 'url')
    if (part && url) sources[part] = url
  }
  const files: ManifestFile[] = []
  for (const m of text.matchAll(/<File\s[^>]*>/g)) {
    const name = attr(m[0], 'name')
    const part = attr(m[0], 'part')
    const sha1 = attr(m[0], 'sha1')
    if (name && part && sha1) files.push({ name, part, sha1 })
  }
  if (!files.length) throw new Error('Path of Building manifest lists no files')
  return { version, sources, files }
}

// Installed-style manifest for PoB's own updater (it needs branch + platform)
export function installedManifest (remoteText: string): string {
  return remoteText.replace(/<Version\s+number="([^"]+)"[^>]*\/>/, '<Version number="$1" platform="win32" branch="master" />')
}

// Where a manifest file lives in the PoB folder. Rejects anything leaving the folder.
export function localPath (pobDir: string, file: ManifestFile): string {
  const sub = PART_DIRS[file.part]
  if (!sub) throw new Error(`Unknown manifest part "${file.part}"`)
  const rel = file.name.replace(/\\/g, '/')
  if (rel.startsWith('/') || rel.split('/').some(p => p === '..' || p === '') || /^[a-z]:/i.test(rel)) {
    throw new Error(`Bad file name in manifest: ${file.name}`)
  }
  return path.join(pobDir, sub, ...rel.split('/'))
}

export function fileUrl (manifest: Manifest, file: ManifestFile): string {
  const base = (manifest.sources[file.part] ?? '').replace('{branch}', 'master')
  if (!base.startsWith('https://raw.githubusercontent.com/Deathloom/PathOfBuilding/')) {
    throw new Error(`Unexpected download source for part "${file.part}": ${base}`)
  }
  return base + file.name.split('/').map(encodeURIComponent).join('/')
}

// Same check as PoB's updater: the manifest hashes text files with CRLF endings
export function sha1Matches (data: Buffer, sha1: string): boolean {
  if (crypto.createHash('sha1').update(data).digest('hex') === sha1) return true
  if (data.includes(0)) return false
  const crlf = Buffer.from(data.toString('latin1').replace(/\r?\n/g, '\r\n'), 'latin1')
  return crypto.createHash('sha1').update(crlf).digest('hex') === sha1
}

async function fileMatches (file: string, sha1: string): Promise<boolean> {
  try {
    return sha1Matches(await fs.promises.readFile(file), sha1)
  } catch {
    return false
  }
}

export function readLocalManifest (pobDir: string): Manifest | null {
  try {
    const text = fs.readFileSync(path.join(pobDir, 'src', 'manifest.xml'), 'utf8')
    if (!/<Version\s[^>]*branch="/.test(text)) return null
    return parseManifest(text)
  } catch {
    return null
  }
}

// PoB folder that Loot Goblin can run (downloaded or migrated and finished)
export function isInstalled (pobDir: string): boolean {
  return !!readLocalManifest(pobDir) &&
    fs.existsSync(path.join(pobDir, 'src', 'ImpactServer.lua')) &&
    fs.existsSync(path.join(pobDir, 'runtime', 'PoBHeadless.exe'))
}

function key (f: ManifestFile) { return `${f.part}|${f.name}|${f.sha1}` }

export interface SyncResult {
  version: string
  downloaded: number
  removed: number
  bytes: number
  changed: boolean
}

export interface SyncOptions {
  fetch: FetchFn
  // full = check every file's hash (first install / migration / repair);
  // otherwise trust the local manifest and only fetch what differs or is missing
  full: boolean
  onProgress?: (p: Progress) => void
  // called once before the first file is replaced (stop processes that use PoB)
  beforeReplace?: () => Promise<void> | void
  concurrency?: number
  manifestUrl?: string
}

async function fetchBuffer (fetchFn: FetchFn, url: string): Promise<Buffer> {
  let lastErr: Error | null = null
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetchFn(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      lastErr = err as Error
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  throw new Error(`${url}: ${lastErr?.message ?? 'download failed'}`)
}

// Brings pobDir in line with master's manifest. Files are downloaded next to
// their target (*.lgdl) and moved into place only when all of them arrived and
// passed the hash check, so a failed run leaves the old copy working.
export async function syncPob (pobDir: string, opts: SyncOptions): Promise<SyncResult> {
  const progress = (p: Progress) => { opts.onProgress?.(p) }
  progress({ phase: 'checking', done: 0, total: 0, bytes: 0 })
  const fetchFn = opts.fetch
  const manifestRes = await fetchFn(opts.manifestUrl ?? POB_REPO_RAW + 'manifest.xml')
  if (!manifestRes.ok) throw new Error(`Couldn't get Path of Building's file list (HTTP ${manifestRes.status})`)
  const remoteText = await manifestRes.text()
  const remote = parseManifest(remoteText)
  const local = opts.full ? null : readLocalManifest(pobDir)
  const localKeys = new Set(local?.files.map(key))

  // What needs downloading
  const todo: ManifestFile[] = []
  let checked = 0
  for (const file of remote.files) {
    const target = localPath(pobDir, file)
    if (localKeys.has(key(file))) {
      if (!fs.existsSync(target)) todo.push(file)
    } else if (!await fileMatches(target, file.sha1)) {
      todo.push(file)
    }
    if (opts.full && ++checked % 50 === 0) progress({ phase: 'checking', done: checked, total: remote.files.length, bytes: 0 })
  }
  // Not in the manifest but needed: PoB's updater (Update.exe) and the Loot Goblin marker
  const extras: Array<{ target: string, url?: string, content?: string }> = []
  const updateExe = path.join(pobDir, 'runtime', 'Update.exe')
  if (!fs.existsSync(updateExe)) {
    extras.push({ target: updateExe, url: (remote.sources.runtime ?? '').replace('{branch}', 'master') + 'Update.exe' })
  }
  const bundledCfg = path.join(pobDir, 'src', 'bundled.cfg')
  if (!fs.existsSync(bundledCfg)) extras.push({ target: bundledCfg, content: '' })

  // Files the previous version had and this one doesn't (as PoB's updater does)
  const remoteNames = new Set(remote.files.map(f => `${f.part}|${f.name}`))
  const stale = (readLocalManifest(pobDir)?.files ?? [])
    .filter(f => !remoteNames.has(`${f.part}|${f.name}`))

  const manifestPath = path.join(pobDir, 'src', 'manifest.xml')
  const newManifest = installedManifest(remoteText)
  let manifestSame = false
  try { manifestSame = fs.readFileSync(manifestPath, 'utf8') === newManifest } catch {}

  if (!todo.length && !extras.length && !stale.length && manifestSame) {
    return { version: remote.version, downloaded: 0, removed: 0, bytes: 0, changed: false }
  }

  // Download
  let bytes = 0
  let done = 0
  const total = todo.length + extras.filter(e => e.url).length
  const temps: Array<{ tmp: string, target: string }> = []
  progress({ phase: 'downloading', done, total, bytes })
  const queue: Array<() => Promise<void>> = [
    ...todo.map(file => async () => {
      const target = localPath(pobDir, file)
      const data = await fetchBuffer(fetchFn, fileUrl(remote, file))
      if (!sha1Matches(data, file.sha1)) throw new Error(`${file.name}: download damaged (hash mismatch)`)
      await fs.promises.mkdir(path.dirname(target), { recursive: true })
      await fs.promises.writeFile(target + '.lgdl', data)
      temps.push({ tmp: target + '.lgdl', target })
      bytes += data.length
    }),
    ...extras.filter(e => e.url).map(e => async () => {
      const data = await fetchBuffer(fetchFn, e.url!)
      await fs.promises.mkdir(path.dirname(e.target), { recursive: true })
      await fs.promises.writeFile(e.target + '.lgdl', data)
      temps.push({ tmp: e.target + '.lgdl', target: e.target })
      bytes += data.length
    })
  ]
  let failure: Error | null = null
  const workers = Array.from({ length: Math.min(opts.concurrency ?? 6, Math.max(queue.length, 1)) }, async () => {
    while (queue.length && !failure) {
      const job = queue.shift()!
      try {
        await job()
        done++
        progress({ phase: 'downloading', done, total, bytes })
      } catch (err) {
        failure = err as Error
      }
    }
  })
  await Promise.all(workers)
  if (failure) {
    await Promise.all(temps.map(t => fs.promises.rm(t.tmp, { force: true })))
    throw failure
  }

  // Replace
  progress({ phase: 'finishing', done, total, bytes })
  await opts.beforeReplace?.()
  for (const t of temps) {
    await fs.promises.rename(t.tmp, t.target)
  }
  for (const e of extras.filter(e => e.content !== undefined)) {
    await fs.promises.mkdir(path.dirname(e.target), { recursive: true })
    await fs.promises.writeFile(e.target, e.content!)
  }
  let removed = 0
  for (const f of stale) {
    try {
      await fs.promises.rm(localPath(pobDir, f), { force: true })
      removed++
    } catch {}
  }
  // Last: the manifest marks the copy as complete
  await fs.promises.writeFile(manifestPath, newManifest)
  return { version: remote.version, downloaded: temps.length, removed, bytes, changed: true }
}
