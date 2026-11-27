// Deathloom fork (S6, 27 Nov 2026): what the running Path of Building can do.
// The PoB fork lists its commands (and later options, "<cmd>.<feature>") on the
// headless server's ready line, so the overlay can hide or explain a feature this
// copy can't do instead of sending a command it doesn't know. Copies from before
// that send no list: they are treated as the PoB pin of 22 Nov 2026 (dev@43f5414).

export interface PobCaps {
  // false: this PoB sent no list (older copy), caps = LEGACY_POB_CAPS
  reported: boolean
  version: string
  caps: string[]
}

export const LEGACY_POB_CAPS: readonly string[] = [
  'clearEquipped', 'craftBases', 'craftMods', 'edit', 'equipped', 'equipped.file', 'gear', 'gems',
  'impact', 'info', 'load', 'loadouts', 'ping', 'plan', 'quit', 'setLoadout', 'timeless',
  'timeless.find', 'tree', 'treeMap'
]

const CAP_NAME = /^[A-Za-z][A-Za-z0-9]{0,39}(\.[A-Za-z][A-Za-z0-9]{0,39})?$/

// the ready line's reply ({"id":0,"ready":true,...}) -> what this PoB can do
export function pobCapsFromReady (reply: unknown): PobCaps {
  const r = (reply != null && typeof reply === 'object') ? reply as Record<string, unknown> : {}
  const version = typeof r.version === 'string' ? r.version.slice(0, 20) : 'unknown'
  if (r.fork === 'deathloom' && Array.isArray(r.caps)) {
    const caps = r.caps.filter((c): c is string => typeof c === 'string' && CAP_NAME.test(c)).slice(0, 200)
    return { reported: true, version, caps }
  }
  return { reported: false, version, caps: [...LEGACY_POB_CAPS] }
}

// null = PoB not started yet: don't hide anything before we know
export function pobSupports (caps: PobCaps | null | undefined, cap: string): boolean {
  return caps == null || caps.caps.includes(cap)
}

// the capability a request needs: the command, or one of its later options
export function pobCapFor (cmd: string, params: Record<string, unknown> = {}): string {
  if (cmd === 'equipped' && params.file != null) return 'equipped.file'
  if (cmd === 'timeless' && params.find != null) return 'timeless.find'
  return cmd
}

export function pobNeedsUpdate (caps: PobCaps | null | undefined): string {
  const v = caps && caps.version !== 'unknown' ? ` (${caps.version})` : ''
  return `Your Path of Building${v} is older than this feature. Orbhoarder updates it by itself: close the Path of Building window, restart Orbhoarder and try again in a minute.`
}
