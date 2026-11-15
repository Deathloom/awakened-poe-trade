// Deathloom fork: gem stages written into the build's skill list in Path of
// Building. Many guides label socket groups with level ranges and separate them
// with lines, e.g.
//   1-27 Rolling Magma            (a label-only group: starts a stage)
//   Rolling Magma / Holy Flame Totem / …
//   ----------------------        (ends the stage)
//   28-31 Firestorm (replace Rolling Magma)
//   …
//   31+ Storm Burst Totem swap
// Groups after a header belong to that stage until the next line or header.
// Groups outside any stage are used the whole time.
import type { PobSocketGroup } from '@ipc/types'
import { pobText } from './labels'

export interface GemStage {
  title: string
  from: number
  to: number
  // socket group indexes in the stage
  groups: number[]
}

const RANGE = /^\s*(?:lv?l?\.?\s*|level\s*)?(\d{1,3})\s*(?:-|–|—|to)\s*(\d{1,3})(?!\d)/i
const PLUS = /^\s*(?:lv?l?\.?\s*|level\s*)?(\d{1,3})\s*\+/i
const LINE = /^[\s\-=_~*.·—–]{3,}$/

export function stageHeader (label: string): { from: number, to: number } | null {
  let m = RANGE.exec(label)
  if (m) {
    const from = Number(m[1]); const to = Number(m[2])
    if (from >= 1 && to >= from && to <= 100) return { from, to }
    return null
  }
  m = PLUS.exec(label)
  if (m) {
    const from = Number(m[1])
    if (from >= 1 && from <= 100) return { from, to: 100 }
  }
  return null
}

// stages in skill-list order; fewer than 2 = the build doesn't use them
export function gemStages (groups: PobSocketGroup[]): GemStage[] {
  const stages: GemStage[] = []
  let cur: GemStage | null = null
  for (const g of [...groups].sort((a, b) => a.index - b.index)) {
    const label = pobText(g.label)
    const gemCount = g.gems.filter(x => x.name).length
    if (!gemCount && LINE.test(label)) { cur = null; continue }
    const head = label ? stageHeader(label) : null
    if (head) {
      cur = { title: label.replace(/\s*\((?:disabled|forced active)\)/gi, '').trim(), ...head, groups: [] }
      stages.push(cur)
      if (gemCount) cur.groups.push(g.index)
      continue
    }
    if (cur && gemCount) cur.groups.push(g.index)
  }
  return stages.length >= 2 ? stages : []
}

// the stage for a level: the last one whose range has it (at 31, "31+" wins over "28-31")
export function stageFor (stages: GemStage[], level: number): number {
  let found = -1
  stages.forEach((s, i) => { if (level >= s.from && level <= s.to) found = i })
  if (found >= 0) return found
  // between ranges: the last one already started
  stages.forEach((s, i) => { if (s.from <= level) found = i })
  return found
}
