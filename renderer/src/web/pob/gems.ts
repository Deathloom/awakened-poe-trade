// Deathloom fork: gems menu. Compares the build's socket groups with the
// character's (both come from PoB: the build file and the live character).

import type { PobGem, PobSocketGroup } from '@ipc/types'

export type GemStatus = 'ok' | 'low' | 'missing' | 'unknown'

export interface GemRow {
  gem: PobGem
  status: GemStatus
  // What the character has, when it differs
  have?: { level?: number, quality?: number, slot?: string }
}

export interface GroupRow {
  group: PobSocketGroup
  gems: GemRow[]
  // Gems in the character's matching group that the build doesn't use
  extra: PobGem[]
  // Slot the character has this group in, if different
  liveSlot?: string
  matched: boolean
}

export interface GemsComparison {
  groups: GroupRow[]
  // Character groups that match nothing in the build
  unmatched: PobSocketGroup[]
  missingCount: number
  lowCount: number
}

function key (name: string) {
  return name.toLowerCase().replace(/ support$/, '').trim()
}

function overlap (a: PobSocketGroup, b: PobSocketGroup) {
  const names = new Set(a.gems.map(g => key(g.name)))
  return b.gems.filter(g => names.has(key(g.name))).length
}

// Pick the character's group for each build group: same slot and most shared
// gems first, then most shared gems anywhere. Each character group is used once.
function matchGroups (build: PobSocketGroup[], live: PobSocketGroup[]) {
  const used = new Set<number>()
  const result = new Map<PobSocketGroup, PobSocketGroup>()
  const candidates: Array<{ b: PobSocketGroup, l: PobSocketGroup, score: number }> = []
  for (const b of build) {
    for (const l of live) {
      const shared = overlap(b, l)
      if (!shared) continue
      candidates.push({ b, l, score: shared * 10 + (b.slot && b.slot === l.slot ? 5 : 0) })
    }
  }
  candidates.sort((x, y) => y.score - x.score)
  for (const { b, l } of candidates) {
    if (result.has(b) || used.has(l.index)) continue
    result.set(b, l)
    used.add(l.index)
  }
  return { result, used }
}

export function compareGems (build: PobSocketGroup[], live: PobSocketGroup[] | undefined): GemsComparison {
  // Item-granted skills (source set) can't be socketed; they're shown but not compared
  const real = build.filter(g => !g.source)
  const liveReal = (live ?? []).filter(g => !g.source)
  const { result, used } = live
    ? matchGroups(real, liveReal)
    : { result: new Map<PobSocketGroup, PobSocketGroup>(), used: new Set<number>() }
  let missingCount = 0
  let lowCount = 0

  // Any gem the character has, for "socketed elsewhere"
  const anywhere = new Map<string, { gem: PobGem, slot?: string }>()
  for (const l of liveReal) {
    for (const g of l.gems) {
      const k = key(g.name)
      const prev = anywhere.get(k)
      if (!prev || (g.level ?? 0) > (prev.gem.level ?? 0)) anywhere.set(k, { gem: g, slot: l.slot })
    }
  }

  const groups: GroupRow[] = build.map(group => {
    const match = result.get(group)
    const liveGems = new Map((match?.gems ?? []).map(g => [key(g.name), g]))
    const gems: GemRow[] = group.gems.map(gem => {
      if (!live || group.source) return { gem, status: 'unknown' }
      const k = key(gem.name)
      const have = liveGems.get(k)
      const elsewhere = have ? undefined : anywhere.get(k)
      const found = have ?? elsewhere?.gem
      if (!found) {
        if (gem.enabled && group.enabled) missingCount++
        return { gem, status: 'missing' }
      }
      const low = (gem.level ?? 0) > (found.level ?? 0) || (gem.quality ?? 0) > (found.quality ?? 0)
      if (low && gem.enabled && group.enabled) lowCount++
      return {
        gem,
        status: low ? 'low' : 'ok',
        have: (low || elsewhere)
          ? { level: found.level, quality: found.quality, slot: elsewhere?.slot }
          : undefined
      }
    })
    const buildNames = new Set(group.gems.map(g => key(g.name)))
    return {
      group,
      gems,
      extra: (match?.gems ?? []).filter(g => !buildNames.has(key(g.name))),
      liveSlot: match && match.slot !== group.slot ? match.slot : undefined,
      matched: Boolean(match)
    }
  })

  return {
    groups,
    unmatched: liveReal.filter(l => !used.has(l.index)),
    missingCount,
    lowCount
  }
}
