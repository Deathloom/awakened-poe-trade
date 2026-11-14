// Deathloom fork: the Atlas passive tree. Layout from GGG's official export
// (github.com/grindinggear/atlastree-export, built by tools/gen-atlas-tree.py).
// Atlas builds are GGG's own tree code (the part after the last / of a
// pathofexile.com atlas tree link). poeplanner links use their own format.

import DATA from './atlas-tree.json'

// [id, x, y, kind, group, orbit, name, false, stats]
// kind: 0 normal, 1 notable, 2 keystone, 3 mastery (art label), 5 start
export type AtlasNode = [number, number, number, number, number, number, string, false, string[]]
export interface AtlasLayout {
  version: string
  nodes: AtlasNode[]
  groups: Record<string, [number, number]>
  orbitRadii: number[]
  links: Array<[number, number]>
  arcs: Array<[number, number, number, number]>
  variants: Record<string, Array<[number, string[]]>>
  points: number | null
}

export const ATLAS = DATA as unknown as AtlasLayout
export const ATLAS_BY_ID = new Map<number, AtlasNode>(ATLAS.nodes.map(n => [n[0], n]))
export const ATLAS_START = new Set(ATLAS.nodes.filter(n => n[3] === 5).map(n => n[0]))

// neighbours (for "what's connected")
export const ATLAS_ADJ = (() => {
  const m = new Map<number, number[]>()
  const add = (a: number, b: number) => { (m.get(a) ?? m.set(a, []).get(a)!).push(b) }
  for (const [a, b] of ATLAS.links) { add(a, b); add(b, a) }
  for (const [a, b] of ATLAS.arcs) { add(a, b); add(b, a) }
  return m
})()

export interface AtlasSpec {
  nodes: number[]
  // multiple-choice notables: node -> chosen effect
  choices: Record<string, number>
  // nodes in the code this version of the tree doesn't have (older/newer tree)
  unknown: number
}

function b64urlDecode (s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function b64urlEncode (b: Uint8Array): string {
  let bin = ''
  for (const x of b) bin += String.fromCharCode(x)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const POEPLANNER_HINT = "poeplanner links use poeplanner's own format. Open the tree on pathofexile.com (or a site that links there) and paste that link."

// a link or a bare code -> the code (throws for links in another format)
export function codeFromInput (input: string): string | null {
  const t = input.trim()
  if (!t) return null
  let code = t
  if (/^https?:\/\//i.test(t)) {
    let u: URL
    try { u = new URL(t) } catch { return null }
    if (/poeplanner\.com$/i.test(u.hostname)) throw new Error(POEPLANNER_HINT)
    code = u.pathname.split('/').filter(Boolean).pop() ?? ''
  }
  code = code.replace(/[?#].*$/, '')
  return /^[A-Za-z0-9_-]{8,}={0,2}$/.test(code) ? code.replace(/=+$/, '') : null
}

// GGG's tree code: u32 version, u8 class, u8 ascendancy, u8 count, u16 nodes…,
// (v5+) u8 count + u16 cluster nodes, (v6) u8 count + (u16, u16) choice pairs
export function decodeAtlas (code: string): AtlasSpec {
  const b = b64urlDecode(code)
  if (b.length < 7) throw new Error('That code is too short to be an atlas tree.')
  const version = (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]
  if (version < 4 || version > 6) throw new Error(b[0] === 5 ? POEPLANNER_HINT : "That isn't a pathofexile.com tree code.")
  let p = 6
  const u16 = () => { const v = (b[p] << 8) | b[p + 1]; p += 2; return v }
  const n = b[p++]
  const ids: number[] = []
  for (let i = 0; i < n && p + 1 < b.length; i++) ids.push(u16())
  if (version >= 5 && p < b.length) { const c = b[p++]; p += c * 2 }
  const choices: Record<string, number> = {}
  if (version >= 6 && p < b.length) {
    const c = b[p++]
    for (let i = 0; i < c && p + 3 < b.length; i++) {
      const x = u16(); const y = u16()
      // which half is the node doesn't matter: the node is the one with choices
      if (ATLAS.variants[String(y)]) choices[String(y)] = x
      else if (ATLAS.variants[String(x)]) choices[String(x)] = y
    }
  }
  const known = ids.filter(id => ATLAS_BY_ID.has(id))
  if (!known.length && ids.length) throw new Error("None of the code's passives are on the atlas tree. Is it a character tree?")
  return { nodes: [...new Set(known)], choices, unknown: ids.length - known.length }
}

export function encodeAtlas (spec: Pick<AtlasSpec, 'nodes' | 'choices'>): string {
  const ids = spec.nodes.filter(id => !ATLAS_START.has(id)).slice(0, 255)
  const pairs = Object.entries(spec.choices).slice(0, 255)
  const out: number[] = [0, 0, 0, 6, 0, 0, ids.length]
  for (const id of ids) out.push(id >> 8, id & 255)
  out.push(0)
  out.push(pairs.length)
  for (const [node, effect] of pairs) out.push(effect >> 8, effect & 255, Number(node) >> 8, Number(node) & 255)
  return b64urlEncode(new Uint8Array(out))
}

export function atlasUrl (code: string) {
  return `https://www.pathofexile.com/fullscreen-atlas-skill-tree/${code}`
}

// points a spec spends (start node is free)
export function pointsOf (nodes: Iterable<number>) {
  let n = 0
  for (const id of nodes) { const k = ATLAS_BY_ID.get(id)?.[3]; if (k != null && k !== 5 && k !== 3) n++ }
  return n
}

// stats a node gives in this spec (multiple-choice notables: the chosen effect)
export function statsOf (node: AtlasNode, choices: Record<string, number>): string[] {
  const v = ATLAS.variants[String(node[0])]
  if (!v) return node[8]
  const pick = choices[String(node[0])]
  const hit = v.find(e => e[0] === pick)
  return hit ? hit[1] : v.flatMap((e, i) => [`Option ${i + 1}: ${e[1].join(' ')}`])
}
