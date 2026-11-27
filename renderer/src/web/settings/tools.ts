// Deathloom fork: Settings → Tools helpers (hotkey clashes, backup file)
import type { Config } from '@/web/Config'

// Same key on two things (hotkeys anywhere in the settings: names ending in "Key"
// or "hotkey", pob.panelKeys, commands). Returns "Ctrl + D: a and b" lines.
export function hotkeyClashes (config: Config): string[] {
  const seen = new Map<string, string[]>()
  const add = (key: unknown, where: string) => {
    if (typeof key !== 'string' || !key.trim()) return
    const k = key.replace(/\s+/g, ' ').trim()
    seen.set(k, [...(seen.get(k) ?? []), where])
  }
  const walk = (obj: unknown, path: string) => {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) { obj.forEach((v, i) => { walk(v, `${path}[${i}]`) }); return }
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const p = path ? `${path}.${k}` : k
      if (typeof v === 'string' && (/(^|[a-z])Key$/.test(k) || k === 'hotkey') && !/^(leagueId|remoteKey)$/.test(k)) add(v, label(p, obj as Record<string, unknown>))
      else if (k === 'panelKeys' && v && typeof v === 'object') {
        for (const [panel, key] of Object.entries(v)) add(key, `panel ${panel}`)
      } else walk(v, p)
    }
  }
  walk(config, '')
  return [...seen.entries()].filter(([, w]) => w.length > 1).map(([k, w]) => `${k}: ${[...new Set(w)].join(' and ')}`)
}

function label (path: string, parent: Record<string, unknown>): string {
  // chat commands: show the text; widgets: their title/type
  if (typeof parent.text === 'string') return `chat "${String(parent.text).slice(0, 20)}"`
  if (typeof parent.wmTitle === 'string' && parent.wmTitle) return String(parent.wmTitle)
  if (typeof parent.wmType === 'string') return String(parent.wmType)
  return path.replace(/^pob\./, '').replace(/Key$/, '')
}

const BACKUP_KIND = 'orbhoarder-backup'
// keys left out of a backup (secrets or per-PC things)
const SKIP_CONFIG = /token|secret|password|poesessid|session/i
// Q24: keys that would change an object's prototype instead of setting a value
const UNSAFE_KEY = /^(__proto__|constructor|prototype)$/
// a backup's panel data: at most this many items, each at most this long
const MAX_LOCAL_ITEMS = 500
const MAX_LOCAL_CHARS = 2 * 1024 * 1024

// Q24: this PC's folders. Kept when restoring a backup from another PC (or a friend's)
// unless asked otherwise: the paths there rarely exist here.
export const PC_PATHS: ReadonlyArray<readonly string[]> = [
  ['clientLog'], ['gameConfig'], ['pob', 'pobDir'], ['pob', 'buildsDir']
]

export function makeBackup (config: Config): string {
  const clean = JSON.parse(JSON.stringify(config, (k, v) => SKIP_CONFIG.test(k) ? undefined : v))
  const local: Record<string, string> = {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('deathloom.')) local[k] = localStorage.getItem(k) ?? ''
    }
  } catch {}
  return JSON.stringify({ kind: BACKUP_KIND, v: 1, createdAt: new Date().toISOString(), config: clean, local }, null, 1)
}

interface BackupData {
  kind?: string
  createdAt?: string
  config?: Record<string, unknown> & { configVersion?: unknown }
  local?: Record<string, unknown>
}

export interface BackupSummary {
  ok: boolean
  message: string
  // what the file holds (ok only)
  createdAt?: string
  settings?: number
  panelData?: number
  // folders set in the file that differ from this PC's
  otherPaths?: string[]
}

function parseBackup (text: string, into: Config): { data?: BackupData, error?: string } {
  let data: BackupData
  try { data = JSON.parse(text) } catch { return { error: 'That file isn\'t an Orbhoarder backup.' } }
  if (data?.kind !== BACKUP_KIND || !data.config || typeof data.config !== 'object' || Array.isArray(data.config) || typeof data.config.configVersion !== 'number') {
    return { error: 'That file isn\'t an Orbhoarder backup.' }
  }
  if (data.config.configVersion > into.configVersion) {
    return { error: 'That backup is from a newer Orbhoarder. Update first, then restore.' }
  }
  return { data }
}

function getPath (obj: unknown, path: readonly string[]): unknown {
  let o = obj
  for (const k of path) o = (o != null && typeof o === 'object') ? (o as Record<string, unknown>)[k] : undefined
  return o
}

function localItems (data: BackupData): Array<[string, string]> {
  if (!data.local || typeof data.local !== 'object') return []
  return Object.entries(data.local)
    .filter((e): e is [string, string] => e[0].startsWith('deathloom.') && !UNSAFE_KEY.test(e[0]) && typeof e[1] === 'string' && e[1].length <= MAX_LOCAL_CHARS)
    .slice(0, MAX_LOCAL_ITEMS)
}

function settingKeys (data: BackupData, into: Config): string[] {
  const cur = into as unknown as Record<string, unknown>
  return Object.keys(data.config!).filter(k => {
    if (SKIP_CONFIG.test(k) || UNSAFE_KEY.test(k) || k === 'configVersion') return false
    const v = data.config![k]
    // same kind of value as this PC's setting (or a setting this PC hasn't set yet)
    if (!(k in cur) || cur[k] == null || v == null) return true
    return Array.isArray(v) === Array.isArray(cur[k]) && typeof v === typeof cur[k]
  })
}

// Q24: what a backup file holds, before anything is changed
export function backupSummary (text: string, into: Config): BackupSummary {
  const { data, error } = parseBackup(text, into)
  if (!data) return { ok: false, message: error! }
  const otherPaths = PC_PATHS
    .filter(p => {
      const v = getPath(data.config, p)
      return typeof v === 'string' && v !== '' && v !== getPath(into, p)
    })
    .map(p => p.join('.'))
  return {
    ok: true,
    message: '',
    createdAt: String(data.createdAt ?? '').slice(0, 10),
    settings: settingKeys(data, into).length,
    panelData: localItems(data).length,
    otherPaths
  }
}

export interface RestoreOptions {
  // settings, hotkeys and panel layouts (Save keeps them)
  settings: boolean
  // notes, ticks, session and other panel data (written straight away)
  panelData: boolean
  // keep this PC's folders (game files, Path of Building, builds)
  keepPaths: boolean
}

// Puts a backup's settings into the settings being edited (Save keeps them) and
// its panel data into this PC's storage straight away.
export function readBackup (text: string, into: Config, opts: RestoreOptions = { settings: true, panelData: true, keepPaths: false }): { ok: boolean, message: string } {
  const { data, error } = parseBackup(text, into)
  if (!data) return { ok: false, message: error! }
  const cur = into as unknown as Record<string, unknown>
  if (opts.settings) {
    const kept = opts.keepPaths ? PC_PATHS.map(p => [p, getPath(into, p)] as const) : []
    for (const k of settingKeys(data, into)) cur[k] = data.config![k]
    // put this PC's folders back (only where the backup's object has the same shape)
    for (const [p, v] of kept) {
      const parent = getPath(into, p.slice(0, -1))
      if (parent != null && typeof parent === 'object') (parent as Record<string, unknown>)[p[p.length - 1]] = v
      else if (p.length === 1) cur[p[0]] = v
    }
  }
  let n = 0
  if (opts.panelData) {
    for (const [k, v] of localItems(data)) {
      try { localStorage.setItem(k, v); n++ } catch {}
    }
  }
  const when = String(data.createdAt ?? '').slice(0, 10)
  if (!opts.settings) return { ok: true, message: `Restored ${n} panel data items from ${when}. Restart Orbhoarder to see them everywhere.` }
  return { ok: true, message: `Restored from ${when}${opts.panelData ? ` (${n} panel data items)` : ''}. Press Save to keep the settings, then restart Orbhoarder.` }
}
