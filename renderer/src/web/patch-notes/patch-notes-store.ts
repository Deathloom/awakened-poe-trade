// Deathloom fork: patch notes state shared by every window (localStorage +
// storage events), and the watcher the overlay window runs (main.ts). One
// request to GGG's public Patch Notes forum page every 30 minutes, only while
// Orbhoarder runs, never in PoE2 mode, off with Settings → General.
import { shallowRef } from 'vue'
import { Host } from '@/web/background/IPC'
import { AppConfig } from '@/web/Config'
import {
  STORAGE_KEY, PATCH_NOTES_PROXY_PATH, CHECK_EVERY_MS, FIRST_CHECK_AFTER_MS,
  loadState, afterCheck, parseForumThreads, newestThread, markSeen, threadUrl,
  type PatchNotesState
} from './patch-notes'

function read (): PatchNotesState {
  try { return loadState(localStorage.getItem(STORAGE_KEY)) } catch { return {} }
}

export const patchNotes = shallowRef<PatchNotesState>(read())

function save (s: PatchNotesState) {
  patchNotes.value = s
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch {}
}

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) patchNotes.value = read()
})

export function patchNotesOn (): boolean {
  return AppConfig().pob?.patchNotesAlert !== false && AppConfig().game !== 'poe2'
}

// the player opened the newest notes
export function markPatchNotesSeen () {
  save(markSeen(read()))
}

async function check () {
  if (!patchNotesOn()) return
  try {
    const res = await Host.proxy(PATCH_NOTES_PROXY_PATH)
    if (!res.ok) return
    const html = await res.text()
    const { state, notify } = afterCheck(read(), newestThread(parseForumThreads(html)), Date.now())
    save(state)
    if (notify) {
      try {
        const n = new Notification('New Path of Exile patch notes', { body: `${notify.title}\nClick to read them on pathofexile.com.`, silent: false })
        n.onclick = () => {
          window.open(threadUrl(notify.id), '_blank')
          markPatchNotesSeen()
        }
      } catch {}
    }
  } catch {
    // offline, Cloudflare check, site down: try again next time
  }
}

let started = false
export function startPatchNotesWatch () {
  if (started) return
  started = true
  const since = Date.now() - (read().checkedAt ?? 0)
  const first = Math.max(FIRST_CHECK_AFTER_MS, CHECK_EVERY_MS - since)
  setTimeout(() => {
    check().catch(() => {})
    setInterval(() => { check().catch(() => {}) }, CHECK_EVERY_MS)
  }, first)
}
