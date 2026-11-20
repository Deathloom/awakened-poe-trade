// Deathloom fork (idea 6): compare two PoB builds (Build gear → Compare builds).
// Pure: takes the two build summaries main read from the files.

import type { PobBuildSummary } from '@ipc/types'

// PoB's PlayerStat names worth showing, in order; higher is better unless noted
export const COMPARE_STATS: Array<{ stat: string, label: string, pct?: boolean, lowerBetter?: boolean }> = [
  { stat: 'CombinedDPS', label: 'Combined DPS' },
  { stat: 'TotalDPS', label: 'Hit DPS' },
  { stat: 'TotalDotDPS', label: 'DoT DPS' },
  { stat: 'Life', label: 'Life' },
  { stat: 'EnergyShield', label: 'Energy shield' },
  { stat: 'Mana', label: 'Mana' },
  { stat: 'TotalEHP', label: 'Effective HP' },
  { stat: 'Armour', label: 'Armour' },
  { stat: 'Evasion', label: 'Evasion' },
  { stat: 'BlockChance', label: 'Block', pct: true },
  { stat: 'SpellSuppressionChance', label: 'Spell suppression', pct: true },
  { stat: 'FireResist', label: 'Fire res', pct: true },
  { stat: 'ColdResist', label: 'Cold res', pct: true },
  { stat: 'LightningResist', label: 'Lightning res', pct: true },
  { stat: 'ChaosResist', label: 'Chaos res', pct: true },
  { stat: 'EffectiveMovementSpeedMod', label: 'Movement speed' }
]

export interface StatRow { stat: string, label: string, a?: number, b?: number, diff?: number, better?: 'a' | 'b', pct?: boolean }
export interface GearRow {
  slot: string
  same: boolean
  a?: string
  b?: string
  // Deathloom fork (19 Nov): mods matched by their wording (numbers left out), so
  // "+70 to maximum Life" vs "+90 to maximum Life" is one line with two values
  both: string[]
  // same mod, A's value is higher / lower than B's
  aHigher: Array<{ a: string, b: string }>
  aLower: Array<{ a: string, b: string }>
  onlyA: string[]
  onlyB: string[]
}

const NUM = /[+-]?\d+(?:\.\d+)?/g
export function modTemplate (m: string): string { return m.replace(NUM, '#').trim().toLowerCase() }
function modValue (m: string): number {
  const n = (m.match(NUM) ?? []).map(Number)
  return n.length ? n.reduce((s, v) => s + Math.abs(v), 0) / n.length : 0
}
// mods that are better when smaller ("increased Mana Cost", "increased Attribute Requirements", "Damage taken")
const LOWER_BETTER = /\b(increased|more)\b.*\b(mana cost|requirements|damage taken)\b/i

export function matchMods (aMods: string[], bMods: string[]): Pick<GearRow, 'both' | 'aHigher' | 'aLower' | 'onlyA' | 'onlyB'> {
  const out = { both: [] as string[], aHigher: [] as Array<{ a: string, b: string }>, aLower: [] as Array<{ a: string, b: string }>, onlyA: [] as string[], onlyB: [] as string[] }
  const rest = [...bMods]
  for (const ma of aMods) {
    const exact = rest.indexOf(ma)
    if (exact >= 0) { out.both.push(ma); rest.splice(exact, 1); continue }
    const t = modTemplate(ma)
    const i = rest.findIndex(mb => modTemplate(mb) === t)
    if (i < 0) { out.onlyA.push(ma); continue }
    const mb = rest.splice(i, 1)[0]
    const va = modValue(ma)
    const vb = modValue(mb)
    const aBetter = LOWER_BETTER.test(ma) ? va < vb : va > vb
    if (va === vb) out.both.push(ma)
    else (aBetter ? out.aHigher : out.aLower).push({ a: ma, b: mb })
  }
  out.onlyB.push(...rest)
  return out
}
export interface GemRow { name: string, a?: number, b?: number, change: 'added' | 'removed' | 'level' }
export interface TreeDiff { onlyA: number[], onlyB: number[], same: number, masteriesChanged: number[], versionA?: string, versionB?: string }

export interface BuildCompare {
  stats: StatRow[]
  gear: GearRow[]
  gems: GemRow[]
  tree: TreeDiff
}

export function compareStats (a: PobBuildSummary, b: PobBuildSummary): StatRow[] {
  const rows: StatRow[] = []
  for (const s of COMPARE_STATS) {
    const va = a.stats[s.stat]
    const vb = b.stats[s.stat]
    if (va == null && vb == null) continue
    const row: StatRow = { stat: s.stat, label: s.label, a: va, b: vb, pct: s.pct }
    if (va != null && vb != null) {
      row.diff = vb - va
      if (Math.abs(row.diff) > 1e-6) {
        const bBetter = s.lowerBetter ? vb < va : vb > va
        row.better = bBetter ? 'b' : 'a'
      }
    }
    rows.push(row)
  }
  return rows
}

function itemLabel (i: PobBuildSummary['items'][number]): string {
  return i.rarity === 'Unique' || i.rarity === 'Rare' ? `${i.name} (${i.base})` : i.base || i.name
}

export function compareGear (a: PobBuildSummary, b: PobBuildSummary): GearRow[] {
  const slots: string[] = []
  for (const i of [...a.items, ...b.items]) if (!slots.includes(i.slot)) slots.push(i.slot)
  return slots.map(slot => {
    const ia = a.items.find(i => i.slot === slot)
    const ib = b.items.find(i => i.slot === slot)
    const m = matchMods(ia?.mods ?? [], ib?.mods ?? [])
    const same = !!ia && !!ib && ia.name === ib.name && ia.base === ib.base && !m.onlyA.length && !m.onlyB.length && !m.aHigher.length && !m.aLower.length
    return { slot, same, a: ia && itemLabel(ia), b: ib && itemLabel(ib), ...m }
  })
}

// enabled gems by name, highest level if a gem is in several groups
function gemLevels (s: PobBuildSummary): Map<string, number> {
  const out = new Map<string, number>()
  for (const g of s.groups) {
    if (!g.enabled) continue
    for (const gem of g.gems) {
      if (!gem.enabled) continue
      out.set(gem.name, Math.max(out.get(gem.name) ?? 0, gem.level ?? 0))
    }
  }
  return out
}

export function compareGems (a: PobBuildSummary, b: PobBuildSummary): GemRow[] {
  const ga = gemLevels(a)
  const gb = gemLevels(b)
  const rows: GemRow[] = []
  for (const [name, lv] of gb) {
    if (!ga.has(name)) rows.push({ name, b: lv, change: 'added' })
    else if (ga.get(name) !== lv) rows.push({ name, a: ga.get(name), b: lv, change: 'level' })
  }
  for (const [name, lv] of ga) if (!gb.has(name)) rows.push({ name, a: lv, change: 'removed' })
  const order = { removed: 0, added: 1, level: 2 }
  return rows.sort((x, y) => order[x.change] - order[y.change] || x.name.localeCompare(y.name))
}

export function compareTree (a: PobBuildSummary, b: PobBuildSummary): TreeDiff {
  const na = new Set(a.tree.nodes)
  const nb = new Set(b.tree.nodes)
  const onlyA = [...na].filter(n => !nb.has(n)).sort((x, y) => x - y)
  const onlyB = [...nb].filter(n => !na.has(n)).sort((x, y) => x - y)
  const masteriesChanged = Object.keys(b.tree.masteries)
    .filter(id => na.has(Number(id)) && a.tree.masteries[id] != null && a.tree.masteries[id] !== b.tree.masteries[id])
    .map(Number)
  return { onlyA, onlyB, same: [...na].filter(n => nb.has(n)).length, masteriesChanged, versionA: a.tree.version, versionB: b.tree.version }
}

export function compareBuilds (a: PobBuildSummary, b: PobBuildSummary): BuildCompare {
  return { stats: compareStats(a, b), gear: compareGear(a, b), gems: compareGems(a, b), tree: compareTree(a, b) }
}

export function fmtStat (v: number | undefined, pct?: boolean): string {
  if (v == null || !Number.isFinite(v)) return '–'
  if (pct) return `${Math.round(v)}%`
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`
  if (Math.abs(v) >= 1e4) return `${(v / 1e3).toFixed(1)}k`
  return String(Math.round(v * 100) / 100)
}
