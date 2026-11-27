// Deathloom fork (layout review 27 Nov 2026): sub-tabs of the Orbhoarder
// window's top tabs (Reference → Recipes, Trade → Trade site, …), and the old
// tab names hotkeys, buttons and saved views still use. Each window keeps its
// own sub-tab per tab, like its top tab.
import { computed, reactive, type WritableComputedRef } from 'vue'
import { readWindowKey, windowKey } from '@/web/hud/is-hud'

const subs = reactive<Record<string, string>>({})
const subKey = (view: string) => `deathloom.desktop-sub.${view}.v1`

export function setSub (view: string, sub: string) {
  subs[view] = sub
  try { localStorage.setItem(windowKey(subKey(view)), sub) } catch {}
}

export function hasSavedSub (view: string): boolean {
  try { return readWindowKey(subKey(view)) != null } catch { return false }
}

export function useSubTab<T extends string> (view: string, ids: readonly T[], def: T): WritableComputedRef<T> {
  if (!(view in subs)) {
    let saved: string | null = null
    try { saved = readWindowKey(subKey(view)) } catch {}
    subs[view] = saved ?? def
  }
  return computed<T>({
    get: () => ids.includes(subs[view] as T) ? subs[view] as T : def,
    set: (v) => { setSub(view, v) }
  })
}

// old top tab → [new top tab, sub-tab]; also what main and the overlay still send
export const LEGACY_VIEWS: Record<string, [string, string?]> = {
  guide: ['levelling', 'guide'],
  next: ['levelling', 'guide'],
  help: ['reference', 'help'],
  cheats: ['reference', 'sheets'],
  money: ['profit'],
  trades: ['trade', 'whispers'],
  search: ['trade', 'search'],
  site: ['trade', 'site'],
  board: ['friends', 'board'],
  sharing: ['friends', 'sharing'],
  atlas: ['mapping', 'atlas'],
  session: ['mapping', 'session'],
  farm: ['mapping', 'farm'],
  mods: ['mapping', 'mods'],
  lab: ['levelling', 'lab'],
  progress: ['build', 'progress']
}

export function resolveView (v: string, known: (v: string) => boolean): { view: string, sub?: string } | null {
  const legacy = LEGACY_VIEWS[v]
  if (legacy && known(legacy[0])) return { view: legacy[0], sub: legacy[1] }
  return known(v) ? { view: v } : null
}
