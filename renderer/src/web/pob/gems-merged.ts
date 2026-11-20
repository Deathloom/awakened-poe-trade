// Deathloom fork: one Gems view (Gerhard 19 Nov 2026). Merges "For my level"
// (levelling plan, stages, take out / socket) with "Whole build" (gear pieces,
// link groups, sockets). "Equipped" comes from your ticks or from your
// character's file (Path of Building import). Pure: tested in tests/.

import type { PobPlanGem } from '@ipc/types'
import type { GroupRow } from './gems'

export type Source = 'ticks' | 'mine'
// have ✓, low ◐ (lower level/quality), missing ○, locked 🔒 (level too low), unknown (no source)
export type MergedStatus = 'have' | 'low' | 'missing' | 'locked' | 'unknown'

export interface MergedGem {
  name: string
  support: boolean
  colour?: number
  level?: number
  quality?: number
  enabled: boolean
  status: MergedStatus
  reqLevel?: number
  have?: { level?: number, quality?: number, slot?: string }
}

export interface ChangeNow {
  takeOut: string[]
  socket: Array<{ name: string, slot?: string, support: boolean, colour?: number }>
  levelUp: Array<{ name: string, have: string, want: string }>
  total: number
}

export const gemKey = (name: string) => name.toLowerCase().replace(/ support$/, '').trim()

export interface MergeInput {
  // compareGems(...).groups for the groups to show (character's groups when source = mine)
  rows: GroupRow[]
  level: number
  // lowest character level each gem can be used at (from the levelling plan)
  reqLevels: Map<string, number>
  source: Source
  // ticked gem names (source = ticks)
  ticks: Set<string>
  // character file read (source = mine)
  mineReady: boolean
}

export function gemStatus (row: GroupRow['gems'][number], input: MergeInput): MergedGem {
  const g = row.gem
  const req = input.reqLevels.get(gemKey(g.name))
  const base = { name: g.name, support: g.support, colour: g.colour, level: g.level, quality: g.quality, enabled: g.enabled, reqLevel: req }
  if (input.source === 'ticks') {
    if (input.ticks.has(g.name)) return { ...base, status: 'have' }
    if (req != null && req > input.level) return { ...base, status: 'locked' }
    return { ...base, status: 'missing' }
  }
  if (!input.mineReady) {
    return { ...base, status: req != null && req > input.level ? 'locked' : 'unknown' }
  }
  if (row.status === 'ok') return { ...base, status: 'have', have: row.have }
  if (row.status === 'low') return { ...base, status: 'low', have: row.have }
  if (req != null && req > input.level) return { ...base, status: 'locked' }
  return { ...base, status: row.status === 'missing' ? 'missing' : 'unknown' }
}

export function mergedRows (input: MergeInput) {
  return input.rows.map(r => ({ row: r, gems: r.gems.map(g => gemStatus(g, input)) }))
}

// is the gem equipped, by the chosen source
export function equippedBy (input: MergeInput, charGems: Set<string>) {
  return (name: string) => input.source === 'ticks'
    ? input.ticks.has(name)
    : input.mineReady && charGems.has(gemKey(name))
}

// The "Change now" box: take out (equipped but the stage doesn't use it),
// socket (usable now, not equipped), level up (character has it lower).
export function changeNow (
  input: MergeInput,
  opts: {
    // plan gems usable now (current stage / skill set), any order, duplicates ok
    now: PobPlanGem[]
    // plan gems earlier stages used that this one doesn't
    drop: PobPlanGem[]
    // character's gem names (gemKey), source = mine
    charGems: Set<string>
  }
): ChangeNow {
  const has = equippedBy(input, opts.charGems)
  const known = input.source === 'ticks' || input.mineReady
  const seen = new Set<string>()
  const socket: ChangeNow['socket'] = []
  if (known) {
    // with a plan: its gems; without one, the gear pieces' missing gems
    const list = opts.now.length
      ? opts.now.filter(g => g.reqLevel <= input.level).map(g => ({ name: g.name, slot: g.slot, support: g.support, colour: g.colour }))
      : mergedRows(input).flatMap(r => r.row.group.enabled
          ? r.gems.filter(g => g.enabled && g.status === 'missing').map(g => ({ name: g.name, slot: r.row.group.slot, support: g.support, colour: g.colour }))
          : [])
    for (const g of list) {
      const k = gemKey(g.name)
      if (seen.has(k) || has(g.name)) continue
      seen.add(k)
      socket.push(g)
    }
  }
  const takeOut = known ? [...new Set(opts.drop.map(g => g.name))].filter(n => has(n)) : []
  const levelUp: ChangeNow['levelUp'] = []
  if (input.source === 'mine' && input.mineReady) {
    const done = new Set<string>()
    for (const r of mergedRows(input)) {
      if (!r.row.group.enabled) continue
      for (const g of r.gems) {
        if (g.status !== 'low' || !g.enabled || done.has(gemKey(g.name))) continue
        done.add(gemKey(g.name))
        levelUp.push({ name: g.name, have: `${g.have?.level ?? '?'}/${g.have?.quality ?? 0}`, want: `${g.level ?? '?'}/${g.quality ?? 0}` })
      }
    }
  }
  return { takeOut, socket, levelUp, total: takeOut.length + socket.length + levelUp.length }
}

export function countStatus (rows: ReturnType<typeof mergedRows>) {
  const c = { have: 0, low: 0, missing: 0, locked: 0, unknown: 0 }
  const seen = new Set<string>()
  for (const r of rows) {
    if (!r.row.group.enabled) continue
    for (const g of r.gems) {
      if (!g.enabled || seen.has(gemKey(g.name))) continue
      seen.add(gemKey(g.name))
      c[g.status]++
    }
  }
  return c
}
