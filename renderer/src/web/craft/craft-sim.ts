// Deathloom fork (16 Nov 2026): crafting simulator. Rolls items the way the
// game picks explicit mods (weighted by spawn weight among the mods the item
// can still take: one per mod group, at most 3 prefixes and 3 suffixes, 2 and
// 2 on jewels) and counts how often the wanted mods show up.
// Pure logic, no Vue: unit tested in tests/logic.test.mjs.

export interface SimMod {
  id: string
  type: 'Prefix' | 'Suffix'
  group: string
  level: number
  weight: number
}

export interface SimPool {
  mods: SimMod[]
  maxAffixes: number
}

// A wanted mod: any of these mod ids (a group at or above a tier)
export interface Want {
  group: string
  ids: string[]
}

export type Method = 'chaos' | 'alt' | 'altRegal' | 'essence'

export interface SimOptions {
  method: Method
  // essence: its guaranteed mod (taken first, the rest is random)
  essenceModId?: string
  // how many items to roll (more = steadier numbers, slower)
  trials?: number
  // test hook: Math.random by default
  random?: () => number
}

export interface SimResult {
  method: Method
  trials: number
  hits: number
  // chance one attempt gives all wanted mods (0..1)
  chance: number
  // average attempts until a hit (Infinity when nothing hit)
  attempts: number
  // per wanted mod: how often it showed up (0..1)
  each: number[]
  // wanted mods this method can't give (e.g. 2 prefixes with Alteration)
  impossible?: string
  // currency used over all trials
  used: Partial<Record<Currency, number>>
}

// Tiers within a group, best (highest level) first
export function tiersOf (mods: SimMod[], group: string): SimMod[] {
  return mods.filter(m => m.group === group).sort((a, b) => b.level - a.level || b.weight - a.weight)
}

// The "T1..Tn" a mod has in its group (1 = best)
export function tierNumber (mods: SimMod[], mod: SimMod): number {
  return tiersOf(mods, mod.group).findIndex(m => m.id === mod.id) + 1
}

// Wanted: this group at tier `minTier` or better
export function wantGroup (mods: SimMod[], group: string, minTier: number): Want {
  return { group, ids: tiersOf(mods, group).slice(0, Math.max(1, minTier)).map(m => m.id) }
}

// number of random affixes a fresh rare gets (game odds are not published; these
// match what the community measured: 4/5/6 = 8/12, 3/12, 1/12; jewels 3/4)
function rareAffixCount (pool: SimPool, rnd: () => number): number {
  const r = rnd()
  if (pool.maxAffixes <= 2) return r < 0.65 ? 3 : 4
  return r < 8 / 12 ? 4 : r < 11 / 12 ? 5 : 6
}

interface Item { mods: SimMod[], prefixes: number, suffixes: number }

function newItem (): Item { return { mods: [], prefixes: 0, suffixes: 0 } }

function addMod (item: Item, mod: SimMod) {
  item.mods.push(mod)
  if (mod.type === 'Prefix') item.prefixes++
  else item.suffixes++
}

// one random mod the item can take (null = none left); `cap` = prefixes/suffixes allowed
function rollOne (pool: SimPool, item: Item, cap: number, rnd: () => number, only?: 'Prefix' | 'Suffix'): SimMod | null {
  let total = 0
  const groups = new Set(item.mods.map(m => m.group))
  const ok: SimMod[] = []
  for (const m of pool.mods) {
    if (groups.has(m.group)) continue
    if (only && m.type !== only) continue
    if (m.type === 'Prefix' ? item.prefixes >= cap : item.suffixes >= cap) continue
    ok.push(m)
    total += m.weight
  }
  if (total <= 0) return null
  let r = rnd() * total
  for (const m of ok) {
    r -= m.weight
    if (r < 0) return m
  }
  return ok[ok.length - 1]
}

function fillRare (pool: SimPool, item: Item, count: number, rnd: () => number) {
  const cap = pool.maxAffixes
  while (item.mods.length < count) {
    const m = rollOne(pool, item, cap, rnd)
    if (!m) break
    addMod(item, m)
  }
}

function hasWant (item: Item, want: Want): boolean {
  return item.mods.some(m => want.ids.includes(m.id))
}

function rollChaos (pool: SimPool, rnd: () => number): Item {
  const item = newItem()
  fillRare(pool, item, rareAffixCount(pool, rnd), rnd)
  return item
}

function rollEssence (pool: SimPool, essence: SimMod, rnd: () => number): Item {
  const item = newItem()
  addMod(item, essence)
  fillRare(pool, item, rareAffixCount(pool, rnd), rnd)
  return item
}

function sideOf (pool: SimPool, want: Want): 'Prefix' | 'Suffix' | undefined {
  return pool.mods.find(m => want.ids.includes(m.id))?.type
}

// a 1-mod magic item: Augmentation is worth it when the free side can still give
// a missing wanted mod and the item doesn't need a reroll anyway
function augHelps (pool: SimPool, item: Item, wants: Want[]): boolean {
  const free = item.prefixes ? 'Suffix' : 'Prefix'
  const missing = wants.filter(w => !hasWant(item, w))
  const have = wants.length - missing.length
  return missing.length === 1 && have === wants.length - 1 && sideOf(pool, missing[0]) === free
}

export type Currency = 'Chaos Orb' | 'Orb of Alteration' | 'Orb of Augmentation' | 'Regal Orb' | 'essence'

// Alteration: magic item with 1 or 2 mods (at most one prefix and one suffix).
// Augmentation fills the empty side, but only when the one mod is a wanted one.
function rollAlt (pool: SimPool, wants: Want[], rnd: () => number, use: (c: Currency) => void): Item {
  const item = newItem()
  use('Orb of Alteration')
  const first = rollOne(pool, item, 1, rnd)
  if (first) addMod(item, first)
  if (rnd() < 0.5) {
    const second = rollOne(pool, item, 1, rnd)
    if (second) addMod(item, second)
  } else if (item.mods.length === 1 && augHelps(pool, item, wants)) {
    use('Orb of Augmentation')
    const aug = rollOne(pool, item, 1, rnd)
    if (aug) addMod(item, aug)
  }
  return item
}

export function simulate (pool: SimPool, wants: Want[], opts: SimOptions): SimResult {
  const rnd = opts.random ?? Math.random
  const trials = Math.max(1, Math.min(200_000, Math.floor(opts.trials ?? 50_000)))
  const result: SimResult = { method: opts.method, trials, hits: 0, chance: 0, attempts: Infinity, each: wants.map(() => 0), used: {} }
  const use = (c: Currency) => { result.used[c] = (result.used[c] ?? 0) + 1 }
  if (!wants.length) {
    result.impossible = 'Pick at least one mod you want.'
    return result
  }
  const pre = wants.filter(w => sideOf(pool, w) === 'Prefix').length
  const suf = wants.filter(w => sideOf(pool, w) === 'Suffix').length
  const cap = pool.maxAffixes
  if (pre > cap || suf > cap) {
    result.impossible = `An item can only have ${cap} prefixes and ${cap} suffixes.`
    return result
  }
  if (new Set(wants.map(w => w.group)).size !== wants.length) {
    result.impossible = 'Two wanted mods are in the same group; an item can only have one of them.'
    return result
  }
  let essence: SimMod | undefined
  if (opts.method === 'essence') {
    essence = pool.mods.find(m => m.id === opts.essenceModId)
    if (!essence) {
      result.impossible = 'Pick an essence.'
      return result
    }
  }
  if ((opts.method === 'alt') && (pre > 1 || suf > 1)) {
    result.impossible = 'Alteration + Augmentation gives at most one prefix and one suffix.'
    return result
  }
  if (opts.method === 'altRegal' && wants.length < 2) {
    result.impossible = 'For one mod, Alteration + Augmentation alone is cheaper.'
    return result
  }
  if (opts.method === 'altRegal' && (pre + suf > 3 || pre > 2 || suf > 2)) {
    result.impossible = 'Alteration + Augmentation + Regal gives three mods at most (two of one kind).'
    return result
  }

  for (let t = 0; t < trials; t++) {
    let item: Item
    if (opts.method === 'chaos') {
      use('Chaos Orb')
      item = rollChaos(pool, rnd)
    } else if (opts.method === 'essence') {
      use('essence')
      item = rollEssence(pool, essence!, rnd)
    } else {
      item = rollAlt(pool, wants, rnd, use)
      if (opts.method === 'altRegal') {
        // Regal only when the magic item has every wanted mod but one: the
        // Regal Orb can add the last one (Augmentation first on a 1-mod item)
        const missing = wants.filter(w => !hasWant(item, w)).length
        if (missing <= 1) {
          if (wants.some(w => !hasWant(item, w))) {
            use('Regal Orb')
            const regal = rollOne(pool, item, cap, rnd)
            if (regal) addMod(item, regal)
          }
        }
      }
    }
    let all = true
    wants.forEach((w, i) => {
      if (hasWant(item, w)) result.each[i]++
      else all = false
    })
    if (all) result.hits++
  }
  result.chance = result.hits / trials
  result.attempts = result.hits ? trials / result.hits : Infinity
  result.each = result.each.map(n => n / trials)
  return result
}

// Exact chance that a fresh Chaos Orb roll contains one mod (sanity check and
// quick view for single mods; the simulation covers combinations)
export function singleModChanceOneRoll (pool: SimPool, want: Want): number {
  const total = pool.mods.reduce((s, m) => s + m.weight, 0)
  const hit = pool.mods.filter(m => want.ids.includes(m.id)).reduce((s, m) => s + m.weight, 0)
  return total > 0 ? hit / total : 0
}

// Average cost in chaos until one hit, from what the simulation used and the
// currency prices (name -> chaos each). undefined = a price is missing.
export function costPerHit (res: SimResult, price: (name: string) => number | undefined, essenceName?: string): number | undefined {
  if (!res.hits) return undefined
  let total = 0
  for (const [c, n] of Object.entries(res.used) as Array<[Currency, number]>) {
    const each = c === 'Chaos Orb' ? 1 : price(c === 'essence' ? (essenceName ?? '') : c)
    if (each == null) return undefined
    total += each * n
  }
  return total / res.hits
}

export function fmtChance (chance: number): string {
  if (chance <= 0) return '0%'
  if (chance >= 0.1) return `${(chance * 100).toFixed(0)}%`
  if (chance >= 0.001) return `${(chance * 100).toFixed(2)}%`
  return `1 in ${Math.round(1 / chance).toLocaleString('en-ZA')}`
}
