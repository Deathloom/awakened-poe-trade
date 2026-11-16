// Deathloom fork (Gerhard, 16 Nov 2026): "Craft this" from the build's gear.
// Matches a PoB item's mods to the Craft tab's mod pool and works out a plan:
// which base and item level, which method rolls the random mods most cheaply,
// what to add afterwards, and the bench crafts last. Pure logic (unit tested).

import { simulate, tiersOf, singleModChanceOneRoll, type Method, type SimMod, type SimPool, type SimResult, type Want } from './craft-sim'

export interface PlanMod extends SimMod { text: string[] }
export interface ItemModLine { text: string, kind: string, crafted?: boolean }

// "+(80-89) to maximum Life" / "+85 to maximum Life" -> "+# to maximum life"
export function skeleton (line: string): string {
  return line.toLowerCase().replace(/\((-?[\d.]+)-(-?[\d.]+)\)/g, '#').replace(/-?\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ').trim()
}
// numbers of an item line, in order
function numbers (line: string): number[] {
  return [...line.matchAll(/-?\d+(\.\d+)?/g)].map(m => Number(m[0]))
}
// ranges of a pool line: "(80-89)" -> [80, 89]; a fixed number -> [n, n]
function ranges (line: string): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const re = /\((-?[\d.]+)-(-?[\d.]+)\)|(-?\d+(?:\.\d+)?)/g
  for (const m of line.matchAll(re)) {
    if (m[1] != null) out.push([Number(m[1]), Number(m[2])])
    else out.push([Number(m[3]), Number(m[3])])
  }
  return out
}
function lineFits (poolLine: string, value: number[]): boolean {
  const r = ranges(poolLine)
  if (r.length !== value.length) return false
  return r.every(([a, b], i) => value[i] >= Math.min(a, b) - 0.001 && value[i] <= Math.max(a, b) + 0.001)
}

export interface Matched {
  // wanted: this group at tier `tier` or better
  wants: Array<{ group: string, tier: number, type: 'Prefix' | 'Suffix', text: string[] }>
  crafted: string[]
  // explicit lines not in this base's pool (fractured, veiled, eldritch, influence not picked, …)
  unmatched: string[]
  // implicits / enchants: not part of crafting
  other: string[]
  // lowest item level that can roll every wanted tier
  ilvl: number
}

export function matchItemMods (mods: PlanMod[], lines: ItemModLine[]): Matched {
  const out: Matched = { wants: [], crafted: [], unmatched: [], other: [], ilvl: 1 }
  const explicit: string[] = []
  for (const l of lines) {
    if (l.kind !== 'explicit') out.other.push(l.text)
    else if (l.crafted) out.crafted.push(l.text)
    else explicit.push(l.text)
  }
  const left = explicit.map(t => ({ t, sk: skeleton(t), used: false }))
  // groups with more lines first (hybrid mods take both of their lines)
  const groups = [...new Set(mods.map(m => m.group))]
    .map(g => tiersOf(mods, g) as PlanMod[])
    .sort((a, b) => b[0].text.length - a[0].text.length)
  for (const tiers of groups) {
    const lineSk = tiers[0].text.map(skeleton)
    const hit = lineSk.map(sk => left.find(x => !x.used && x.sk === sk))
    if (hit.some(h => !h)) continue
    // the tier whose ranges hold the item's numbers (best tier first)
    let tier = tiers.findIndex(t => t.text.every((line, i) => lineFits(line, numbers(hit[i]!.t))))
    if (tier < 0) tier = tiers.length - 1 // numbers out of range (divined / changed): lowest tier
    for (const h of hit) h!.used = true
    const t = tiers[tier]
    out.wants.push({ group: t.group, tier: tier + 1, type: t.type, text: hit.map(h => h!.t) })
    out.ilvl = Math.max(out.ilvl, t.level)
  }
  out.unmatched = left.filter(x => !x.used).map(x => x.t)
  return out
}

export interface PlanStep {
  kind: 'base' | 'roll' | 'add' | 'bench' | 'finish' | 'note'
  text: string
  // roll: the simulated result
  result?: SimResult
  mods?: string[]
}

export interface PlanInput {
  pool: SimPool
  wants: Array<Want & { type: 'Prefix' | 'Suffix', label: string }>
  // essences that can be used: their mod id and group
  essences: Array<{ modId: string, group: string, name: string, type: 'Prefix' | 'Suffix' }>
  baseName: string
  ilvl: number
  crafted: string[]
  // chaos cost of a try (undefined = unknown)
  cost?: (r: SimResult, essenceName?: string) => number | undefined
  trials?: number
  random?: () => number
}

// Try the methods on all wanted mods; when nothing hits, roll for the rarest
// ones and add the others after. The cheapest method that hits wins.
export function buildPlan (inp: PlanInput): PlanStep[] {
  const trials = inp.trials ?? 20000
  const steps: PlanStep[] = []
  steps.push({ kind: 'base', text: `Get a ${inp.baseName}, item level ${Math.max(inp.ilvl, 1)} or higher (the best tier you want needs it). Normal (white) is best; Orb of Scouring makes one.` })
  if (!inp.wants.length) {
    if (inp.crafted.length) addBench(steps, inp.crafted)
    steps.push({ kind: 'note', text: 'Nothing to roll: the item has no random mods this base can get.' })
    return steps
  }
  // rarest first: what the plan rolls for when it can't get everything at once
  const rarity = (w: Want) => singleModChanceOneRoll(inp.pool, w)
  const sorted = [...inp.wants].sort((a, b) => rarity(a) - rarity(b))
  type Try = { method: Method, essence?: typeof inp.essences[number], result: SimResult, cost: number }
  const attempt = (wants: typeof sorted): Try | null => {
    const tries: Try[] = []
    const methods: Method[] = ['chaos', 'alt', 'altRegal']
    for (const m of methods) {
      const r = simulate(inp.pool, wants, { method: m, trials, random: inp.random })
      if (!r.impossible && r.hits) tries.push({ method: m, result: r, cost: inp.cost?.(r) ?? r.attempts * costGuess(m) })
    }
    for (const e of inp.essences) {
      const w = wants.find(x => x.group === e.group)
      if (!w) continue
      const pool = { ...inp.pool, mods: [...inp.pool.mods, { id: e.modId, type: e.type, group: e.group, level: 0, weight: 0 }] }
      const ws = wants.map(x => x === w ? { ...x, ids: [...x.ids, e.modId] } : x)
      const r = simulate(pool, ws, { method: 'essence', essenceModId: e.modId, trials, random: inp.random })
      if (!r.impossible && r.hits) tries.push({ method: 'essence', essence: e, result: r, cost: inp.cost?.(r, e.name) ?? r.attempts * 3 })
    }
    tries.sort((a, b) => a.cost - b.cost)
    return tries[0] ?? null
  }
  let rolled = sorted.length
  let best: Try | null = null
  for (; rolled >= 1; rolled--) {
    best = attempt(sorted.slice(0, rolled))
    if (best) break
  }
  if (!best) {
    steps.push({ kind: 'note', text: 'None of the methods here (Chaos, Alteration, Regal, Essence) got even the rarest mod in the simulation. Fossils or Harvest may be needed: not covered yet.' })
  } else {
    const label = best.method === 'essence'
      ? `Use ${best.essence!.name} on it (it always gives its mod), again and again`
      : best.method === 'chaos' ? 'Make it rare (Orb of Alchemy), then Chaos Orb'
        : best.method === 'alt' ? 'Make it magic (Orb of Transmutation), then Orb of Alteration (+ Orb of Augmentation when it has one mod)'
          : 'Make it magic, Alteration/Augmentation until it has the first two, then a Regal Orb for the third (Scour and start over if the Regal misses)'
    steps.push({
      kind: 'roll',
      text: `${label} until it has: ${sorted.slice(0, rolled).map(w => w.label).join(', ')}.`,
      result: best.result,
      mods: sorted.slice(0, rolled).map(w => w.label)
    })
  }
  // the rest: one at a time with Exalted Orbs (needs a free prefix / suffix)
  const rest = best ? sorted.slice(rolled) : []
  if (best?.method === 'alt' && rest.length) {
    steps.push({ kind: 'add', text: 'Regal Orb to make it rare (adds one random mod).' })
  }
  for (const w of rest) {
    const p = rarity(w)
    const tries = p > 0 ? Math.ceil(1 / p) : Infinity
    steps.push({
      kind: 'add',
      text: `Exalted Orb for ${w.label} (needs a free ${w.type.toLowerCase()}; about 1 in ${isFinite(tries) ? tries : '∞'} per Exalt). Cheaper and safer: if the bench can craft it, craft it instead; or buy a base that already has it.`,
      mods: [w.label]
    })
  }
  if (rest.length) {
    steps.push({ kind: 'note', text: 'Tip: before an Exalt, "Prefixes Cannot Be Changed" / "Suffixes Cannot Be Changed" (bench) keeps what you have when you clean up with a Scour; Orb of Annulment removes one random mod if the Exalt missed.' })
  }
  if (inp.crafted.length) addBench(steps, inp.crafted)
  steps.push({ kind: 'finish', text: 'Last: Divine Orb rerolls the numbers if you want higher rolls (keeps the mods).' })
  return steps
}

function addBench (steps: PlanStep[], crafted: string[]) {
  steps.push({
    kind: 'bench',
    text: `Bench craft last (crafting earlier gets removed by the next roll): ${crafted.join('; ')}. Needs a free prefix or suffix. More than one crafted mod needs "Can have up to 3 Crafted Modifiers".`,
    mods: crafted
  })
}

// rough chaos value of one try when there are no prices (Alteration ~1/8 c, Regal ~1 c per ~3 tries)
function costGuess (m: Method): number {
  return m === 'chaos' ? 1 : m === 'alt' ? 0.15 : 0.6
}
