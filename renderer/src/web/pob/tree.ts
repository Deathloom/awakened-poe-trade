// Deathloom fork: passive tree tab. Compares the build's keystones, ascendancy,
// notables, masteries and jewel sockets with the character's, by name (cluster
// notables can repeat, so names are counted).

import type { PobTreeNode, PobTreeSummary } from '@ipc/types'

export type NodeStatus = 'ok' | 'missing' | 'other-effect' | 'unknown'

export interface TreeRow {
  node: PobTreeNode
  count: number
  status: NodeStatus
  // Mastery: the effect the character picked instead
  liveEffect?: string
}

export interface TreeSection {
  type: PobTreeNode['type']
  label: string
  rows: TreeRow[]
  // On the character but not in the build
  extra: Array<{ node: PobTreeNode, count: number }>
}

export interface TreeComparison {
  sections: TreeSection[]
  missingCount: number
  extraCount: number
  pointsDiff?: number
}

const SECTIONS: Array<{ type: PobTreeNode['type'], label: string }> = [
  { type: 'Keystone', label: 'Keystones' },
  { type: 'Ascendancy', label: 'Ascendancy' },
  { type: 'Notable', label: 'Notables' },
  { type: 'Mastery', label: 'Masteries' },
  { type: 'Socket', label: 'Jewel sockets' }
]

function group (nodes: PobTreeNode[], type: PobTreeNode['type']) {
  const map = new Map<string, { node: PobTreeNode, count: number, effects: string[] }>()
  for (const n of nodes) {
    if (n.type !== type) continue
    const prev = map.get(n.name)
    if (prev) {
      prev.count++
      if (n.effect) prev.effects.push(n.effect)
    } else {
      map.set(n.name, { node: n, count: 1, effects: n.effect ? [n.effect] : [] })
    }
  }
  return map
}

export function compareTrees (build: PobTreeSummary, live: PobTreeSummary | undefined): TreeComparison {
  let missingCount = 0
  let extraCount = 0
  const sections: TreeSection[] = []
  for (const { type, label } of SECTIONS) {
    const b = group(build.nodes, type)
    const l = live ? group(live.nodes, type) : null
    const rows: TreeRow[] = []
    for (const { node, count, effects } of b.values()) {
      if (!l) {
        rows.push({ node, count, status: 'unknown' })
        continue
      }
      const have = l.get(node.name)
      if (!have || have.count < count) {
        // Sockets are compared by count only, never "missing" by name
        missingCount += count - (have?.count ?? 0)
        rows.push({ node, count, status: 'missing' })
      } else if (type === 'Mastery' && effects.length && !effects.every(e => have.effects.includes(e))) {
        missingCount++
        rows.push({ node, count, status: 'other-effect', liveEffect: have.effects.find(e => !effects.includes(e)) })
      } else {
        rows.push({ node, count, status: 'ok' })
      }
    }
    const extra: TreeSection['extra'] = []
    if (l) {
      for (const { node, count } of l.values()) {
        const want = b.get(node.name)?.count ?? 0
        if (count > want) {
          extra.push({ node, count: count - want })
          extraCount += count - want
        }
      }
    }
    // Missing first, then other effect, then ok
    const order = { 'missing': 0, 'other-effect': 1, 'ok': 2, 'unknown': 2 }
    rows.sort((x, y) => order[x.status] - order[y.status] || x.node.name.localeCompare(y.node.name))
    if (rows.length || extra.length) sections.push({ type, label, rows, extra })
  }
  return {
    sections,
    missingCount,
    extraCount,
    pointsDiff: live ? live.points - build.points : undefined
  }
}
