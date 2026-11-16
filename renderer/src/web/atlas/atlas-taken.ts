// Deathloom fork: which of an atlas build's passives count as taken, from the
// names Client.txt logged (names -> how many). Many small passives share a name,
// so a name alone doesn't say which one. You can only allocate next to what you
// have, so grow out from the start one passive at a time, through the build's
// passives whose name you have taken (nearest the start first). Taken names that
// never connect (off this build, or allocated before Orbhoarder watched the log)
// aren't shown: "I have this build" fixes the counts. Pure logic (unit tested).
// Gerhard 17 Nov 2026: taking 1 drop chance showed 5 taken (old version matched
// a same-named passive deep in the build and filled the path to it).

export function pickTaken (
  buildNodes: Iterable<number>,
  counts: Record<string, number>,
  nameOf: (id: number) => string | undefined,
  adj: (id: number) => Iterable<number>,
  isStart: (id: number) => boolean,
  order: (id: number) => number
): Set<number> {
  const build = new Set(buildNodes)
  const left: Record<string, number> = { ...counts }
  const out = new Set([...build].filter(isStart))
  for (;;) {
    const cand = new Set<number>()
    for (const id of out) {
      for (const nb of adj(id)) {
        const name = nameOf(nb)
        if (build.has(nb) && !out.has(nb) && name && (left[name] ?? 0) > 0) cand.add(nb)
      }
    }
    if (!cand.size) break
    // one at a time, nearest the start first: a new passive can open the way
    // to a nearer same-named one
    const next = [...cand].sort((a, b) => order(a) - order(b))[0]
    out.add(next)
    left[nameOf(next)!]--
  }
  return out
}
