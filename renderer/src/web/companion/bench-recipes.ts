// Deathloom fork (Q9): crafting bench recipe unlocks on the campaign route.
//
// Where each recipe is comes from the campaign route itself (campaign-route.json,
// Exile Leveling's area data: the "crafting" parts with their recipe names), so
// the checklist and the guide always agree. Nothing is hand-typed here.
// The game's log (Client.txt) doesn't say when you pick a recipe up, so ticks are
// manual. Recipe unlocks are account-wide in game (every character and league
// shares them), so one list of ticks is kept on this PC, not one per character.

import type { RouteStep } from './campaign-route'

export interface BenchRecipeSpot {
  recipe: string
  zone: string
  act: number
  areaId: string
  // index into the route's steps (the guide step for this zone)
  step: number
}

// Which step/task `only` flags are shown (optional quests, bandit choice);
// campaign-route.ts onlyActive with the guide's current switches
export type OnlyFilter = (only: string | undefined) => boolean
const ALL: OnlyFilter = () => true

// Recipe names on one route step (the labyrinth's "crafting" parts have none).
// Steps and tasks the guide hides (e.g. optional quests switched off) give none.
export function stepRecipes (st: RouteStep | undefined, active: OnlyFilter = ALL): string[] {
  const out: string[] = []
  if (!st || !active(st.only)) return out
  for (const t of st.tasks) {
    if (!active(t.only)) continue
    for (const p of t.parts) {
      if (typeof p === 'string' || p.k !== 'crafting') continue
      for (const r of p.recipes ?? []) if (typeof r === 'string' && r && !out.includes(r)) out.push(r)
    }
  }
  return out
}

// Every recipe on the route, in route order, at the first place the route passes it
export function benchRecipeSpots (steps: RouteStep[], active: OnlyFilter = ALL): BenchRecipeSpot[] {
  const seen = new Set<string>()
  const out: BenchRecipeSpot[] = []
  steps.forEach((st, i) => {
    for (const recipe of stepRecipes(st, active)) {
      if (seen.has(recipe)) continue
      seen.add(recipe)
      out.push({ recipe, zone: st.zone, act: st.act, areaId: st.areaId, step: i })
    }
  })
  return out
}

// Act 11 in the route is the epilogue town (Karui Shores) after Kitava
export function actLabel (act: number): string {
  return act > 10 ? 'Epilogue' : `Act ${act}`
}

export function spotsByAct (spots: BenchRecipeSpot[]): Array<{ act: number, label: string, spots: BenchRecipeSpot[] }> {
  const groups: Array<{ act: number, label: string, spots: BenchRecipeSpot[] }> = []
  for (const s of spots) {
    let g = groups.find(x => x.act === s.act)
    if (!g) groups.push(g = { act: s.act, label: actLabel(s.act), spots: [] })
    g.spots.push(s)
  }
  return groups
}

// The next unticked recipe at or after the guide's step (null: none left ahead)
export function nextUnfound (spots: BenchRecipeSpot[], ticks: Set<string>, fromStep: number): BenchRecipeSpot | null {
  return spots.find(s => s.step >= fromStep && !ticks.has(s.recipe)) ?? null
}

// Unticked recipes in zones the guide is already past (maybe missed, maybe just not ticked)
export function passedUnfound (spots: BenchRecipeSpot[], ticks: Set<string>, fromStep: number): BenchRecipeSpot[] {
  return spots.filter(s => s.step < fromStep && !ticks.has(s.recipe))
}

export const BENCH_KEY = 'deathloom.bench-recipes.v1'

// Only plain short strings, and not too many (the list can come from a settings backup)
function clean (raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const v of raw) {
    if (typeof v === 'string' && v.length > 0 && v.length <= 120 && !out.includes(v)) out.push(v)
    if (out.length >= 300) break
  }
  return out
}

export function loadBenchTicks (): Set<string> {
  try { return new Set(clean(JSON.parse(localStorage.getItem(BENCH_KEY) ?? '[]'))) } catch { return new Set() }
}

export function saveBenchTicks (ticks: Set<string>) {
  try { localStorage.setItem(BENCH_KEY, JSON.stringify(clean([...ticks]))) } catch {}
}

// Flip one recipe (read fresh, so two windows don't undo each other's ticks)
export function toggleBenchTick (recipe: string): Set<string> {
  const t = loadBenchTicks()
  if (t.has(recipe)) t.delete(recipe)
  else t.add(recipe)
  saveBenchTicks(t)
  return loadBenchTicks()
}
