// Deathloom fork (Q3): Threads of Creation facts (3.30 Covens), in one place for
// the Map mechanics cheat sheet and the Thread planner. Our own short text from
// GGG's 3.30.0b–d patch notes; GGG changes these now and then.

export interface ThreadKind {
  id: string
  // mechanic name; the item is "<label> Thread"
  label: string
  // poe.ninja / exchange item name
  item: string
  // ready-made atlas content id (atlas-generator CONTENTS)
  atlas: string
  // bonus stat at 3 / 6 / 8 Threads, short, for the cheat sheet line
  summary: string
  // the same per step (3, 6, 8 Threads)
  tiers: [string, string, string]
  // strongest effects that need 2+ Threads and this area level
  gate?: { level: 73 | 80, text: string }
}

export const THREAD_STEPS = [3, 6, 8] as const
export const MAX_THREADS = 8

export const THREADS: ThreadKind[] = [
  { id: 'abyss', label: 'Abyss', item: 'Abyss Thread', atlas: 'abyss', summary: 'Abyss +1/2/3 pits', tiers: ['+1 Abyss pit', '+2 Abyss pits', '+3 Abyss pits'], gate: { level: 80, text: 'the extra Abyss mod' } },
  { id: 'breach', label: 'Breach', item: 'Breach Thread', atlas: 'breach', summary: 'Breach 20/40/60% more magic monsters', tiers: ['20% more magic monsters', '40% more magic monsters', '60% more magic monsters'], gate: { level: 73, text: 'the extra Breach mod' } },
  { id: 'blight', label: 'Blight', item: 'Blight Thread', atlas: 'blight', summary: 'Blight +40/80/120% chance a lane is at least magic', tiers: ['+40% chance a lane is at least magic', '+80% chance a lane is at least magic', '+120% chance a lane is at least magic'], gate: { level: 73, text: 'the Blight Pantheon god' } },
  { id: 'legion', label: 'Legion', item: 'Legion Thread', atlas: 'legion', summary: 'Legion +1/2/3 encounters', tiers: ['+1 Legion encounter', '+2 Legion encounters', '+3 Legion encounters'] },
  { id: 'expedition', label: 'Expedition', item: 'Expedition Thread', atlas: 'expedition', summary: 'Expedition 15/30/50% chance remnants get an extra suffix', tiers: ['15% chance remnants get an extra suffix', '30% chance remnants get an extra suffix', '50% chance remnants get an extra suffix'] },
  { id: 'ultimatum', label: 'Ultimatum', item: 'Ultimatum Thread', atlas: 'ultimatum', summary: 'Ultimatum more rares, from 6 rewards as one extra round', tiers: ['more rare monsters', 'more rare monsters; rewards as one extra round', 'more rare monsters; rewards as one extra round'], gate: { level: 73, text: 'Double Down Ultimatum' } },
  { id: 'ritual', label: 'Ritual', item: 'Ritual Thread', atlas: 'ritual', summary: 'Ritual 20/40/60% more favours', tiers: ['20% more favours', '40% more favours', '60% more favours'] },
  { id: 'bestiary', label: 'Bestiary', item: 'Bestiary Thread', atlas: 'beasts', summary: 'Bestiary +2/3/4 red beasts', tiers: ['+2 red beasts', '+3 red beasts', '+4 red beasts'], gate: { level: 80, text: 'wisp beasts' } },
  { id: 'betrayal', label: 'Betrayal', item: 'Betrayal Thread', atlas: 'syndicate', summary: 'Betrayal 30/60/90% more reinforcements', tiers: ['30% more reinforcements', '60% more reinforcements', '90% more reinforcements'], gate: { level: 80, text: 'Catarina joining Betrayal and rare Syndicate members' } },
  { id: 'incursion', label: 'Incursion', item: 'Incursion Thread', atlas: 'incursion', summary: 'Incursion 20/30/40% pack size', tiers: ['20% pack size', '30% pack size', '40% pack size'] }
]

// 3.30.0c: 1–3 Threads at least 1 Thread mod, 4–7 at least 2, 8+ at least 3
export function guaranteedMods (count: number): number {
  if (!(count >= 1)) return 0
  if (count >= 8) return 3
  if (count >= 4) return 2
  return 1
}

export interface BonusState {
  // the 3 / 6 / 8 step reached (null below 3) and its bonus
  active: { at: number, text: string } | null
  next: { at: number, text: string, more: number } | null
}

export function bonusState (kind: ThreadKind, count: number): BonusState {
  let active: BonusState['active'] = null
  let next: BonusState['next'] = null
  THREAD_STEPS.forEach((at, i) => {
    if (count >= at) active = { at, text: kind.tiers[i] }
    else if (!next) next = { at, text: kind.tiers[i], more: at - count }
  })
  return { active, next }
}

// cost of one map's Threads; null when there's no price
export function threadCost (count: number, chaosEach: number | null | undefined, divine: number | null | undefined): { chaos: number, div: number | null } | null {
  if (chaosEach == null || !Number.isFinite(chaosEach) || chaosEach < 0) return null
  const chaos = Math.max(0, Math.min(MAX_THREADS, Math.floor(count))) * chaosEach
  return { chaos, div: divine && divine > 0 ? chaos / divine : null }
}

// area-level note for one kind (strongest effects need 2+ Threads)
export function gateNote (kind: ThreadKind, count: number): string | null {
  if (!kind.gate) return null
  const need = count < 2 ? ' Needs 2+ Threads.' : ''
  return `Area level ${kind.gate.level}+ for ${kind.gate.text}.${need}`
}

// ---- cheat sheet lines (Map mechanics → Threads of Creation) ----------------

const gateList = (level: number) => THREADS.filter(t => t.gate?.level === level).map(t => t.gate!.text)

export const THREAD_SHEET_LINES = {
  gates: `The strongest Thread effects need 2+ Threads and a high area level (3.30.0b): area 73+ for ${gateList(73).join(', ')}; area 80+ for ${gateList(80).join(', ')}.`,
  guaranteed: 'Guaranteed Thread mods (3.30.0c): 1–3 Threads at least 1 mod, 4–7 at least 2, 8+ at least 3.',
  bonuses: `Bonus stat at 3 / 6 / 8 Threads (3.30.0c): ${THREADS.map(t => t.summary).join(' · ')}.`
}
