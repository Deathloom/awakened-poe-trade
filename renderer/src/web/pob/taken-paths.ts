// Deathloom fork: which build passives count as taken on the tree map.
//
// The game log only names passives ("Strength" is many nodes), so a placed
// passive can end up cut off from the class start. Only then are build
// passives on the shortest build path back to the taken ones counted too.
// (16 Nov 2026: the old "two taken neighbours" rule lit small passives on
// loops the player had gone round the other way.)

export function fillTakenPaths (opts: {
  links: Array<[number, number]>
  // class start(s); plus the plan's first passive when the tree data doesn't link the start
  roots: number[]
  // every passive of the build (levelling target)
  target: Set<number>
  // kept + placed from the game log, in plan order
  have: number[]
  // passives with no path (masteries): never need connecting
  floating?: Set<number>
}): Set<number> {
  const { target, floating } = opts
  const adj = new Map<number, number[]>()
  const add = (a: number, b: number) => { const l = adj.get(a); if (l) l.push(b); else adj.set(a, [b]) }
  for (const [a, b] of opts.links) { add(a, b); add(b, a) }

  const out = new Set(opts.have)
  // passives reachable from a root through taken passives
  const reach = new Set<number>()
  const spread = (from: number[]) => {
    const q = from.filter(id => !reach.has(id))
    for (const id of q) reach.add(id)
    for (let i = 0; i < q.length; i++) {
      for (const nb of adj.get(q[i]) ?? []) {
        if (reach.has(nb) || !out.has(nb)) continue
        reach.add(nb); q.push(nb)
      }
    }
  }
  spread(opts.roots)

  for (const id of opts.have) {
    if (reach.has(id) || floating?.has(id)) continue
    // shortest way from what's connected to this passive, through build passives
    const prev = new Map<number, number>()
    const q = [...reach]
    const seen = new Set(q)
    let found = false
    for (let i = 0; i < q.length && !found; i++) {
      for (const nb of adj.get(q[i]) ?? []) {
        if (seen.has(nb) || (!target.has(nb) && nb !== id)) continue
        seen.add(nb); prev.set(nb, q[i]); q.push(nb)
        if (nb === id) { found = true; break }
      }
    }
    if (!found) continue
    const path: number[] = []
    for (let c: number | undefined = id; c != null && !reach.has(c); c = prev.get(c)) path.push(c)
    for (const c of path) out.add(c)
    spread(path)
  }
  return out
}
