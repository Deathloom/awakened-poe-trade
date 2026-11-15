// Deathloom fork: cheat sheets (Cheat sheets panel). Our own short text, written
// for this fork from how the mechanics work; no third-party text or images.
// Only things that rarely change; GGG reworks league mechanics now and then, so
// each sheet says where to check in game. Vendor recipes come from vendor-recipes.ts.

export interface Sheet {
  id: string
  label: string
  intro: string
  sections: Array<{ title: string, lines: string[] }>
  check: string
}

export const SHEETS: Sheet[] = [
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
  }
]
