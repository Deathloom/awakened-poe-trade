// Deathloom fork (Gerhard 19 Nov 2026): "What changes": compare the loadout you
// play now with any other loadout of the same build and list the to-dos.
// Works with every kind of build: Maxroll's straight stages, Mobalytics'
// branching variants (placeholder "New Item" gear, class switches) and a single
// poe.ninja snapshot (nothing to compare -> no options). Never guesses an order
// from names: the player picks the target. Pure logic (unit tested).

import type { PobBuildSummary, PobLoadouts, PobSetSelection } from '@ipc/types'
import { compareGear, compareGems, compareTree, type GearRow, type GemRow } from './compare'

export interface LoadoutOption {
  key: string
  label: string
  sel: PobSetSelection
  // which parts this loadout has of its own (a tree-only stage keeps the active gear / skills)
  own: { tree: boolean, items: boolean, skills: boolean }
}

const norm = (s: string) => s.trim().toLowerCase()

// PoB's named loadouts are trees / item sets / skill sets with the same title
function byTitle (list: Array<{ id: number, title: string }>, title: string): number | undefined {
  return list.find(x => norm(x.title) === norm(title))?.id
}

export function loadoutOptions (lo: PobLoadouts | null | undefined): LoadoutOption[] {
  if (!lo) return []
  if (lo.named.length > 1) {
    return lo.named.map(name => {
      const spec = byTitle(lo.trees, name)
      const itemSet = byTitle(lo.itemSets, name)
      const skillSet = byTitle(lo.skillSets, name)
      return {
        key: `n:${name}`,
        label: name,
        sel: { spec: spec ?? lo.active.spec, itemSet: itemSet ?? lo.active.itemSet, skillSet: skillSet ?? lo.active.skillSet },
        own: { tree: spec != null, items: itemSet != null, skills: skillSet != null }
      }
    })
  }
  // no named loadouts: the trees are the stages (e.g. "Level 30 / 60 / 90")
  if (lo.trees.length > 1) {
    return lo.trees.map(t => ({
      key: `t:${t.id}`,
      label: t.title || `Tree ${t.id}`,
      sel: { spec: t.id, itemSet: lo.active.itemSet, skillSet: lo.active.skillSet },
      own: { tree: true, items: false, skills: false }
    }))
  }
  return []
}

export function currentOption (lo: PobLoadouts | null | undefined, options: LoadoutOption[]): LoadoutOption | undefined {
  if (!lo) return undefined
  if (lo.active.named) {
    const named = options.find(o => o.key === `n:${lo.active.named}`)
    if (named) return named
  }
  return options.find(o => o.sel.spec === lo.active.spec && (!o.own.items || o.sel.itemSet === lo.active.itemSet)) ??
    options.find(o => o.sel.spec === lo.active.spec)
}

type Item = PobBuildSummary['items'][number]

// a guide's stand-in item: only a base (often named "New Item"), no mods
export function isPlaceholder (i: Item | undefined): boolean {
  if (!i) return false
  return i.rarity !== 'Unique' && !i.mods.length && (/^new item$/i.test(i.name) || !i.name || i.name === i.base)
}

export const WICKERMAN_SLOTS = ['Head', 'Body', 'Arm', 'Leg']

export interface GearStep {
  slot: string
  from?: string
  to?: string
  // "any <base>": the target is a guide's placeholder, so mods don't matter
  placeholder: boolean
  add: string[]
  remove: string[]
}

export interface StageChanges {
  ascendancyChanges: boolean
  classChanges: boolean
  gems: GemRow[]
  take: number[]
  refund: number[]
  masteriesChanged: number[]
  gear: GearStep[]
  wickerman: GearStep[]
  // parts that are the same set in both loadouts (nothing to do there)
  sameTree: boolean
  sameItems: boolean
  sameSkills: boolean
  nothing: boolean
}

function gearSteps (rows: GearRow[], a: PobBuildSummary, b: PobBuildSummary): GearStep[] {
  const out: GearStep[] = []
  for (const r of rows) {
    if (r.same) continue
    const ib = b.items.find(i => i.slot === r.slot)
    const ia = a.items.find(i => i.slot === r.slot)
    if (!ib) continue // the target has nothing there: keep what you have
    // Viscera are whole items with no mods of their own: never a stand-in
    const placeholder = !WICKERMAN_SLOTS.includes(r.slot) && isPlaceholder(ib)
    // same base and the target is only a stand-in: nothing to change
    if (placeholder && ia && ia.base === ib.base) continue
    out.push({
      slot: r.slot,
      from: r.a,
      to: placeholder ? `any ${ib.base}` : r.b,
      placeholder,
      add: placeholder ? [] : [...r.onlyB, ...r.aLower.map(m => m.b)],
      remove: placeholder ? [] : r.onlyA
    })
  }
  return out
}

export function stageChanges (a: PobBuildSummary, b: PobBuildSummary): StageChanges {
  const sameTree = !!a.sets?.spec && a.sets.spec === b.sets?.spec && a.tree.nodes.join() === b.tree.nodes.join()
  const sameItems = !!a.sets?.itemSet && a.sets.itemSet === b.sets?.itemSet
  const sameSkills = !!a.sets?.skillSet && a.sets.skillSet === b.sets?.skillSet
  const tree = compareTree(a, b)
  const gems = sameSkills ? [] : compareGems(a, b)
  const rows = sameItems ? [] : compareGear(a, b)
  const all = gearSteps(rows, a, b)
  const gear = all.filter(g => !WICKERMAN_SLOTS.includes(g.slot))
  const wickerman = all.filter(g => WICKERMAN_SLOTS.includes(g.slot))
  const ascendancyChanges = a.tree.ascendClassId != null && b.tree.ascendClassId != null && (a.tree.ascendClassId !== b.tree.ascendClassId || a.tree.classId !== b.tree.classId)
  const classChanges = a.tree.classId != null && b.tree.classId != null && a.tree.classId !== b.tree.classId
  const take = sameTree ? [] : tree.onlyB
  const refund = sameTree ? [] : tree.onlyA
  const masteriesChanged = sameTree ? [] : tree.masteriesChanged
  return {
    ascendancyChanges,
    classChanges,
    gems,
    take,
    refund,
    masteriesChanged,
    gear,
    wickerman,
    sameTree,
    sameItems,
    sameSkills,
    nothing: !ascendancyChanges && !classChanges && !gems.length && !take.length && !refund.length && !masteriesChanged.length && !gear.length && !wickerman.length
  }
}

// the build's Wickerman (3.30): Viscera per slot, from the build file
export function wickermanOf (s: PobBuildSummary | null | undefined): Array<{ slot: string, name: string }> {
  if (!s) return []
  return WICKERMAN_SLOTS
    .map(slot => s.items.find(i => i.slot === slot))
    .filter((i): i is Item => !!i)
    .map(i => ({ slot: i.slot, name: i.rarity === 'Unique' || i.rarity === 'Rare' ? i.name : (i.base || i.name) }))
}
