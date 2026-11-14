// Deathloom fork: the player's atlas builds (saved on this PC) and what's
// taken on the atlas (from Client.txt, by name, like the passive tree).
import { ref, computed } from 'vue'
import type { AtlasFileBuild } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { CHAR_LEVELS_KEY, loadCharLevels, saveCharLevels } from '../companion/char-level'
import { ATLAS_BY_ID, ATLAS_START, decodeAtlas, encodeAtlas, type AtlasSpec } from './atlas-tree'

// own: yours (editable); owner: the friend whose synced folder it's in (read-only)
export interface AtlasBuild { id: string, name: string, code: string, at: number, own: boolean, owner?: string }
interface AtlasStore { builds: AtlasBuild[], active: string | null }

// Without a builds folder atlas builds live in this window's storage (as before).
// With one they're files in your player folder (Atlas/<name>.txt), synced with
// your builds; friends' come in with Pull. Local ones move to files once.
const KEY = 'deathloom.atlas-builds.v1'
const ACTIVE_KEY = 'deathloom.atlas-active.v2'
const MIGRATED_KEY = 'deathloom.atlas-migrated.v1'
const MAX = 50

function loadLocal (): AtlasStore {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw && Array.isArray(raw.builds)) {
      const builds = raw.builds
        .filter((b: Partial<AtlasBuild>) => typeof b?.id === 'string' && typeof b.name === 'string' && typeof b.code === 'string')
        .slice(0, MAX)
        .map((b: AtlasBuild) => ({ id: b.id, name: b.name, code: b.code, at: b.at ?? 0, own: true }))
      return { builds, active: builds.some((b: AtlasBuild) => b.id === raw.active) ? raw.active : null }
    }
  } catch {}
  return { builds: [], active: null }
}
function saveLocal () {
  if (synced.value) return
  try { localStorage.setItem(KEY, JSON.stringify(store.value)) } catch {}
}
function loadActive (): string | null {
  try { return localStorage.getItem(ACTIVE_KEY) } catch { return null }
}
function saveActive (id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {}
}

export const store = ref<AtlasStore>(loadLocal())
// atlas builds are files (a builds folder is set)
export const synced = ref(false)
export const ownPlayer = ref('')
export const lastError = ref('')

// file names: no characters Windows refuses, no leading dot / trailing dot or space
function cleanName (name: string, fallback: string) {
  // eslint-disable-next-line no-control-regex
  const n = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').replace(/[. ]+$/, '').slice(0, 60).trim()
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(n) ? `${n}-atlas` : (n || fallback)
}

const fileId = (b: AtlasFileBuild) => `${b.own ? '' : b.player}/${b.name}`

let reqId = 0
const pending = new Map<number, (saved?: string) => void>()
function send (op: 'list' | 'save' | 'rename' | 'delete', extra: { name?: string, code?: string, newName?: string, overwrite?: boolean } = {}, done?: (saved?: string) => void) {
  const requestId = ++reqId
  if (done) pending.set(requestId, done)
  Host.sendEvent({ name: 'CLIENT->MAIN::atlas-files', payload: { op, requestId, ...extra } })
}

function migrate () {
  let done = false
  try { done = localStorage.getItem(MIGRATED_KEY) === '1' } catch {}
  const local = loadLocal()
  if (done || !local.builds.length) return
  try { localStorage.setItem(MIGRATED_KEY, '1') } catch {}
  const wasActive = local.builds.find(b => b.id === local.active)
  // oldest first, so suffixes go to the later ones
  for (const b of [...local.builds].reverse()) {
    send('save', { name: b.name, code: b.code }, (saved) => {
      if (b === wasActive && saved) setActive(`/${saved}`)
    })
  }
  try { localStorage.removeItem(KEY) } catch {}
}

Host.onEvent('MAIN->CLIENT::atlas-files', (state) => {
  const cb = state.requestId != null ? pending.get(state.requestId) : undefined
  if (state.requestId != null && pending.has(state.requestId)) {
    pending.delete(state.requestId)
    lastError.value = state.error ?? ''
  }
  if (!state.available) {
    if (synced.value) { synced.value = false; store.value = loadLocal() }
    cb?.()
    return
  }
  const first = !synced.value
  synced.value = true
  ownPlayer.value = state.own
  const builds = state.builds.map(b => ({ id: fileId(b), name: b.name, code: b.code, at: b.at, own: b.own, owner: b.own ? undefined : b.player }))
  let active = first ? loadActive() : store.value.active
  if (active && !builds.some(b => b.id === active)) active = first ? (builds.find(b => b.own)?.id ?? null) : active
  store.value = { builds, active }
  cb?.(state.saved)
  if (first) migrate()
})

// files can change from Pull or another window: ask again now and then
let refreshTimer: ReturnType<typeof setTimeout> | undefined
export function refresh (delay = 0) {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => { send('list') }, delay)
}
refresh()
setInterval(() => { if (document.visibilityState === 'visible') send('list') }, 60_000)
window.addEventListener('focus', () => { refresh(200) })
Host.onEvent('MAIN->CLIENT::pob-sync-state', () => { refresh(3000) })

export const activeBuild = computed(() => store.value.builds.find(b => b.id === store.value.active) ?? null)
export const activeSpec = computed<AtlasSpec | null>(() => {
  const b = activeBuild.value
  if (!b) return null
  try { return decodeAtlas(b.code) } catch { return null }
})

// throws with a readable message when the code isn't an atlas tree
export function addBuild (name: string, code: string): AtlasBuild {
  decodeAtlas(code)
  const clean = cleanName(name, 'Atlas build')
  if (synced.value) {
    // free name now so the new one shows (and is picked) at once
    let n = clean; let i = 1
    while (store.value.builds.some(b => b.own && b.name.toLowerCase() === n.toLowerCase())) n = `${clean} (${++i})`
    const b: AtlasBuild = { id: `/${n}`, name: n, code, at: Date.now(), own: true }
    store.value = { builds: [b, ...store.value.builds], active: b.id }
    saveActive(b.id)
    send('save', { name: n, code }, (saved) => { if (saved && saved !== n) setActive(`/${saved}`) })
    return b
  }
  const b: AtlasBuild = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: clean, code, at: Date.now(), own: true }
  store.value = { builds: [b, ...store.value.builds].slice(0, MAX), active: b.id }
  saveLocal()
  return b
}
export function setActive (id: string | null) {
  store.value = { ...store.value, active: id }
  if (synced.value) saveActive(id)
  else saveLocal()
}
export function renameBuild (id: string, name: string) {
  const b = store.value.builds.find(x => x.id === id)
  if (!b?.own) return
  const clean = cleanName(name, b.name)
  if (synced.value) {
    if (clean === b.name) return
    const nid = `/${clean}`
    store.value = { builds: store.value.builds.map(x => x.id === id ? { ...x, id: nid, name: clean } : x), active: store.value.active === id ? nid : store.value.active }
    if (store.value.active === nid) saveActive(nid)
    send('rename', { name: b.name, newName: clean }, (saved) => {
      // failed (name taken): the list from the files puts it back
      if (!saved && store.value.active === nid) setActive(id)
    })
    return
  }
  store.value = { ...store.value, builds: store.value.builds.map(x => x.id === id ? { ...x, name: clean } : x) }
  saveLocal()
}
export function deleteBuild (id: string) {
  const target = store.value.builds.find(b => b.id === id)
  if (!target?.own) return
  const builds = store.value.builds.filter(b => b.id !== id)
  const active = store.value.active === id ? (builds.find(b => b.own)?.id ?? null) : store.value.active
  store.value = { builds, active }
  if (synced.value) {
    saveActive(active)
    send('delete', { name: target.name })
  } else saveLocal()
}
export function updateCode (id: string, spec: Pick<AtlasSpec, 'nodes' | 'choices'>) {
  const target = store.value.builds.find(b => b.id === id)
  if (!target?.own) return
  const code = encodeAtlas(spec)
  store.value = { ...store.value, builds: store.value.builds.map(b => b.id === id ? { ...b, code, at: Date.now() } : b) }
  if (synced.value) send('save', { name: target.name, code, overwrite: true })
  else saveLocal()
}
// a friend's atlas build -> a copy of your own (then it can be edited)
export function copyToMine (id: string): AtlasBuild | null {
  const b = store.value.builds.find(x => x.id === id)
  if (!b) return null
  return addBuild(b.owner ? `${b.name} (${b.owner})` : `${b.name} - copy`, b.code)
}

// other windows changed it (storage mode)
window.addEventListener('storage', (e) => {
  if (e.key === KEY && !synced.value) store.value = loadLocal()
  if (e.key === ACTIVE_KEY && synced.value) store.value = { ...store.value, active: loadActive() }
  if (e.key === CHAR_LEVELS_KEY) taken.value = loadCharLevels().atlas ?? {}
})

// ---- taken on the atlas (names -> count) ----
export const taken = ref<Record<string, number>>(loadCharLevels().atlas ?? {})
export const tracking = computed(() => Object.values(taken.value).some(n => n > 0))

// Client.txt only shows what you allocate while Loot Goblin runs: "I have this
// build" sets the count from a build (or from nothing)
export function setTakenFrom (nodes: number[] | null) {
  const atlas: Record<string, number> = {}
  for (const id of nodes ?? []) {
    if (ATLAS_START.has(id)) continue
    const n = ATLAS_BY_ID.get(id)
    if (n && n[3] !== 3) atlas[n[6]] = (atlas[n[6]] ?? 0) + 1
  }
  const v = loadCharLevels()
  v.atlas = atlas
  saveCharLevels(v)
  taken.value = atlas
}

// which of the build's nodes count as taken: names are shared by many small
// nodes, so the counts go to the build's nodes nearest the start first
export function takenNodes (buildNodes: number[], order: Map<number, number>): Set<number> {
  const left = { ...taken.value }
  const out = new Set<number>()
  const sorted = [...buildNodes].sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9))
  for (const id of sorted) {
    if (ATLAS_START.has(id)) { out.add(id); continue }
    const name = ATLAS_BY_ID.get(id)?.[6]
    if (name && (left[name] ?? 0) > 0) { out.add(id); left[name]-- }
  }
  return out
}
