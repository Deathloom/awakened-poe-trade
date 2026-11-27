// Deathloom fork (Q17, 27 Nov 2026): build progress in one view. Pure helpers
// for the Build progress panel: where you are in the levelling trees, which of
// the step's gems you have ticked, and which of the build's items you have
// ticked as "got it" (Build → Gear). Ticks are the same ones those panels set,
// so ticking here or there is one list.
import type { PobGearItem, PobPlan, PobPlanGem, PobPlanNode } from '@ipc/types'

// shared with PobNext / PobGems (gem ticks, per character) and PobGearBody (gear ticks)
export const GEM_TICKS_KEY = 'deathloom.gem-ticks.v1'
export const GEAR_OWNED_KEY = 'deathloom.gear-owned.v1'

export type GemTicks = Record<string, string[]>
// "<build>|<item set>" -> slot -> item id
export type GearOwned = Record<string, Record<string, string>>

function readJson<T extends object> (raw: string | null): T {
  try {
    const v = JSON.parse(raw ?? '{}')
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {} as T
  } catch { return {} as T }
}
export function parseGemTicks (raw: string | null): GemTicks { return readJson<GemTicks>(raw) }
export function parseGearOwned (raw: string | null): GearOwned { return readJson<GearOwned>(raw) }

// a tick counts for the item it was set on (if the build's item changes, the tick goes)
export function gearItemId (item: Pick<PobGearItem, 'title' | 'name' | 'baseName'>): string {
  return `${item.title || item.name}|${item.baseName ?? ''}`
}
export function gearOwnedKey (buildName: string | undefined, itemSet: string | undefined): string {
  return `${buildName ?? ''}|${itemSet ?? ''}`
}
export function toggleGearOwned (all: GearOwned, key: string, item: PobGearItem): GearOwned {
  const was = all[key] ?? {}
  const on = was[item.slot] !== gearItemId(item)
  const next = Object.fromEntries(Object.entries(was).filter(([slot]) => slot !== item.slot))
  if (on) next[item.slot] = gearItemId(item)
  return { ...all, [key]: next }
}
export function toggleGemTick (all: GemTicks, owner: string, name: string): GemTicks {
  const list = new Set(all[owner] ?? [])
  if (list.has(name)) list.delete(name)
  else list.add(name)
  return { ...all, [owner]: [...list] }
}

export interface TreeProgress {
  // 1-based step and its name ("Level 30", or the final tree)
  step: number
  steps: number
  title: string
  taken: number
  total: number
  next: PobPlanNode[]
}

// taken: plan.order indexes known to be taken (game log / tree map); null = the
// plan's level-based guess (first plan.taken passives)
export function treeProgress (plan: PobPlan, taken: ReadonlySet<number> | null, nextCount = 3): TreeProgress {
  const isTaken = (i: number) => taken ? taken.has(i) : i < plan.taken
  const done = plan.order.reduce((n, _, i) => n + (isTaken(i) ? 1 : 0), 0)
  return {
    step: plan.phase,
    steps: plan.phases.length,
    title: plan.phases[plan.phase - 1]?.title ?? '',
    taken: done + plan.kept,
    total: plan.order.length + plan.kept,
    next: plan.order.filter((_, i) => !isTaken(i)).slice(0, nextCount)
  }
}

export interface GemProgress {
  have: number
  total: number
  // usable at this level and not ticked
  missing: PobPlanGem[]
  // one entry per gem name, lowest requirement first
  gems: PobPlanGem[]
}

export function gemProgress (gems: PobPlanGem[], ticked: readonly string[], level: number): GemProgress {
  const byName = new Map<string, PobPlanGem>()
  for (const g of gems) {
    const prev = byName.get(g.name)
    if (!prev || g.reqLevel < prev.reqLevel) byName.set(g.name, g)
  }
  const list = [...byName.values()].sort((a, b) => a.reqLevel - b.reqLevel || a.name.localeCompare(b.name))
  const have = new Set(ticked)
  return {
    have: list.filter(g => have.has(g.name)).length,
    total: list.length,
    missing: list.filter(g => g.reqLevel <= level && !have.has(g.name)),
    gems: list
  }
}

export interface GearProgress {
  have: number
  total: number
  items: Array<{ item: PobGearItem, owned: boolean }>
}

// weapon swap is left out: many builds keep a placeholder there
export function gearProgress (items: PobGearItem[], owned: Record<string, string> | undefined): GearProgress {
  const rows = items
    .filter(i => i.group !== 'swap')
    .map(item => ({ item, owned: owned?.[item.slot] === gearItemId(item) }))
  return { have: rows.filter(r => r.owned).length, total: rows.length, items: rows }
}

// one number for the header: each part counts the same
export function overallPercent (parts: Array<{ have: number, total: number } | null>): number | null {
  const shown = parts.filter((p): p is { have: number, total: number } => p != null && p.total > 0)
  if (!shown.length) return null
  return Math.round(shown.reduce((n, p) => n + Math.min(1, p.have / p.total), 0) / shown.length * 100)
}

// save and tell the other panels in this window too ('storage' events only reach other windows)
export function saveShared (key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { return }
  try { window.dispatchEvent(new StorageEvent('storage', { key })) } catch {}
}
