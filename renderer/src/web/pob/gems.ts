// Deathloom fork: gems menu. Compares the build's socket groups with the
// character's (both come from PoB: the build file and the live character).

import type { PobGem, PobSocketGroup, PobSocketedItem } from '@ipc/types'

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

// ---------------------------------------------------------------------------
// Gear view: socket groups per item slot, sockets and links
// ---------------------------------------------------------------------------

export type SocketColour = 'R' | 'G' | 'B' | 'W' | 'A' | 'D'

// "R-G-B W" -> [['R','G','B'], ['W']]
export function parseSockets (text: string | undefined): SocketColour[][] {
  if (!text) return []
  return text.trim().split(/\s+/)
    .map(group => group.split('-').filter(Boolean) as SocketColour[])
    .filter(group => group.length)
}

// Slots in the order the game's inventory shows them; weapon swap last
export const SLOT_ORDER = [
  'Weapon 1', 'Weapon 2', 'Helmet', 'Body Armour', 'Gloves', 'Boots',
  'Amulet', 'Ring 1', 'Ring 2', 'Ring 3', 'Belt', 'Weapon 1 Swap', 'Weapon 2 Swap'
]

export interface SocketNeeds {
  R: number
  G: number
  B: number
  // Gems that fit any socket (white gems)
  any: number
  // Biggest link group the slot needs (gems in one socket group)
  links: number
}

export interface SocketCheck {
  // Colours still missing after using white sockets
  missing: { R: number, G: number, B: number }
  // Sockets too few overall
  short: number
  // Biggest link group on the item
  links: number
  ok: boolean
}

// A group counts when it's real gear (not item-granted) and switched on
export function isShownGroup (g: PobSocketGroup) {
  return Boolean(g.slot) && g.enabled
}

export function socketNeeds (groups: PobSocketGroup[]): SocketNeeds {
  const needs: SocketNeeds = { R: 0, G: 0, B: 0, any: 0, links: 0 }
  for (const g of groups) {
    if (g.source || !g.enabled) continue
    let count = 0
    for (const gem of g.gems) {
      if (!gem.enabled) continue
      count++
      if (gem.colour === 1) needs.R++
      else if (gem.colour === 2) needs.G++
      else if (gem.colour === 3) needs.B++
      else needs.any++
    }
    needs.links = Math.max(needs.links, count)
  }
  return needs
}

// Whether an item's sockets can hold the gems (by colour count and biggest link)
export function checkSockets (needs: SocketNeeds, sockets: string | undefined): SocketCheck {
  const groups = parseSockets(sockets)
  const have = { R: 0, G: 0, B: 0, W: 0, total: 0 }
  for (const group of groups) {
    for (const c of group) {
      if (c === 'R' || c === 'G' || c === 'B' || c === 'W') have[c]++
      if (c !== 'A') have.total++
    }
  }
  let white = have.W
  const missing = { R: 0, G: 0, B: 0 }
  for (const c of ['R', 'G', 'B'] as const) {
    const short = Math.max(0, needs[c] - have[c])
    const fromWhite = Math.min(white, short)
    white -= fromWhite
    missing[c] = short - fromWhite
  }
  const total = needs.R + needs.G + needs.B + needs.any
  const short = Math.max(0, total - have.total)
  const links = groups.reduce((m, g) => Math.max(m, g.filter(c => c !== 'A').length), 0)
  return {
    missing,
    short,
    links,
    ok: !missing.R && !missing.G && !missing.B && !short && links >= needs.links
  }
}

export function needsText (n: SocketNeeds) {
  const parts = (['R', 'G', 'B'] as const).filter(c => n[c]).map(c => `${n[c]}${c}`)
  if (n.any) parts.push(`${n.any} any`)
  return parts.join(' ') + (n.links > 1 ? ` · ${n.links}L` : '')
}

export function checkText (c: SocketCheck, needs: SocketNeeds) {
  if (c.ok) return ''
  const out: string[] = []
  const miss = (['R', 'G', 'B'] as const).filter(k => c.missing[k]).map(k => `${c.missing[k]}${k}`)
  if (miss.length) out.push(`needs ${miss.join(' ')} more`)
  if (c.short) out.push(`${c.short} socket${c.short > 1 ? 's' : ''} short`)
  if (c.links < needs.links) out.push(`${c.links}L, build wants ${needs.links}L`)
  return out.join(', ')
}

export interface SlotView {
  slot: string
  item?: PobSocketedItem
  liveItem?: PobSocketedItem
  rows: GroupRow[]
  needs: SocketNeeds
  buildCheck: SocketCheck
  liveCheck?: SocketCheck
}

// Groups by slot in inventory order. Hidden: groups with no slot (PoB uses them
// for damage calculations, e.g. auras from party members) and groups switched off.
export function bySlot (
  comparison: GemsComparison,
  items: PobSocketedItem[],
  liveItems: PobSocketedItem[] | undefined
): { slots: SlotView[], hidden: GroupRow[] } {
  const bySlotName = new Map<string, GroupRow[]>()
  const hidden: GroupRow[] = []
  for (const row of comparison.groups) {
    if (!isShownGroup(row.group)) {
      hidden.push(row)
      continue
    }
    const list = bySlotName.get(row.group.slot!) ?? []
    list.push(row)
    bySlotName.set(row.group.slot!, list)
  }
  const slotNames = [...bySlotName.keys()]
  slotNames.sort((a, b) => {
    const ia = SLOT_ORDER.indexOf(a)
    const ib = SLOT_ORDER.indexOf(b)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b)
  })
  const slots = slotNames.map(slot => {
    const rows = bySlotName.get(slot)!
    const needs = socketNeeds(rows.map(r => r.group))
    const item = items.find(i => i.slot === slot)
    const liveItem = liveItems?.find(i => i.slot === slot)
    return {
      slot,
      item,
      liveItem,
      rows,
      needs,
      buildCheck: checkSockets(needs, item?.sockets),
      liveCheck: liveItems ? checkSockets(needs, liveItem?.sockets) : undefined
    }
  })
  return { slots, hidden }
}
