// Deathloom fork: shared state for "your character's file" (my-character.ts),
// used by Build → Compare and the Gems tab. Character name from Client.txt
// (char-level.ts); typed in once when the log hasn't seen it yet.

import { computed, onUnmounted, ref, shallowRef } from 'vue'
import type { PobSocketGroup, PobSocketedItem } from '@ipc/types'
import { Host } from '@/web/background/IPC'
import { CHAR_LEVELS_KEY, loadCharLevels, currentChar } from '@/web/companion/char-level'
import { liveFromSummary } from './gems'
import { resolveMine, planPathOf, characterFiles, charFilePath, withLink, isCharFile, CHAR_FOLDER, safeCharName, type Links } from './my-character'

const LINKS_KEY = 'deathloom.my-character-files.v1'
const NAME_KEY = 'deathloom.my-character-name.v1'
const PLAN_KEY = 'deathloom.my-character-plan.v1'
const load = <T>(k: string, d: T): T => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d } catch { return d } }
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

let idBase = ((Date.now() & 0x00ffffff) | 0x20000000) | 0

export function useMyCharacter () {
  const builds = ref<string[]>([])
  const active = ref<string | null>(null)
  const listError = ref('')
  const levels = ref(loadCharLevels())
  const links = ref<Links>(load(LINKS_KEY, {}))
  const typedName = ref<string>(load(NAME_KEY, ''))
  const lastPlan = ref<string | null>(load(PLAN_KEY, null))
  const onStorage = (e: StorageEvent) => {
    if (e.key === CHAR_LEVELS_KEY) levels.value = loadCharLevels()
    if (e.key === LINKS_KEY) links.value = load(LINKS_KEY, {})
    if (e.key === NAME_KEY) typedName.value = load(NAME_KEY, '')
  }
  window.addEventListener('storage', onStorage)

  const logName = computed(() => currentChar(levels.value)?.name ?? '')
  const charName = computed(() => logName.value || typedName.value)
  const resolved = computed(() => resolveMine(charName.value, builds.value, links.value, active.value))
  const minePath = computed(() => resolved.value.path)
  const targetPath = computed(() => charName.value ? charFilePath(charName.value) : '')
  const files = computed(() => characterFiles(builds.value))
  const planPath = computed(() => planPathOf(active.value, builds.value, lastPlan.value))

  idBase = (idBase + 10_000) | 0
  const ids = { list: idBase, read: idBase + 5000, manage: idBase + 7500 }
  let listN = 0
  const onList: Array<() => void> = []
  const lsBuilds = Host.onEvent('MAIN->CLIENT::pob-builds', (e) => {
    if (e.requestId !== ids.list + listN) return
    if (!e.ok) { listError.value = e.error ?? 'Unknown error'; return }
    listError.value = ''
    builds.value = e.list?.builds ?? []
    active.value = e.list?.active ?? null
    if (active.value && !isCharFile(active.value)) { lastPlan.value = active.value; save(PLAN_KEY, active.value) }
    onList.splice(0).forEach(f => f())
  })
  function refresh (then?: () => void) {
    listN = (listN + 1) % 5000
    if (then) onList.push(then)
    Host.sendEvent({ name: 'CLIENT->MAIN::pob-builds', payload: { requestId: ids.list + listN } })
  }

  // read the character file (same parser as Compare)
  const groups = shallowRef<PobSocketGroup[] | undefined>(undefined)
  const items = shallowRef<PobSocketedItem[] | undefined>(undefined)
  const level = ref<number | undefined>(undefined)
  const readError = ref('')
  const reading = ref(false)
  let readN = 0
  const lsRead = Host.onEvent('MAIN->CLIENT::pob-compare', (e) => {
    if (e.requestId !== ids.read + readN) return
    reading.value = false
    if (!e.ok || !e.a) { readError.value = e.error ?? 'Could not read your character file.'; groups.value = undefined; return }
    readError.value = ''
    const l = liveFromSummary(e.a)
    groups.value = l.groups
    items.value = l.items
    level.value = e.a.level
  })
  function read () {
    const p = minePath.value
    if (!p) { groups.value = undefined; items.value = undefined; return }
    readN = (readN + 1) % 2500
    reading.value = true
    Host.sendEvent({ name: 'CLIENT->MAIN::pob-compare', payload: { requestId: ids.read + readN, a: p, b: p } })
  }
  // list, then read
  function reload () { refresh(read) }

  function link (path: string | null) {
    if (!charName.value) return
    links.value = withLink(links.value, charName.value, path)
    save(LINKS_KEY, links.value)
  }
  function setTypedName (name: string) {
    typedName.value = safeCharName(name)
    save(NAME_KEY, typedName.value)
  }

  // make "My characters/<name>.xml" from the build you follow, link it
  const busy = ref(false)
  const manageError = ref('')
  let manageN = 0
  let afterMake: (() => void) | null = null
  const lsManage = Host.onEvent('MAIN->CLIENT::pob-manage-build', (e) => {
    if (e.requestId !== ids.manage + manageN) return
    busy.value = false
    if (!e.ok) { manageError.value = e.error ?? 'Unknown error'; return }
    manageError.value = ''
    if (e.list) { builds.value = e.list.builds; active.value = e.list.active }
    if (e.path) link(e.path)
    afterMake?.()
  })
  function makeFile (then?: () => void) {
    const from = planPath.value
    if (!from || !charName.value) return
    busy.value = true
    manageN = (manageN + 1) % 2500
    afterMake = then ?? null
    Host.sendEvent({
      name: 'CLIENT->MAIN::pob-manage-build',
      payload: { requestId: ids.manage + manageN, op: 'duplicate', path: from, name: safeCharName(charName.value), folder: CHAR_FOLDER }
    })
  }

  onUnmounted(() => {
    lsBuilds.abort(); lsRead.abort(); lsManage.abort()
    window.removeEventListener('storage', onStorage)
  })

  return {
    builds,
    active,
    listError,
    charName,
    logName,
    typedName,
    setTypedName,
    resolved,
    minePath,
    targetPath,
    files,
    planPath,
    groups,
    items,
    level,
    readError,
    reading,
    read,
    refresh,
    reload,
    link,
    makeFile,
    busy,
    manageError
  }
}

export const fileLabel = (p: string | null | undefined) => (p ?? '').replace(/\.xml$/i, '').replace(/\\/g, '/')
