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

// Puts a backup's settings into the settings being edited (Save keeps them) and
// its panel data into this PC's storage straight away.
export function readBackup (text: string, into: Config): { ok: boolean, message: string } {
  let data: { kind?: string, createdAt?: string, config?: Record<string, unknown> & { configVersion?: unknown }, local?: Record<string, unknown> }
  try { data = JSON.parse(text) } catch { return { ok: false, message: 'That file isn\'t an Orbhoarder backup.' } }
  if (data?.kind !== BACKUP_KIND || !data.config || typeof data.config !== 'object' || typeof data.config.configVersion !== 'number') {
    return { ok: false, message: 'That file isn\'t an Orbhoarder backup.' }
  }
  if (data.config.configVersion > into.configVersion) {
    return { ok: false, message: 'That backup is from a newer Orbhoarder. Update first, then restore.' }
  }
  for (const [k, v] of Object.entries(data.config)) {
    if (SKIP_CONFIG.test(k)) continue
    ;(into as unknown as Record<string, unknown>)[k] = v
  }
  let n = 0
  if (data.local && typeof data.local === 'object') {
    for (const [k, v] of Object.entries(data.local)) {
      if (k.startsWith('deathloom.') && typeof v === 'string') {
        try { localStorage.setItem(k, v); n++ } catch {}
      }
    }
  }
  return { ok: true, message: `Restored from ${String(data.createdAt ?? '').slice(0, 10)} (${n} panel data items). Press Save to keep the settings, then restart Orbhoarder.` }
}
