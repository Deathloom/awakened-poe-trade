// Deathloom fork: ready-made atlas trees. Uses only GGG's official atlas export
// (the node names and stats in atlas-tree.json), never other players' trees.
// Per content: that content's notables (+ general map sustain), joined to the
// start by the cheapest connected path within the point budget: a Steiner-tree
// style greedy (repeatedly add the shortest path from the tree to the nearest
// wanted node). Points left over go to the content's small passives.

import { ATLAS, ATLAS_ADJ, ATLAS_BY_ID, ATLAS_START, encodeAtlas, type AtlasNode } from './atlas-tree'

export interface AtlasContent { id: string, label: string, re: RegExp }

// matched against a node's name + stats (or a multiple-choice notable's options)
export const CONTENTS: AtlasContent[] = [
  { id: 'strongbox', label: 'Strongboxes', re: /Strongbox/i },
  { id: 'expedition', label: 'Expedition', re: /Expedition|Logbook|Runic Monster|Explosive/i },
  { id: 'shrine', label: 'Shrines', re: /Shrine/i },
  { id: 'essence', label: 'Essence', re: /Imprisoned Monster|Essence/i },
  { id: 'breach', label: 'Breach', re: /Breach|Wombgift|Grasping Coffer|Hiveblood/i },
  { id: 'legion', label: 'Legion', re: /Legion|Timeless Splinter|War Hoard/i },
  { id: 'ritual', label: 'Ritual', re: /Ritual|Tribute/i },
  { id: 'harvest', label: 'Harvest', re: /Sacred Flora|Sacred Fauna|Lifeforce/i },
  { id: 'blight', label: 'Blight', re: /Blight/i },
  { id: 'delirium', label: 'Delirium', re: /Delirium/i },
  { id: 'abyss', label: 'Abyss', re: /Abyss/i },
  { id: 'beasts', label: 'Beasts (Bestiary)', re: /Beast|Einhar/i },
  { id: 'ultimatum', label: 'Ultimatum', re: /Ultimatum/i },
  { id: 'incursion', label: 'Incursion', re: /Incursion/i },
  { id: 'syndicate', label: 'Syndicate', re: /Syndicate/i },
  { id: 'torment', label: 'Tormented Spirits', re: /Tormented Spirit|haunted/i },
  { id: 'exiles', label: 'Rogue Exiles', re: /Rogue Exile/i },
  { id: 'mercenaries', label: 'Mercenaries', re: /Mercenar/i },
  { id: 'ore', label: 'Ore Deposits', re: /Ore Deposit|Lost Shipment/i },
  { id: 'eldritch', label: 'Eldritch altars', re: /Eater of Worlds|Searing Exarch|Eldritch/i },
  { id: 'threads', label: 'Threads', re: /\bThreads?\b/i },
  { id: 'divination', label: 'Divination cards', re: /Divination/i },
  { id: 'wildwood', label: 'Viridian Wildwood', re: /Wildwood/i },
  { id: 'sentinel', label: 'Buried Sentinel', re: /Buried Sentinel/i },
  { id: 'mirage', label: 'Mirage', re: /Mirage/i },
  { id: 'uniques', label: 'Unique monsters', re: /Unique Monsters/i },
  { id: 'rares', label: 'Rare monsters / packs', re: /Rare Monsters|Magic Monsters|Pack Size|Monster Packs/i }
]

// general map sustain: maps dropping, higher tiers
export const SUSTAIN: RegExp = /Maps found|1 tier higher|additional Map at a tier|Guardian Map|Conqueror Map/i
// niche map kinds, not general sustain
const NOT_SUSTAIN = /Blighted|Calcified|Synthesis|Memory Tear/i
// an option that works against the content ("cannot be of type", "less chance")
const AGAINST = /cannot|reduced chance|less chance|not be/i

export interface GenOptions {
  contents: string[]
  sustain: boolean
  budget: number
}
export interface GenResult {
  code: string
  name: string
  points: number
  notables: string[]
  // wanted notables that didn't fit in the budget
  missed: string[]
}

const clean = (s: string) => s.replace(/\[(?:[^\]|]*\|)?([^\]]*)\]/g, '$1')
const textOf = (n: AtlasNode) => clean(`${n[6]} ${n[8].join(' ')}`)

// multiple-choice notable: the option matching a content (or null)
function variantFor (n: AtlasNode, re: RegExp): number | null {
  if (AGAINST.test(clean(n[8].join(' ')))) return null
  for (const [effect, lines] of ATLAS.variants[String(n[0])] ?? []) {
    const t = clean(lines.join(' '))
    if (re.test(t) && !AGAINST.test(t)) return effect
  }
  return null
}

// nodes a path may go through (no mastery art labels)
const walkable = (id: number) => { const k = ATLAS_BY_ID.get(id)?.[3]; return k != null && k !== 3 }

// BFS from the whole tree: shortest new path to every node
function pathsFrom (tree: Set<number>): Map<number, number> {
  const prev = new Map<number, number>()
  const q = [...tree]
  const seen = new Set(q)
  for (let i = 0; i < q.length; i++) {
    for (const nb of ATLAS_ADJ.get(q[i]) ?? []) {
      if (seen.has(nb) || !walkable(nb)) continue
      seen.add(nb); prev.set(nb, q[i]); q.push(nb)
    }
  }
  return prev
}
function newPath (tree: Set<number>, prev: Map<number, number>, id: number): number[] | null {
  if (tree.has(id)) return []
  if (!prev.has(id)) return null
  const out: number[] = []
  for (let c: number | undefined = id; c != null && !tree.has(c); c = prev.get(c)) out.push(c)
  return out
}

export function generateAtlas (opts: GenOptions): GenResult {
  const picked = CONTENTS.filter(c => opts.contents.includes(c.id))
  const contentRe = picked.length ? new RegExp(picked.map(c => c.re.source).join('|'), 'i') : null
  const budget = Math.max(1, Math.min(opts.budget || ATLAS.points || 150, ATLAS.points || 150))

  // what we want, in order: content notables, sustain notables, content smalls, sustain smalls
  const choices: Record<string, number> = {}
  const tiers: number[][] = [[], [], [], []]
  for (const n of ATLAS.nodes) {
    if (ATLAS_START.has(n[0]) || n[3] === 3 || n[3] === 2 || n[3] === 5) continue // keystones have downsides: not picked
    const t = textOf(n)
    const notable = n[3] === 1
    let hit = false
    if (contentRe) {
      if (contentRe.test(t)) hit = true
      else if (notable) {
        const v = variantFor(n, contentRe)
        if (v != null) { choices[String(n[0])] = v; hit = true }
      }
    }
    if (hit) { tiers[notable ? 0 : 2].push(n[0]); continue }
    if (opts.sustain && SUSTAIN.test(t) && !NOT_SUSTAIN.test(t)) tiers[notable ? 1 : 3].push(n[0])
  }

  const tree = new Set<number>(ATLAS_START)
  let points = 0
  const missed: number[] = []
  for (const [ti, wanted] of tiers.entries()) {
    let left = wanted.filter(id => !tree.has(id))
    while (left.length) {
      const prev = pathsFrom(tree)
      let best: number[] | null = null
      for (const id of left) {
        const p = newPath(tree, prev, id)
        if (p && (!best || p.length < best.length)) { best = p }
      }
      if (!best || points + best.length > budget) {
        // the rest doesn't fit (or can't be reached)
        if (ti < 2) missed.push(...left)
        break
      }
      for (const id of best) tree.add(id)
      points += best.length
      left = left.filter(id => !tree.has(id))
    }
  }

  const nodes = [...tree].filter(id => !ATLAS_START.has(id))
  const kept = Object.fromEntries(Object.entries(choices).filter(([k]) => tree.has(Number(k))))
  const notables = nodes.filter(id => ATLAS_BY_ID.get(id)?.[3] === 1).map(id => ATLAS_BY_ID.get(id)![6].trim())
  const label = picked.map(c => c.label).join(' + ') || 'Map sustain'
  return {
    code: encodeAtlas({ nodes, choices: kept }),
    name: `${label}${opts.sustain && picked.length ? ' + sustain' : ''}${budget < (ATLAS.points ?? 150) ? ` (${budget} pts)` : ''}`,
    points,
    notables,
    missed: missed.map(id => ATLAS_BY_ID.get(id)?.[6].trim() ?? String(id))
  }
}

// how many notables each content has (to show next to the choice)
export const CONTENT_NOTABLES: Record<string, number> = Object.fromEntries(CONTENTS.map(c => [c.id,
  ATLAS.nodes.filter(n => n[3] === 1 && (c.re.test(textOf(n)) || variantFor(n, c.re) != null)).length]))
