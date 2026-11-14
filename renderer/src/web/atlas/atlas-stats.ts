// Deathloom fork: cumulative stats of a set of atlas passives (like PoB's tree
// summary). Lines with the same wording add up number by number:
// "4% increased Quantity of Items found in your Maps" ×3 -> "12% increased ...".

import { ATLAS_BY_ID, statsOf } from './atlas-tree'

export interface StatSum { text: string, count: number, numeric: boolean }

const NUM = /[+-]?\d+(?:\.\d+)?/g
// [Thread|Threads] -> Threads, [Map] -> Map
export const cleanStat = (s: string) => s.replace(/\[(?:[^\]|]*\|)?([^\]]*)\]/g, '$1')

export function sumStats (ids: Iterable<number>, choices: Record<string, number>): StatSum[] {
  const by = new Map<string, { nums: number[], count: number, numeric: boolean, signs: boolean[] }>()
  for (const id of ids) {
    const n = ATLAS_BY_ID.get(id)
    if (!n || n[3] === 3) continue
    for (const raw of statsOf(n, choices)) {
      // unpicked multiple-choice notable: its options aren't stats yet
      if (raw.startsWith('Option ')) continue
      const line = cleanStat(raw).trim()
      if (!line) continue
      const nums = (line.match(NUM) ?? []).map(Number)
      const key = line.replace(NUM, '#')
      const cur = by.get(key)
      if (!cur) {
        by.set(key, { nums, count: 1, numeric: nums.length > 0, signs: (line.match(NUM) ?? []).map(t => t.startsWith('+')) })
      } else {
        cur.count++
        cur.nums = cur.nums.map((v, i) => v + (nums[i] ?? 0))
      }
    }
  }
  const out: StatSum[] = []
  for (const [key, v] of by) {
    let i = 0
    const text = key.replace(/#/g, () => {
      const x = Math.round((v.nums[i] ?? 0) * 100) / 100
      const s = v.signs[i++] && x >= 0 ? `+${x}` : String(x)
      return s
    })
    out.push({ text, count: v.count, numeric: v.numeric })
  }
  // group by what the line is about, not by its number
  return out.sort((a, b) => a.text.replace(NUM, '').localeCompare(b.text.replace(NUM, '')))
}
