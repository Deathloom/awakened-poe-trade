// Deathloom fork (Q12): Viscera planner (3.30 Covens). Data from Path of Building
// 2.69 (tools/gen-viscera.py -> viscera-data.json); prices from the poe.ninja
// "viscera" overview the app already downloads. Pure logic, tested in tests/logic.

export type VisceraSlot = 'head' | 'body' | 'arm' | 'leg'

export interface Viscera {
  name: string
  base: string
  slot: VisceraSlot
  // readable label from PoB's base id (not always the exact in-game name)
  boss: string
  // 1 Lesser, 2 plain, 3 Greater (bases with only one kind are 2)
  tier: 1 | 2 | 3
  mods: string[]
}

export const SLOTS: Array<{ id: VisceraSlot, label: string }> = [
  { id: 'head', label: 'Head' },
  { id: 'body', label: 'Body' },
  { id: 'arm', label: 'Arm' },
  { id: 'leg', label: 'Leg' }
]

export const TIER_LABEL = ['', 'Lesser', 'Plain', 'Greater'] as const

export type PriceOf = (name: string) => number | null

export interface VisceraRow extends Viscera {
  chaos: number | null
}

// the build file's slot ("Head", "Arm") -> ours
export function slotOf (pobSlot: string): VisceraSlot | null {
  const s = pobSlot.toLowerCase()
  return (SLOTS.some(x => x.id === s) ? s : null) as VisceraSlot | null
}

// poe.ninja names -> lowest price (a name can be listed more than once)
export function priceIndex (listings: Array<{ category: string, name: string, chaos: number }>): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of listings) {
    if (l.category !== 'viscera' || !Number.isFinite(l.chaos) || l.chaos < 0) continue
    const had = m.get(l.name)
    if (had == null || l.chaos < had) m.set(l.name, l.chaos)
  }
  return m
}

function priced (v: Viscera, priceOf: PriceOf): VisceraRow {
  return { ...v, chaos: priceOf(v.name) }
}

// priced first (cheapest first), then the rest by name
function byPrice (a: VisceraRow, b: VisceraRow) {
  if (a.chaos != null && b.chaos != null) return a.chaos - b.chaos || a.name.localeCompare(b.name)
  if (a.chaos != null) return -1
  if (b.chaos != null) return 1
  return a.name.localeCompare(b.name)
}

// Browse: one slot (or all), words must all appear in the name, boss or mods
export function browse (data: Viscera[], slot: VisceraSlot | 'all', query: string, priceOf: PriceOf, limit = 80): VisceraRow[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return data
    .filter(v => slot === 'all' || v.slot === slot)
    .filter(v => {
      if (!words.length) return true
      const hay = `${v.name} ${v.boss} ${v.mods.join(' ')}`.toLowerCase()
      return words.every(w => hay.includes(w))
    })
    .map(v => priced(v, priceOf))
    .sort(byPrice)
    .slice(0, limit)
}

export interface PlanStep {
  slot: VisceraSlot
  // what the build plans; null when the build names something PoB's data doesn't have
  want: VisceraRow | null
  wantName: string
  // other tiers of the same body part (cheaper or dearer), cheapest first
  others: VisceraRow[]
  // what to do: buy it, or farm the boss with a Fate when it isn't on poe.ninja
  how: 'buy' | 'farm' | 'unknown'
}

// planned: from the build file (wickermanOf); slot names as PoB writes them
export function planSteps (planned: Array<{ slot: string, name: string }>, data: Viscera[], priceOf: PriceOf): PlanStep[] {
  const out: PlanStep[] = []
  for (const p of planned) {
    const slot = slotOf(p.slot)
    if (!slot) continue
    const hit = data.find(v => v.name === p.name && v.slot === slot) ?? data.find(v => v.name === p.name)
    const want = hit ? priced(hit, priceOf) : null
    const others = hit
      ? data.filter(v => v.base === hit.base && v !== hit && v.name !== hit.name).map(v => priced(v, priceOf)).sort(byPrice)
      : []
    out.push({
      slot,
      want,
      wantName: p.name,
      others,
      how: !want ? 'unknown' : want.chaos != null ? 'buy' : 'farm'
    })
  }
  return out
}

// total to buy the plan (priced ones only) and how many have no price
export function planCost (steps: PlanStep[]): { chaos: number, unpriced: number } {
  let chaos = 0
  let unpriced = 0
  for (const s of steps) {
    if (s.want?.chaos != null) chaos += s.want.chaos
    else unpriced++
  }
  return { chaos, unpriced }
}
