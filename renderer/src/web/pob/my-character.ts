// Deathloom fork: your character's file, "My characters/<character>.xml".
// Path of Building fills it with Import character; Orbhoarder only reads the
// saved file (Gear compare and the Gems tab use it). It belongs to the
// character, not to a build, so renaming or updating the build you follow
// doesn't break it (Gerhard 19 Nov 2026). The character → file link is kept
// in localStorage; older "<build> (my character).xml" copies can be linked too.

export const CHAR_FOLDER = 'My characters'
// old naming (before 1.0.94): a copy per build
export const MINE = ' (my character)'
const MINE_RE = new RegExp(`${MINE.replace(/[()]/g, '\\$&')}\\.xml$`, 'i')

const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase()
export const samePath = (a: string, b: string) => norm(a) === norm(b)

// old: "<build> (my character).xml" next to the build
export function legacyPathOf (active: string): string {
  return MINE_RE.test(active) ? active : active.replace(/\.xml$/i, `${MINE}.xml`)
}

// character names are letters, digits and _, but keep it safe for Windows anyway
export function safeCharName (name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, '').replace(/^\.+/, '').trim().slice(0, 100)
}

export function charFilePath (name: string): string {
  return `${CHAR_FOLDER}/${safeCharName(name)}.xml`
}

export function isCharFile (p: string): boolean {
  return norm(p).startsWith(norm(CHAR_FOLDER) + '/') || MINE_RE.test(p)
}

// every file that can hold a character: the folder's files first, then old copies
export function characterFiles (builds: string[]): string[] {
  const inFolder = builds.filter(b => norm(b).startsWith(norm(CHAR_FOLDER) + '/'))
  const legacy = builds.filter(b => MINE_RE.test(b))
  return [...inFolder.sort(), ...legacy.sort()]
}

export type Links = Record<string, string>
const linkKey = (name: string) => name.trim().toLowerCase()

export function linkFor (links: Links, name: string): string | undefined {
  return name ? links[linkKey(name)] : undefined
}

export function withLink (links: Links, name: string, path: string | null): Links {
  const k = linkKey(name)
  const out = Object.fromEntries(Object.entries(links).filter(([key]) => key !== k))
  if (path) out[k] = path
  return out
}

export interface MineResolved {
  // the file to read, as the builds list spells it (null = not set up)
  path: string | null
  how: 'linked' | 'named' | null
  // an old "(my character)" copy to offer when nothing is set up
  legacy: string | null
}

// linked file (if it still exists) → "My characters/<name>.xml" → offer an old copy
export function resolveMine (name: string, builds: string[], links: Links, active: string | null): MineResolved {
  const find = (p: string) => builds.find(b => samePath(b, p)) ?? null
  const linked = linkFor(links, name)
  if (linked) {
    const f = find(linked)
    if (f) return { path: f, how: 'linked', legacy: null }
  }
  if (name) {
    const f = find(charFilePath(name))
    if (f) return { path: f, how: 'named', legacy: null }
  }
  let legacy: string | null = null
  if (active && !isCharFile(active)) legacy = find(legacyPathOf(active))
  if (!legacy) legacy = builds.find(b => MINE_RE.test(b)) ?? null
  return { path: null, how: null, legacy }
}

// the build you follow: the active build, or the last one followed when the
// active build is a character file (opened in PoB to import)
export function planPathOf (active: string | null, builds: string[], lastPlan: string | null): string {
  if (active && !isCharFile(active)) return active
  if (active && MINE_RE.test(active)) {
    const plan = active.replace(MINE_RE, '.xml')
    const f = builds.find(b => samePath(b, plan))
    if (f) return f
  }
  if (lastPlan && builds.some(b => samePath(b, lastPlan))) return lastPlan
  return active ?? ''
}
