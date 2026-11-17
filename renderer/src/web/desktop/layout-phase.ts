// Deathloom fork (16 Nov 2026): All tab has a Levelling and a Mapping layout.
// Auto mode follows the game: the first atlas map switches to Mapping; a new
// character (The Twilight Strand, act 1's first zone) switches back.
// Pure logic (unit tested in tests/logic.test.mjs).

export type LayoutMode = 'levelling' | 'mapping'
export type LayoutPref = 'auto' | LayoutMode

// area codes from Client.txt ("Generating level 68 area "MapWorldsStrand"")
export function phaseForArea (code: string | undefined | null): LayoutMode | null {
  if (!code) return null
  if (/^Map/i.test(code) && !/Hideout/i.test(code)) return 'mapping'
  if (code === '1_1_1') return 'levelling'
  return null
}

export function effectiveMode (pref: LayoutPref, phase: LayoutMode): LayoutMode {
  return pref === 'auto' ? phase : pref
}

// Mapping layouts saved before the tree map was in the Mapping default
// (1.0.91-beta.1/2; Gerhard: you still level in maps): add it once, above Build
// (or at the end of the last column). Removing it afterwards sticks (caller
// remembers it ran). Heights are re-normalised by the caller.
interface LayoutLike { cols: Array<{ items: Array<{ id: string, h: number }> }> }
export function addTreeMapOnce<T extends LayoutLike> (l: T): T {
  if (!l.cols.length || l.cols.some(c => c.items.some(it => it.id === 'tree'))) return l
  const col = l.cols.find(c => c.items.some(it => it.id === 'gear')) ?? l.cols[l.cols.length - 1]
  const gear = col.items.findIndex(it => it.id === 'gear')
  col.items.splice(gear >= 0 ? gear : col.items.length, 0, { id: 'tree', h: 1 / col.items.length })
  return l
}
