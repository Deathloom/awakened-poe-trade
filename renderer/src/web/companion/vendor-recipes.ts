// Deathloom fork: vendor recipes worth knowing while levelling (sell the items
// together to any vendor). Checked 2026-11-14 against poedb's vendor recipe
// list (poedb.tw/us/VendorRecipes). GGG changes recipes now and then: re-check
// at each league start. Written for this fork (no third-party text copied).

export interface VendorRecipe {
  name: string
  give: string
  get: string
  // from which act it's worth doing (ingredients start dropping / become useful)
  fromAct: number
  tags: Array<'levelling' | 'currency' | 'defence'>
  note?: string
}

export const VENDOR_RECIPES: VendorRecipe[] = [
  {
    name: 'Movement speed boots',
    give: 'Normal boots + Quicksilver Flask + Orb of Augmentation',
    get: 'Magic boots with 10% movement speed',
    fromAct: 1,
    tags: ['levelling'],
    note: 'Boots that already have movement speed get +5% (up to 30%); other mods are lost. Keep one Quicksilver to use.'
  },
  {
    name: 'Physical damage weapon',
    give: 'Any weapon + magic, rare or unique Rustic Sash + Blacksmith\'s Whetstone',
    get: 'Magic weapon with increased physical damage',
    fromAct: 1,
    tags: ['levelling'],
    note: 'Magic sash 40–49%, rare 50–69%, unique 65–84%. Use a good base (high damage, sockets you need).'
  },
  {
    name: 'Added elemental damage weapon',
    give: 'Weapon with an added fire / cold / lightning damage mod (or a normal one) + Orb of Augmentation + Ruby / Sapphire / Topaz Flask',
    get: 'The same weapon with that added damage one tier higher',
    fromAct: 1,
    tags: ['levelling']
  },
  {
    name: 'Spell damage weapon',
    give: 'Dagger, sceptre, staff or wand + magic, rare or unique Chain Belt + Blacksmith\'s Whetstone',
    get: 'Magic weapon with increased spell damage',
    fromAct: 1,
    tags: ['levelling']
  },
  {
    name: '+1 spell gem weapon',
    give: 'Normal rune dagger, sceptre, staff or wand + quality gems sharing a tag (fire, cold, lightning, chaos, physical) totalling 40% quality',
    get: 'Magic weapon with +1 to level of all <tag> spell skill gems',
    fromAct: 1,
    tags: ['levelling']
  },
  {
    name: 'Chromatic Orb',
    give: 'Any item with a red, a green and a blue socket linked together',
    get: 'Chromatic Orb',
    fromAct: 1,
    tags: ['currency']
  },
  {
    name: 'Hybrid flask',
    give: 'Life flask + mana flask + Orb of Fusing',
    get: 'Hybrid flask',
    fromAct: 2,
    tags: ['levelling']
  },
  {
    name: 'Flask upgrade',
    give: '3 life (or 3 mana, or 3 hybrid) flasks of the same kind',
    get: 'One flask of the next base type',
    fromAct: 1,
    tags: ['levelling'],
    note: 'Handy when your flasks fall behind your level.'
  },
  {
    name: 'Chaos resistance ring or amulet',
    give: 'Magic or rare ring / amulet with chaos resistance + Orb of Augmentation + Amethyst Flask',
    get: 'The same item with chaos resistance one tier higher',
    fromAct: 5,
    tags: ['defence']
  },
  {
    name: 'Jeweller\'s Orbs',
    give: 'Any item with 6 sockets',
    get: '7 Jeweller\'s Orbs',
    fromAct: 1,
    tags: ['currency']
  },
  {
    name: 'Orbs of Fusing',
    give: 'Any item with 6 linked sockets',
    get: '20 Orbs of Fusing',
    fromAct: 1,
    tags: ['currency']
  },
  {
    name: 'Quality currency',
    give: 'Quality gems / flasks / weapons / armour (sell several together)',
    get: 'Gemcutter\'s Prism / Glassblower\'s Bauble / Blacksmith\'s Whetstone / Armourer\'s Scrap',
    fromAct: 1,
    tags: ['currency'],
    note: 'Gems: 40% total quality for a Gemcutter\'s Prism.'
  },
  {
    name: 'Chaos Orb (full rare set)',
    give: 'Unidentified rare set: helmet, body, gloves, boots, belt, 2 rings, amulet, weapon(s), item level 60–74',
    get: 'Chaos Orb (Regal Orb for item level 75+)',
    fromAct: 10,
    tags: ['currency'],
    note: 'Mostly for early maps.'
  }
]
