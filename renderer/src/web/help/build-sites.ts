// Deathloom fork: where to get a build (Help page, setup guide, README).
// Popular PoE1 build and atlas sites, checked 14 Nov 2026. Links open in your
// browser; Loot Goblin doesn't read these sites.

export interface BuildSite { name: string, url: string, what: string }

export const BUILD_SITES: BuildSite[] = [
  { name: 'poe.ninja builds', url: 'https://poe.ninja/builds', what: 'What the top ladder characters play right now. Open a character and copy its Path of Building code.' },
  { name: 'Maxroll', url: 'https://maxroll.gg/poe', what: 'Written build guides (league starters, endgame) with levelling steps and PoB links.' },
  { name: 'Mobalytics', url: 'https://mobalytics.gg/poe/builds', what: 'Build guides by experienced players, updated for each patch.' },
  { name: 'poebuilds.cc', url: 'https://www.poebuilds.cc', what: 'Build guide videos from streamers and sites, sorted by league, class and skill.' },
  { name: 'pobb.in', url: 'https://pobb.in', what: 'Shared Path of Building codes: paste a pobb.in link into Loot Goblin\'s import.' }
]

export const ATLAS_SITES: BuildSite[] = [
  { name: 'Maxroll: Atlas passive tree', url: 'https://maxroll.gg/poe/getting-started/atlas-passive-tree', what: 'How the atlas tree works and starter strategies.' },
  { name: 'Maxroll: Atlas progression', url: 'https://maxroll.gg/poe/getting-started/atlas-progression-guide', what: 'From your first map to the endgame bosses.' },
  { name: 'PoE-Vault: Atlas tree strategies', url: 'https://www.poe-vault.com/guides/atlas-passive-skill-tree-strategies', what: 'Atlas trees per farming strategy.' }
]
