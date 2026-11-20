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
  { id: 'beasts', label: 'Beasts (Bestiary)', re: /Beast|Einhar|Bestiary/i },
  { id: 'ultimatum', label: 'Ultimatum', re: /Ultimatum/i },
  { id: 'incursion', label: 'Incursion', re: /Incursion/i },
  { id: 'syndicate', label: 'Syndicate', re: /Syndicate|Betrayal/i },
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

// loot or monster kinds found in every content: a node naming one of these doesn't
// need that content picked (Threads from Unique Monsters are still Threads)
const LOOT_ONLY = new Set(['threads', 'divination', 'uniques', 'rares'])

// what a stat line is about: the content it names first ("Strongboxes … contain a
// Mercenary" is a Strongbox line; "Mercenaries … Shrine buff" a Mercenary line)
export function subjectOf (line: string): string | null {
  let best: { id: string, at: number } | null = null
  for (const c of CONTENTS) {
    const m = c.re.exec(line)
    if (m && (!best || m.index < best.at)) best = { id: c.id, at: m.index }
  }
  return best?.id ?? null
}

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
  missedSustain: string[]
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

// Deathloom fork (Gerhard 20 Nov 2026): a "type picker" notable lets you choose
// between other contents (Dextral / Sinistral Threads: Breach, Ritual, Ultimatum…;
// Merged Worlds …). Its own text ("Threads") isn't the content you get: it only
// counts when one of its options is a content you picked, with that option chosen.
const ANY_CONTENT = new RegExp(CONTENTS.map(c => c.re.source).join('|'), 'i')
function isTypePicker (n: AtlasNode): boolean {
  const vs = ATLAS.variants[String(n[0])] ?? []
  return vs.filter(([, lines]) => ANY_CONTENT.test(clean(lines.join(' ')))).length >= 2
}
// "cannot be of type" picker (Threadbare, Unthreaded): rule out a type you didn't
// pick, only when this group holds one you did (more of yours, fewer of the rest)
function excludeVariant (n: AtlasNode, re: RegExp): number | null {
  const vs = ATLAS.variants[String(n[0])] ?? []
  if (!vs.some(([, lines]) => re.test(clean(lines.join(' '))))) return null
  return vs.find(([, lines]) => !re.test(clean(lines.join(' '))))?.[0] ?? null
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
  // a node that only works inside a content you didn't pick (an Ultimatum node that
  // rewards Divination cards) is not yours
  const needsUnpicked = (lines: string[]) => lines.some(l => {
    const s = subjectOf(l)
    return s != null && !LOOT_ONLY.has(s) && !opts.contents.includes(s)
  })
  const optionLines = (n: AtlasNode, v: number) => ((ATLAS.variants[String(n[0])] ?? []).find(([e]) => e === v)?.[1] ?? []).map(clean)
  const statLines = (n: AtlasNode) => n[8].map(clean)
  const budget = Math.max(1, Math.min(opts.budget || ATLAS.points || 150, ATLAS.points || 150))

  // what we want, in order: sustain notables (ticked = the base of any atlas tree,
  // so content can't starve it), content notables, content smalls, sustain smalls
  const choices: Record<string, number> = {}
  const tiers: number[][] = [[], [], [], []]
  for (const n of ATLAS.nodes) {
    if (ATLAS_START.has(n[0]) || n[3] === 3 || n[3] === 2 || n[3] === 5) continue // keystones have downsides: not picked
    const t = textOf(n)
    const notable = n[3] === 1
    let hit = false
    if (contentRe && notable && isTypePicker(n)) {
      const against = AGAINST.test(clean(n[8].join(' ')))
      const v = against ? excludeVariant(n, contentRe) : variantFor(n, contentRe)
      if (v != null && (against || !needsUnpicked(optionLines(n, v)))) { choices[String(n[0])] = v; hit = true }
    } else if (contentRe) {
      if (contentRe.test(t)) hit = !needsUnpicked(statLines(n))
      else if (notable) {
        const v = variantFor(n, contentRe)
        if (v != null && !needsUnpicked([...statLines(n), ...optionLines(n, v)])) { choices[String(n[0])] = v; hit = true }
      }
    }
    if (hit) { tiers[notable ? 0 : 2].push(n[0]); continue }
    if (opts.sustain && SUSTAIN.test(t) && !NOT_SUSTAIN.test(t)) tiers[notable ? 1 : 3].push(n[0])
  }

  const tree = new Set<number>(ATLAS_START)
  let points = 0
  const missed: number[] = []
  const passes = [tiers[1], tiers[0], tiers[2], tiers[3]]
  for (const [ti, wanted] of passes.entries()) {
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

  const sustainSet = new Set(tiers[1])
  // same-named notables (e.g. two Shaping the Mountains) once each
  const names = (ids: number[]) => [...new Set(ids.map(id => ATLAS_BY_ID.get(id)?.[6].trim() ?? String(id)))]
  const nodes = [...tree].filter(id => !ATLAS_START.has(id))
  const kept = Object.fromEntries(Object.entries(choices).filter(([k]) => tree.has(Number(k))))
  const notables = nodes.filter(id => ATLAS_BY_ID.get(id)?.[3] === 1).map(id => ATLAS_BY_ID.get(id)![6].trim())
  const label = picked.map(c => c.label).join(' + ') || 'Map sustain'
  return {
    code: encodeAtlas({ nodes, choices: kept }),
    name: `${label}${opts.sustain && picked.length ? ' + sustain' : ''}${budget < (ATLAS.points ?? 150) ? ` (${budget} pts)` : ''}`,
    points,
    notables,
    missed: names(missed.filter(id => !sustainSet.has(id))),
    missedSustain: names(missed.filter(id => sustainSet.has(id)))
  }
}

// how many notables each content has (to show next to the choice)
export const CONTENT_NOTABLES: Record<string, number> = Object.fromEntries(CONTENTS.map(c => [c.id,
  ATLAS.nodes.filter(n => n[3] === 1 && (isTypePicker(n) ? variantFor(n, c.re) != null : (c.re.test(textOf(n)) || variantFor(n, c.re) != null))).length]))

// Deathloom fork (Q3): atlas notables that help one kind of Thread (Cheat sheets →
// Thread planner). Same rules as the ready-made tree: a "more likely to be of type"
// picker counts with your type chosen, a "cannot be of type" one when its group
// holds your type (rule out another), plus notables for Threads in general
// ("per different Thread" ones work against stacking one kind: left out).
export interface ThreadNotable { name: string, how: string, kind: 'type' | 'exclude' | 'general' }
const THREAD_RE = /\bThreads?\b/i
export function threadNotables (contentId: string): ThreadNotable[] {
  const c = CONTENTS.find(x => x.id === contentId)
  if (!c) return []
  const out: ThreadNotable[] = []
  const seen = new Set<string>()
  for (const n of ATLAS.nodes) {
    if (n[3] !== 1) continue
    const name = n[6].trim()
    if (seen.has(name)) continue
    const own = clean(n[8].join(' '))
    if (isTypePicker(n)) {
      const opts = (ATLAS.variants[String(n[0])] ?? []).map(([, lines]) => clean(lines.join(' ')).trim())
      const mine = opts.find(t => c.re.test(t))
      if (!mine || !THREAD_RE.test(own)) continue
      if (AGAINST.test(own)) out.push({ name, kind: 'exclude', how: `rule out one of ${opts.filter(t => t !== mine).join(' / ')}` })
      else out.push({ name, kind: 'type', how: `set to ${mine}` })
    } else if (THREAD_RE.test(own) && !AGAINST.test(own) && !/different Thread/i.test(own)) {
      out.push({ name, kind: 'general', how: own.trim() })
    } else continue
    seen.add(name)
  }
  const order = { type: 0, exclude: 1, general: 2 }
  return out.sort((a, b) => order[a.kind] - order[b.kind])
}
