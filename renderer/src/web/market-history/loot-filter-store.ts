// Deathloom fork (Q11): loot filter add-on part 2. The picked filter, "keep it updated",
// the last result and the last Shopping list, in this PC's storage (shared by the
// windows, so the Shopping panel and Settings → Loot filter see the same).
import { shallowRef } from 'vue'
import { Host } from '@/web/background/IPC'
import {
  LF_SETTINGS_KEY, LF_STATUS_KEY, LF_WANTS_KEY, parseLfSettings, parseLfStatus, parseLfWants,
  type LootFilterSettings, type LootFilterStatus, type LootFilterWants
} from '@ipc/loot-filter'

function get (k: string): string | null { try { return localStorage.getItem(k) } catch { return null } }
function put (k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

export const lfSettings = shallowRef<LootFilterSettings>(parseLfSettings(get(LF_SETTINGS_KEY)))
export const lfStatus = shallowRef<LootFilterStatus | null>(parseLfStatus(get(LF_STATUS_KEY)))
export const lfLastWants = shallowRef(parseLfWants(get(LF_WANTS_KEY)))

window.addEventListener('storage', (e) => {
  if (e.key === LF_SETTINGS_KEY) lfSettings.value = parseLfSettings(e.newValue)
  if (e.key === LF_STATUS_KEY) lfStatus.value = parseLfStatus(e.newValue)
  if (e.key === LF_WANTS_KEY) lfLastWants.value = parseLfWants(e.newValue)
})

export function setLfSettings (s: Partial<LootFilterSettings>) {
  const next = parseLfSettings(JSON.stringify({ ...lfSettings.value, ...s }))
  lfSettings.value = next
  put(LF_SETTINGS_KEY, next)
}

export function setLfStatus (s: LootFilterStatus) {
  lfStatus.value = s
  put(LF_STATUS_KEY, s)
}

export function setLfLastWants (build: string, wants: LootFilterWants) {
  const v = { build, wants, at: new Date().toISOString() }
  lfLastWants.value = v
  put(LF_WANTS_KEY, v)
}

// Ask main to (re)write the add-on from `wants` and record the answer in lfStatus.
// auto: the automatic update (false: Settings → Loot filter → Update now). Own id
// range, so the Shopping panel's own requests aren't mixed up with these.
let nextId = 900000 + Math.floor(Math.random() * 50000)
const pending = new Map<number, boolean>()
Host.onEvent('MAIN->CLIENT::loot-filter', (e) => {
  const auto = pending.get(e.requestId)
  if (auto === undefined) return
  pending.delete(e.requestId)
  setLfStatus({ at: new Date().toISOString(), ok: e.ok, written: e.written, count: e.count, error: e.ok ? undefined : (e.error ?? 'Something went wrong.'), unchanged: e.unchanged, auto })
})
export function updateAddon (source: string, wants: LootFilterWants, auto: boolean) {
  nextId += 1
  pending.set(nextId, auto)
  Host.sendEvent({ name: 'CLIENT->MAIN::loot-filter', payload: { requestId: nextId, op: 'make', source, wants, auto: true } })
}
