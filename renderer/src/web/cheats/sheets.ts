// Deathloom fork: cheat sheets (Cheat sheets panel). Our own short text, written
// for this fork from how the mechanics work; no third-party text or images.
// Only things that rarely change; GGG reworks league mechanics now and then, so
// each sheet says where to check in game. Vendor recipes come from vendor-recipes.ts.

export interface SheetSection { title: string, lines: string[], focus?: string }

export interface Sheet {
  id: string
  label: string
  intro: string
  sections: SheetSection[]
  check: string
  // optional switch (e.g. mapping profit / bosses / levelling); sections without
  // a focus show under every choice
  focuses?: Array<{ id: string, label: string }>
}

export function sectionsFor (sheet: Pick<Sheet, 'sections' | 'focuses'>, focus: string | null | undefined): SheetSection[] {
  if (!sheet.focuses?.length) return sheet.sections
  const f = sheet.focuses.some(x => x.id === focus) ? focus : sheet.focuses[0].id
  return sheet.sections.filter(s => !s.focus || s.focus === f)
}

export const SHEETS: Sheet[] = [
  {
    id: 'covens',
    label: 'Covens (3.30)',
    intro: 'Covens of Umbra: covenites hold rituals around cauldrons. Beat a ritual to pick a Fate for that area\'s boss; Fate-empowered bosses drop Viscera that you put on your Wickerman for a lasting buff. Pick what you\'re doing below.',
    focuses: [
      { id: 'levelling', label: 'Levelling' },
      { id: 'mapping', label: 'Mapping profit' },
      { id: 'bosses', label: 'Bosses' }
    ],
    sections: [
      {
        title: 'The loop',
        lines: [
          'Ritual → Fate: beating a coven ritual lets you choose a Fate for the area boss. Up to 3 Fates on one boss; you can hold more and choose which 3.',
          'Fates make the boss harder and its loot better (currency, uniques, maps). Matching Fates unlock rarer rewards (Exceptional supports, new uniques). Same Fate more than once (3.30.0b): the 1st and 3rd copy triple their reward, the 2nd does nothing, so use 1 or 3 copies, never 2. Exception (3.30.0d): outcomes that guarantee a single Divine Orb or Orb of Annulment need only 2 copies.',
          'The area shows how many Fates are available in it (3.30.0d counter).',
          'Wickerman: 4 slots (head, arm, body, leg), so up to 4 Viscera active. Each Viscera is a boss-specific buff (life, regen, poison and more).',
          'Viscera come in 3 tiers; the top tier only from endgame versions of bosses.'
        ]
      },
      {
        focus: 'levelling',
        title: 'Levelling',
        lines: [
          'Mora helps you break up the rituals from the first areas of act 1.',
          'Over two dozen campaign areas now have a boss: Fating them gives power, gems and currency but makes acts longer. Do it when your build kills bosses easily, skip it when it doesn\'t.',
          'Fill the Wickerman early with life / regen Viscera; swap for damage ones later.',
          'Single-target damage and defences matter more this league: the rewards come from bosses.',
          'Keep the act splits (Deaths column) honest: a Fate that keeps killing you isn\'t worth it while levelling.'
        ]
      },
      {
        focus: 'mapping',
        title: 'Mapping profit',
        lines: [
          'Fate map bosses you can kill fast; pick Fates whose combos give the rewards you sell, and skip ones that slow you down.',
          'Threads replace Scarabs: the money ones will be expensive at league start and drop later. Track them in Market history.',
          'Item rarity matters more in 3.30: it decides the drop pools. Most Divines come from tough rares and uniques, not trash packs.',
          'Higher-tier magic and rare items drop now (tiers 2–5; tier 5 magic can be fractured): check your loot filter isn\'t hiding good bases.',
          'Mirage can cover a whole map and roll as a map mod: fast clear for loot.',
          'Use the Loot buttons and Cost/map in This session to see if your Fates and Threads actually pay.'
        ]
      },
      {
        focus: 'bosses',
        title: 'Bosses',
        lines: [
          'Abomination map (3.30.0d): the Nightmare of the Depraved Trinity is now the only boss there that gains the Fate empowerment, and it can drop every Fate Empowerment item.',
          'Fated bosses in higher-tier atlas areas can drop Grim Fates. They are kept on the Wickerman until used, and each belongs to one pinnacle boss.',
          'A Grim Fate pinnacle boss gets new attacks (seen: Sirus with crow swarms, Uber Elder beams from portals, Shaper mirror illusions) and drops Pinnacle Boss Viscera, among the strongest Wickerman buffs.',
          'Beating a Grim Fate pinnacle is the road to the Coven Queen (exact steps: check in game).',
          'Each boss has its own Viscera: farming one boss is how you chase its buff.',
          'Before a Fated pinnacle: read the Fates on it, plan for the extra mechanics, and keep a portal for the last phase.'
        ]
      }
    ],
    check: 'Fate list, combos and Viscera values: check in game and GGG\'s Covens page (pathofexile.com/covens); some details were not announced.'
  },
  {
    id: 'betrayal',
    label: 'Betrayal',
    intro: 'Jun\'s Immortal Syndicate: beat members in encounters, then choose what to do with them. Raid safehouses for the rewards on the board.',
    sections: [
      {
        title: 'After beating a member',
        lines: [
          'Interrogate: they leave the board, you gain intelligence for that division.',
          'Execute: rank up (or remove) that member; others may become hostile.',
          'Bargain: take the offered reward (currency, items, intelligence, …) instead.',
          'Release / betray: they move or swap divisions; use it to put members where you want them.'
        ]
      },
      {
        title: 'Planning the board',
        lines: [
          'Four divisions: Transportation, Fortification, Research, Intervention.',
          'A full intelligence bar opens that division\'s safehouse; the leader gives the best reward.',
          'Each member\'s reward depends on their division: hover them on the Syndicate board.',
          'Research crafting benches are popular: Aisling (veiled mod), Vorici (white sockets), Hillock (quality above 20%).',
          'Raid enough safehouses and the Mastermind (Catarina) opens.'
        ]
      }
    ],
    check: 'Hover a member on the Syndicate board (Jun) to see the reward in their current division.'
  },
  {
    id: 'heist',
    label: 'Heist',
    intro: 'Contracts are one job; blueprints have several wings. Bring the rogues whose jobs the target needs.',
    sections: [
      {
        title: 'In a heist',
        lines: [
          'Alert level rises as you open things; at 100% lockdown starts and doors close: grab the target and run.',
          'Reward rooms and chests need the right job (lockpicking, perception, demolition, …).',
          'The target (curio) is at the end; picking it up starts lockdown too.',
          'Rogues level their jobs with use; their gear helps (Rogue Harbour).'
        ]
      },
      {
        title: 'Blueprints',
        lines: [
          'Reveal wings and reward rooms with Rogue\'s Markers before you go in.',
          'More wings = more rogues and more loot; the last wing has the best curio.',
          'Sell or keep the curio target; replicas and enchanted items are the big drops.'
        ]
      }
    ],
    check: 'Each rogue\'s jobs and levels are on their card in the Rogue Harbour.'
  },
  {
    id: 'delve',
    label: 'Delve',
    intro: 'Niko\'s mine: the cart lights the way, darkness hurts. Go deeper for harder monsters and better rewards.',
    sections: [
      {
        title: 'Basics',
        lines: [
          'Sulphite fuels the cart; each run costs sulphite, more the deeper you go.',
          'Stay in the light: darkness stacks damage on you. Flares light up side areas.',
          'Dynamite breaks cracked walls (hidden rooms, often fossils or currency).',
          'Spend azurite at the Voltaxic cart: sulphite capacity, light radius, flares, dynamite.'
        ]
      },
      {
        title: 'Rewards',
        lines: [
          'Map nodes show the reward type (fossils, resonators, currency, gear, …): plan the route on the mine map.',
          'Fossils + resonators craft items (resonator sockets = how many fossils).',
          'City nodes and the deep bosses unlock as you go down.'
        ]
      }
    ],
    check: 'Hover a node on the mine map to see its reward and depth.'
  },
  {
    id: 'sanctum',
    label: 'Sanctum',
    intro: 'Rooms in a vault. Resolve is your sanctum life: hits take it away; at zero the run ends.',
    sections: [
      {
        title: 'In a run',
        lines: [
          'Avoid hits: every hit you take costs resolve. Don\'t get hit is the whole game.',
          'Inspiration raises how much resolve you can have; some rooms give it back.',
          'Aureus coins buy boons and remove afflictions at the merchant.',
          'Choose rooms by their reward and their affliction or boon; deals trade a risk for a reward.',
          'Each floor ends with a boss; the last floor\'s boss gives the best rewards.'
        ]
      },
      {
        title: 'Before you start',
        lines: [
          'Relics in the relic altar give bonuses for every run: fill the altar.',
          'A build that kills safely from range or with good avoidance does best.'
        ]
      }
    ],
    check: 'Room rewards, afflictions and boons show on the sanctum map; hover them.'
  },
  {
    id: 'bosses',
    label: 'Endgame bosses',
    intro: 'The pinnacle bosses of the atlas. The Searing Exarch, the Eater of Worlds, the Maven and the Uber Elder each give one of the four voidstones the first time. Since 3.30 their quests also give more atlas points: 2 each for the Exarch, the Eater, the Maven and each Maven invitation; 4 for the Uber Elder.',
    sections: [
      {
        title: 'Before any boss',
        lines: [
          'Capped resistances (75%), chaos resistance as high as you can, and enough life or energy shield for the boss\'s big hits.',
          'Flasks that remove freeze, shock, ignite and bleed; a movement flask.',
          'Most deaths are from not moving: learn the one or two attacks that kill and walk out of them.',
          'Boss fights have a limited number of portals: don\'t waste them on easy phases.'
        ]
      },
      {
        title: 'Who and how to get there',
        lines: [
          'The Eater of Worlds and the Searing Exarch: fill their altars by running maps with that content; the boss opens when the bar is full. Altars can now drop Threads (Eater: Breach, Legion, Blight, Ritual, Incursion; Exarch: Abyss, Expedition, Betrayal, Bestiary, Ultimatum).',
          'After a pinnacle Eldritch boss (not the Maven invitation or Valdo versions) a Templar Vault can appear as an atlas anomaly.',
          'The Maven: let her witness map bosses until she drops her invitation (Maven\'s Writ).',
          'Sirus: beat the four Conquerors (influenced maps), then the Sirus fight in the Atlas.',
          'The Shaper and Elder, then the Uber Elder: from the guardians\' fragments, put together at the map device. Since 3.30 Shaper, Elder and Conqueror fragments are not used up with a map and add no item quantity.',
          'The Coven Queen: the Covens league pinnacle boss, reached through the league\'s Fates and Wickerman.',
          'Uber versions (much harder) come from the same bosses\' uber fragments and invitations.'
        ]
      },
      {
        title: 'The usual killers',
        lines: [
          'Ground effects you stand in too long (degeneration): never stand still in anything coloured.',
          'Slams with a wind-up: dodge sideways, not backwards.',
          'Stacking debuffs: move to clean ground or use the flask that removes them.'
        ]
      }
    ],
    check: 'The Atlas panel shows each boss\'s progress (altars, Maven\'s witnessed bosses, conquerors beaten).'
  },
  {
    id: 'leagues',
    label: 'Map mechanics',
    intro: 'Old league mechanics that stay in maps (as of 3.30 Covens of Umbra). What they are and the one thing to know about each.',
    sections: [
      {
        title: 'Threads of Creation (3.30: replace Scarabs)',
        lines: [
          'Scarabs are gone. Old ones turned into a matching Thread, or a Frayed Thread (Veiled Scarabs too). A Frayed Thread gives a random Thread when used or vendored.',
          'Ten Threads: Abyss, Bestiary, Betrayal, Blight, Breach, Expedition, Incursion, Legion, Ritual, Ultimatum.',
          'Put Threads in the map device: each adds its mechanic to the map; up to 8 of one kind, and each extra one makes random powerful effects on that mechanic more likely.',
          'The strongest Thread effects need 2+ Threads and a high area level (3.30.0b): area 73+ for the Blight Pantheon god, Double Down Ultimatum and the extra Breach mod; area 80+ for the extra Abyss mod, wisp beasts, Catarina joining Betrayal and rare Syndicate members.',
          'Guaranteed Thread mods (3.30.0c): 1–3 Threads at least 1 mod, 4–7 at least 2, 8+ at least 3.',
          'Bonus stat at 3 / 6 / 8 Threads (3.30.0c): Abyss +1/2/3 pits · Breach 20/40/60% more magic monsters · Blight +40/80/120% chance a lane is at least magic · Legion +1/2/3 encounters · Expedition 15/30/50% chance remnants get an extra suffix · Ultimatum more rares, from 6 rewards as one extra round · Ritual 20/40/60% more favours · Bestiary +2/3/4 red beasts · Betrayal 30/60/90% more reinforcements · Incursion 20/30/40% pack size.',
          '3.30.0c added vendor recipes for Threads and for Viscera; GGG didn\'t say what they take yet: put them in a vendor\'s sell window to see what you\'d get.',
          'Map Item Quantity is now Atlas Drops (more maps and Threads). Monster rarity now decides which loot can drop: higher rarity, better currency.',
          'New Thread mods (3.30.0d): Abyss, rare Abyssal monsters get an extra Abyssal mod; Incursion, one room holds only Architects, who drop an Itemised Temple of the current layout (random room tiers). The Breach mod that makes every rare Breach monster drop a Wombgift is rarer now; the Genesis Tree Sapling from Breach Threads gives a lot of Hiveblood.',
          'Currency drops (3.30.0d): item rarity always raises the average quality of currency that drops. Foulborn Exalted, Regal and Augmentation Orbs drop anywhere now. New: Originator\'s Exalted Orb (rare map: removes a random suffix, adds a rare-only mod; works on Nightmare Maps) and Primordial Exalted Orb (reveals a random Exotic Exalted Orb).'
        ]
      },
      {
        title: 'Atlas (3.30)',
        lines: [
          'Shaped Regions: 10 kinds, one per Thread. Finish a region\'s objective for a free Thread on the other maps in it. Astrolabes now put a chosen Shaped Region on one map.',
          'The atlas passive tree starts in the centre and grows outward: 150 points.',
          'Kirac: Magic maps cost a Transmutation, Rare maps an Alchemy. Corrupting a normal map adds 2 mods (up to 9) instead of rerolling.'
        ]
      },
      {
        title: 'In maps',
        lines: [
          'Breach: walk into the hand and kill fast; more kills in the time = more splinters for Breachstones.',
          'Legion: break the frozen monsters in the time you have; generals drop splinters for Timeless Emblems. 3.30: about a third fewer breakout Schisms.',
          'Delirium: the mirror fog makes monsters stronger and drops rewards the longer you stay; leave before it gets too strong. 3.30: Delirium Orbs make a map Delirious (5–50% each, up to 100%).',
          'Essence: a monster held by essences; corrupt it with a Remnant of Corruption only if you can handle the extra mods. 3.30: essences can now appear in any map.',
          'Ritual: kill in the circle, then spend tribute on the rewards; defer the ones you want later. 3.30: Blood-filled Vessels need Ritual Threads.',
          'Expedition: place explosives through the remnants\' area; the remnant mods make monsters stronger and loot better. 3.30: Gwennen no longer gambles items (a "take a chance" for Astragali instead).',
          'Ultimatum: win the trial rounds; each round adds a modifier. Take the reward when the next risk is too big. 3.30: rewards keep getting better after round 10.',
          'Blight: build towers on the paths before the monsters reach the pump; Blighted maps need oils on the anoint. 3.30.0d: Currency Lane monsters scale their drops with Atlas Drops; low-tier maps spawn fewer of them; Rogue Exiles in Blight are a bit weaker.',
          'Harvest: 3.30: Sacred Flora replaces the Sacred Grove; less lifeforce drops but in bigger stacks, for the crafts at the Horticrafting station. 3.30.0d: Sacred Fauna lifeforce drops at the end of the encounter, around the base of the tree.',
          'Incursion: 3.30: Atziri is now in the Temple of Atzoatl; Royal Visages replace Mortal fragments.',
          'Mirage: 3.30: now in all leagues, in maps.'
        ]
      }
    ],
    check: 'Your Threads and atlas passive tree decide how much of each you meet. Exact numbers: GGG\'s 3.30.0 patch notes.'
  }
]
