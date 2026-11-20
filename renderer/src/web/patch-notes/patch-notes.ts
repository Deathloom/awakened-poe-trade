// Deathloom fork: new PC patch notes from GGG's forum. The overlay window reads
// the public Patch Notes forum page now and then (one request, through the app's
// own /proxy like the trade site), remembers the newest thread and tells the
// player once when a newer one appears. Pure logic here (tests in
// tests/logic.test.mjs); the watcher is patch-notes-watch.ts.

export const PATCH_NOTES_FORUM = 'https://www.pathofexile.com/forum/view-forum/patch-notes'
// path for Host.proxy (no scheme)
export const PATCH_NOTES_PROXY_PATH = 'www.pathofexile.com/forum/view-forum/patch-notes'
export const STORAGE_KEY = 'deathloom.patch-notes.v1'
export const CHECK_EVERY_MS = 30 * 60_000
export const FIRST_CHECK_AFTER_MS = 60_000

export interface PatchThread {
  id: number
  title: string
}

export interface PatchNotesState {
  // newest thread seen on the forum
  known?: PatchThread
  // newest thread the player opened (or that existed when checking started)
  seenId?: number
  // when the forum was last read (ms)
  checkedAt?: number
}

export function threadUrl (id: number): string {
  return `https://www.pathofexile.com/forum/view-thread/${id}`
}

const ENTITIES: Record<string, string> = { 'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', '#39': "'", 'apos': "'", 'nbsp': ' ' }

function decode (text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_m, e: string) => ENTITIES[e])
    .replace(/&#(\d{1,6});/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim()
}

// Thread links on the forum page (not "page 2" or "last post" links). Only
// titles that look like patch notes or hotfixes count.
export function parseForumThreads (html: string): PatchThread[] {
  const out = new Map<number, PatchThread>()
  const re = /<a\b[^>]*href="(?:https:\/\/www\.pathofexile\.com)?\/forum\/view-thread\/(\d{1,9})"[^>]*>([^<]{3,200})<\/a>/gi
  for (const m of html.matchAll(re)) {
    const id = Number(m[1])
    const title = decode(m[2])
    if (!id || !/patch|hotfix|notes|\d+\.\d+\.\d+/i.test(title)) continue
    if (!out.has(id)) out.set(id, { id, title })
  }
  return [...out.values()]
}

// thread ids only go up, so the highest id is the newest (pinned threads don't matter)
export function newestThread (threads: PatchThread[]): PatchThread | undefined {
  let best: PatchThread | undefined
  for (const t of threads) if (!best || t.id > best.id) best = t
  return best
}

// After a check. The first check only remembers what's there (no alert for old notes).
export function afterCheck (state: PatchNotesState, newest: PatchThread | undefined, now: number): { state: PatchNotesState, notify?: PatchThread } {
  if (!newest) return { state: { ...state, checkedAt: now } }
  if (!state.known) return { state: { known: newest, seenId: newest.id, checkedAt: now } }
  if (newest.id > state.known.id) return { state: { ...state, known: newest, checkedAt: now }, notify: newest }
  // same thread, title may have changed (e.g. "Hotfix 2" edits)
  return { state: { ...state, known: newest.id === state.known.id ? newest : state.known, checkedAt: now } }
}

export function unseen (state: PatchNotesState): PatchThread | undefined {
  const k = state.known
  return k && k.id > (state.seenId ?? 0) ? k : undefined
}

export function markSeen (state: PatchNotesState): PatchNotesState {
  return state.known ? { ...state, seenId: state.known.id } : state
}

// where the link goes: the newest thread when known, else the forum
export function linkUrl (state: PatchNotesState): string {
  return state.known ? threadUrl(state.known.id) : PATCH_NOTES_FORUM
}

export function loadState (raw: string | null): PatchNotesState {
  try {
    const v = JSON.parse(raw ?? '{}') as PatchNotesState
    const ok = (t?: PatchThread) => t && Number.isInteger(t.id) && t.id > 0 && typeof t.title === 'string'
    return {
      known: ok(v.known) ? { id: v.known!.id, title: v.known!.title.slice(0, 200) } : undefined,
      seenId: Number.isInteger(v.seenId) ? v.seenId : undefined,
      checkedAt: typeof v.checkedAt === 'number' ? v.checkedAt : undefined
    }
  } catch { return {} }
}
