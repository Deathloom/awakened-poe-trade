// Deathloom fork (16 Nov 2026): timeless jewel seed search helpers (pure, unit tested).
import type { TimelessWant } from '@ipc/types'

export const MAX_WANTS = 10

// One want per notable; an "anywhere" want per outcome. Adding the same again
// replaces it (new min / new outcome for that notable).
export function addWant (list: TimelessWant[], want: TimelessWant): TimelessWant[] {
  const rest = list.filter(w => want.node != null
    ? w.node !== want.node
    : !(w.node == null && w.label === want.label))
  if (rest.length >= MAX_WANTS) return list
  return [...rest, want]
}

export function removeWant (list: TimelessWant[], want: TimelessWant): TimelessWant[] {
  return list.filter(w => !(w.label === want.label && w.node === want.node))
}

export function wantText (w: TimelessWant, nodeName?: string): string {
  if (w.node != null) return `${nodeName ?? 'Notable'} → ${w.label}`
  const min = w.min ?? 1
  return min > 1 ? `${w.label} (on ${min}+ notables)` : `${w.label} (any notable)`
}

// Trade search for one seed. With several conquerors the jewel can be any of
// them (the seed decides the notables; the conqueror only the keystone).
export function timelessTradeQuery (jewel: string, conquerors: string[], seed: number) {
  const filters = conquerors.map(c => ({
    id: `explicit.pseudo_timeless_jewel_${c.toLowerCase()}`,
    value: { min: seed, max: seed }
  }))
  return {
    query: {
      status: { option: 'online' },
      name: jewel,
      type: 'Timeless Jewel',
      stats: [filters.length === 1
        ? { type: 'and', filters }
        : { type: 'count', value: { min: 1 }, filters }]
    },
    sort: { price: 'asc' }
  }
}
