// Deathloom fork: the player's atlas builds (saved on this PC) and what's
// taken on the atlas (from Client.txt, by name, like the passive tree).
import { ref, computed } from 'vue'
import { CHAR_LEVELS_KEY, loadCharLevels, saveCharLevels } from '../companion/char-level'
import { ATLAS_BY_ID, ATLAS_START, decodeAtlas, encodeAtlas, type AtlasSpec } from './atlas-tree'

export interface AtlasBuild { id: string, name: string, code: string, at: number }
interface AtlasStore { builds: AtlasBuild[], active: string | null }

const KEY = 'deathloom.atlas-builds.v1'
const MAX = 50

function load (): AtlasStore {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (raw && Array.isArray(raw.builds)) {
      const builds = raw.builds.filter((b: Partial<AtlasBuild>) => typeof b?.id === 'string' && typeof b.name === 'string' && typeof b.code === 'string').slice(0, MAX)
      return { builds, active: builds.some((b: AtlasBuild) => b.id === raw.active) ? raw.active : null }
    }
  } catch {}
  return { builds: [], active: null }
}

export const store = ref<AtlasStore>(load())
function save () {
  try { localStorage.setItem(KEY, JSON.stringify(store.value)) } catch {}
}

export const activeBuild = computed(() => store.value.builds.find(b => b.id === store.value.active) ?? null)
export const activeSpec = computed<AtlasSpec | null>(() => {
  const b = activeBuild.value
  if (!b) return null
  try { return decodeAtlas(b.code) } catch { return null }
})

// throws with a readable message when the code isn't an atlas tree
export function addBuild (name: string, code: string): AtlasBuild {
  decodeAtlas(code)
  const b: AtlasBuild = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: name.trim().slice(0, 60) || 'Atlas build', code, at: Date.now() }
  store.value = { builds: [b, ...store.value.builds].slice(0, MAX), active: b.id }
  save()
  return b
}
export function setActive (id: string | null) {
  store.value = { ...store.value, active: id }
  save()
}
export function renameBuild (id: string, name: string) {
  store.value = { ...store.value, builds: store.value.builds.map(b => b.id === id ? { ...b, name: name.trim().slice(0, 60) || b.name } : b) }
  save()
}
export function deleteBuild (id: string) {
  const builds = store.value.builds.filter(b => b.id !== id)
  store.value = { builds, active: store.value.active === id ? (builds[0]?.id ?? null) : store.value.active }
  save()
}
export function updateCode (id: string, spec: Pick<AtlasSpec, 'nodes' | 'choices'>) {
  const code = encodeAtlas(spec)
  store.value = { ...store.value, builds: store.value.builds.map(b => b.id === id ? { ...b, code, at: Date.now() } : b) }
  save()
}

// other windows changed it
window.addEventListener('storage', (e) => {
  if (e.key === KEY) store.value = load()
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
