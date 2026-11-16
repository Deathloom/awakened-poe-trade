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
