// Deathloom fork (Q13): Temple of Atzoatl planner (3.30). Room lines and tiers are
// the trade site's "Has Room" stats (same list as price-check/filters/pseudo/
// atzoatl-rules.ts); value groups follow that file's order. What a room does is
// short and partly a guess (marked). Prices: the poe.ninja "temples" overview only.

export interface RoomLine {
  id: string
  // tier 1, 2, 3 names
  names: [string, string, string]
  // what the tier 3 room gives
  does: string
  // 0 best (worth building a temple around) … 3 nice to have; 9 = utility
  group: 0 | 1 | 2 | 3 | 9
  guess?: boolean
}

export const ROOM_LINES: RoomLine[] = [
  { id: 'corruption', names: ['Corruption Chamber', 'Catalyst of Corruption', 'Locus of Corruption'], does: 'Altar that corrupts an item twice', group: 0 },
  { id: 'gems', names: ['Gemcutter\'s Workshop', 'Department of Thaumaturgy', 'Doryani\'s Institute'], does: 'Lens that corrupts a gem (chance of level / quality above max)', group: 0 },
  { id: 'sacrifice', names: ['Sacrificial Chamber', 'Hall of Offerings', 'Apex of Ascension'], does: 'Altar that takes a unique item and gives another', group: 0, guess: true },
  { id: 'currency', names: ['Vault', 'Treasury', 'Wealth of the Vaal'], does: 'Chests full of currency', group: 1 },
  { id: 'maps', names: ['Surveyor\'s Study', 'Office of Cartography', 'Atlas of Worlds'], does: 'Chests full of (corrupted) maps', group: 1 },
  { id: 'timeless', names: ['Hall of Mettle', 'Hall of Heroes', 'Hall of Legends'], does: 'Timeless Monolith', group: 1, guess: true },
  { id: 'items', names: ['Storage Room', 'Warehouses', 'Museum of Artefacts'], does: 'Chests full of items', group: 2 },
  { id: 'packs', names: ['Guardhouse', 'Barracks', 'Hall of War'], does: 'Bigger monster packs in the temple', group: 2 },
  { id: 'yield', names: ['Workshop', 'Engineering Department', 'Factory'], does: 'More items from the temple', group: 2 },
  { id: 'torment', names: ['Torment Cells', 'Torture Cages', 'Sadist\'s Den'], does: 'Tormented Spirits', group: 2 },
  { id: 'strongbox', names: ['Strongbox Chamber', 'Hall of Locks', 'Court of Sealed Death'], does: 'Strongboxes', group: 2 },
  { id: 'rarity', names: ['Jeweller\'s Workshop', 'Jewellery Forge', 'Glittering Halls'], does: 'More item rarity in the temple', group: 2 },
  { id: 'breach', names: ['Anomaly Research Lab', 'Breach Containment Chamber', 'House of the Others'], does: 'Unstable Breaches', group: 2 },
  { id: 'tempest', names: ['Tempest Generator', 'Hurricane Engine', 'Storm of Corruption'], does: 'Tempests in the temple', group: 3 },
  { id: 'armour', names: ['Armourer\'s Workshop', 'Armoury', 'Chamber of Iron'], does: 'Armour with Incursion mods', group: 3, guess: true },
  { id: 'weapons', names: ['Sparring Room', 'Arena of Valour', 'Hall of Champions'], does: 'Weapons with Incursion mods', group: 3, guess: true },
  { id: 'poison', names: ['Poison Garden', 'Cultivar Chamber', 'Toxic Grove'], does: 'Chaos / poison themed items', group: 3, guess: true },
  { id: 'minions', names: ['Hatchery', 'Automaton Lab', 'Hybridisation Chamber'], does: 'Minion themed items', group: 3, guess: true },
  { id: 'traps', names: ['Trap Workshop', 'Temple Defense Workshop', 'Defense Research Lab'], does: 'Trap / mine themed items', group: 3, guess: true },
  { id: 'fire', names: ['Flame Workshop', 'Royal Forge', 'Crucible of Flame'], does: 'Fire themed items', group: 3, guess: true },
  { id: 'lightning', names: ['Lightning Workshop', 'Grand Reactor', 'Conduit of Lightning'], does: 'Lightning themed items', group: 3, guess: true },
  { id: 'life', names: ['Pools of Restoration', 'Sanctum of Vitality', 'Sanctum of Immortality'], does: 'Life / defence themed items', group: 3, guess: true },
  { id: 'explosives', names: ['Explosives Room', 'Demolition Lab', 'Shrine of Unmaking'], does: 'Opens blocked doors (needed to reach obstructed rooms)', group: 9 },
  { id: 'empower', names: ['Shrine of Empowerment', 'Sanctum of Unity', 'Temple Nexus'], does: 'Strengthens nearby rooms', group: 9, guess: true }
]

export const GROUP_LABEL: Record<RoomLine['group'], string> = {
  0: 'Build the temple around it',
  1: 'Very good',
  2: 'Good',
  3: 'Nice to have',
  9: 'Utility'
}

// 0 = not in the temple (or not seen yet), 1–3 = tier
export type TemplePlan = Record<string, 0 | 1 | 2 | 3>

export const PLAN_KEY = 'deathloom.temple-plan.v1'

export function loadPlan (): TemplePlan {
  const out: TemplePlan = {}
  try {
    const raw = JSON.parse(localStorage.getItem(PLAN_KEY) ?? 'null')
    if (raw && typeof raw === 'object') {
      for (const l of ROOM_LINES) {
        const t = raw[l.id]
        if (t === 1 || t === 2 || t === 3) out[l.id] = t
      }
    }
  } catch {}
  return out
}

export function savePlan (p: TemplePlan) {
  try { localStorage.setItem(PLAN_KEY, JSON.stringify(p)) } catch {}
}

export interface UpgradeStep {
  line: RoomLine
  tier: 1 | 2 | 3
  next: string
}

// What to upgrade next: rooms you have below tier 3, best group first, then the
// one closest to tier 3 (fewer Incursions to finish it). Utility rooms only
// after the value rooms. The explosives room matters only when blocked doors
// hide a good room: shown last with its own note in the UI.
export function upgradeOrder (plan: TemplePlan): UpgradeStep[] {
  return ROOM_LINES
    .filter(l => { const t = plan[l.id] ?? 0; return t >= 1 && t < 3 })
    .map(l => { const t = plan[l.id] as 1 | 2; return { line: l, tier: t, next: l.names[t] } })
    .sort((a, b) => a.line.group - b.line.group || b.tier - a.tier || ROOM_LINES.indexOf(a.line) - ROOM_LINES.indexOf(b.line))
}

// Rooms worth hunting for that the temple doesn't have yet (best groups only)
export function missingGoodRooms (plan: TemplePlan): RoomLine[] {
  return ROOM_LINES.filter(l => l.group <= 1 && !(plan[l.id] ?? 0))
}

// ---- Itemised temples (poe.ninja) --------------------------------------------

export interface TempleListing { name: string, variant?: string, chaos: number, url: string }

export interface PricedTemple extends TempleListing {
  // room lines this listing names at tier 3, in ROOM_LINES order
  rooms: string[]
  // every named room is tier 3 in your plan
  matches: boolean
}

// poe.ninja lists itemised temples by the rooms they have; we look for tier 3
// room names in the listing's name and variant (format not checked: guess)
export function priceTemples (listings: Array<{ category: string, name: string, variant?: string, chaos: number, url: string }>, plan: TemplePlan): PricedTemple[] {
  const out: PricedTemple[] = []
  for (const l of listings) {
    if (l.category !== 'temples' || !Number.isFinite(l.chaos)) continue
    const text = `${l.name} ${l.variant ?? ''}`.toLowerCase()
    const rooms = ROOM_LINES.filter(r => text.includes(r.names[2].toLowerCase())).map(r => r.id)
    out.push({ name: l.name, variant: l.variant, chaos: l.chaos, url: l.url, rooms, matches: rooms.length > 0 && rooms.every(id => plan[id] === 3) })
  }
  return out.sort((a, b) => b.chaos - a.chaos)
}

// what your temple would sell for as an Itemised Temple: the dearest listing
// whose rooms you all have at tier 3 (null: nothing listed matches)
export function templeValue (priced: PricedTemple[]): PricedTemple | null {
  return priced.find(p => p.matches) ?? null
}
