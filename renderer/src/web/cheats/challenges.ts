// Deathloom fork (Q2): Covens of Umbra (3.30) league challenges for Cheat sheets →
// Challenges. Pure data + logic (tested in tests/). Ticks are manual and saved on
// this PC per league: nothing is read from GGG's site, API or the game.
//
// The list was cross-checked on 20 Nov 2026 between two fan sites (GGG's own
// pages, poedb and the wiki can't be fetched from where this was written): same
// 40 names in the same order. Requirement and step text is short, in our own
// words where it isn't just a name or a count. Tips are ours. Replace this list
// at each league start (and CHALLENGE_LEAGUE with it).
import { VENDOR_RECIPES } from '../companion/vendor-recipes'

export const CHALLENGE_LEAGUE = 'Covens'
export const CHALLENGE_LEAGUE_LABEL = 'Covens of Umbra (3.30)'

export const CHALLENGE_SOURCES = {
  aoeah: { label: 'AOEAH: PoE 3.30 Challenge Rewards & Complete Guide', url: 'https://www.aoeah.com/news/4936--poe-330-challenge-rewards--complete-guide-covens-of-umbra' },
  poepsn: { label: 'PoE - PSN: Covens of Umbra Challenges Planner', url: 'https://poepsn.blogspot.com/2026/11/pathofexile-covens-of-umbra-league-330-challenges-guide-planner.html' }
} as const
export type ChallengeSource = keyof typeof CHALLENGE_SOURCES
export const CHALLENGES_CHECKED = '2026-11-20'

// Cheat sheets tabs a challenge can point at (checked against the real tab list in tests)
export type ChallengeTab = 'recipes' | 'threads' | 'leagues' | 'covens' | 'bosses' | 'progress'

export interface Challenge {
  id: string
  name: string
  // what to do, short
  req: string
  // the parts, as the game lists them ("(30)" = how many times)
  steps?: string[]
  // how many of the steps count it done ("any five of"); all steps when left out
  need?: number
  tip?: string
  // a Cheat sheets tab with the matching facts
  tab?: ChallengeTab
  // another panel worth opening (text only)
  where?: string
  sources: ChallengeSource[]
}

const BOTH: ChallengeSource[] = ['aoeah', 'poepsn']
const PINNACLES = ['Sirus, Awakener of Worlds', 'The Elder', 'The Maven', 'The Searing Exarch', 'The Eater of Worlds', 'High Templar Venarius', 'The Shaper', 'Incarnation of Dread', 'Incarnation of Fear', 'Incarnation of Neglect']
const NIGHTMARE_MAPS = ['Abomination', 'Citadel', 'Fortress', 'Sanctuary', 'Ziggurat']

// Peddler's Produce steps come from the vendor recipe list (one place to update)
export function peddlerSteps (name: string): string[] {
  return VENDOR_RECIPES.filter(r => r.challenge?.name === name).map(r => `${r.challenge!.items} (recipe: ${r.name})`)
}

export const CHALLENGES: Challenge[] = [
  { id: 'beginners-basics', name: 'Beginner\'s Basics', req: 'Use each of these currency items.', steps: ['Orb of Transmutation', 'Orb of Augmentation', 'Orb of Alteration', 'Orb of Alchemy'], tip: 'Crafting bench options count too.', sources: BOTH },
  { id: 'witchs-wishes', name: 'Witch\'s Wishes', req: 'Do each of these Covens encounters.', steps: ['Kill a Unique Monster empowered by at least 1 Fate', 'Place a Viscera in your Wickerman'], tab: 'covens', sources: BOTH },
  { id: 'peddlers-produce-1', name: 'Peddler\'s Produce I', req: 'Get each of these items from a vendor recipe (buying them doesn\'t count).', steps: peddlerSteps('Peddler\'s Produce I'), tip: 'Easy while levelling: the trophy recipes in Vendor recipes.', tab: 'recipes', sources: BOTH },
  { id: 'act-adversaries-1', name: 'Act Adversaries I', req: 'Defeat the act bosses of acts 1–5.', steps: ['Act 1: Merveil, the Twisted', 'Act 2: Vaal Oversoul', 'Act 3: Dominus, Ascendant', 'Act 4: Malachai, The Nightmare', 'Act 5: Kitava, the Insatiable'], where: 'Campaign guide panel', sources: BOTH },
  { id: 'gifted-gods', name: 'Gifted Gods', req: 'Defeat each of these Pantheon gods while empowered by at least 1 Fate.', steps: ['Tukohama', 'Abberath', 'Ryslatha', 'Ralakesh', 'Gruthkul', 'Yugul', 'Shakari', 'Garukhan'], tab: 'covens', sources: BOTH },
  { id: 'equipped-effigy', name: 'Equipped Effigy', req: 'Have a Viscera in every slot of your Wickerman.', tab: 'covens', sources: BOTH },
  { id: 'act-adversaries-2', name: 'Act Adversaries II', req: 'Defeat the act bosses of acts 6–10.', steps: ['Act 6: Tsoagoth, The Brine King', 'Act 7: Arakaali, Spinner of Shadows', 'Act 8: Lunaris and Solaris', 'Act 9: The Depraved Trinity', 'Act 10: Kitava, the Insatiable'], where: 'Campaign guide panel', sources: BOTH },
  { id: 'atlas-additions', name: 'Atlas Additions', req: 'Do any five of these the number of times shown.', need: 5, steps: ['Complete Ore Deposits (30)', 'Open Strongboxes (30)', 'Defeat Mercenaries (30)', 'Defeat Rogue Exiles (30)', 'Activate Shrines (30)', 'Defeat monsters with Essences (30)', 'Defeat Possessed monsters (30)', 'Have Sacred Flora spread Wisps (30)'], tip: 'Comes by itself while mapping; Strongboxes, Shrines and Essences are the quickest.', tab: 'leagues', sources: BOTH },
  { id: 'atlas-authorities', name: 'Atlas Authorities', req: 'Do any five of these league mechanics the number of times shown.', need: 5, steps: ['Complete Rituals (50)', 'Complete Ultimatum waves (50)', 'Defeat Incursion Architects (50)', 'Complete Expeditions (30)', 'Complete Unstable Breaches or Hives (30)', 'Complete Legion encounters (30)', 'Complete Syndicate member encounters (80)', 'Complete Blights (30)', 'Capture red beasts (100)', 'Complete Abysses (30)'], tip: 'Pick the five your atlas tree already runs; Threads of that mechanic add more per map.', tab: 'leagues', where: 'Atlas tree panel → ⋯ → ready-made tree', sources: BOTH },
  { id: 'foretold-foes', name: 'Foretold Foes', req: 'Defeat 50 Fate-empowered unique map bosses.', tab: 'covens', sources: BOTH },
  { id: 'intrepid-investigator', name: 'Intrepid Investigator', req: 'Complete all non-unique maps on the Atlas.', tip: 'Also gives atlas bonus points: tick off maps as you go.', sources: BOTH },
  { id: 'agonising-adversaries', name: 'Agonising Adversaries', req: 'Do any five of these endgame encounters the number of times shown.', need: 5, steps: ['Claim rewards from rare maps your Atlas Runners completed (30)', 'Open Unique Strongboxes (5)', 'Defeat Infamous Mercenaries (5)', 'Defeat Possessed Rogue Exiles (10)', 'Activate Apparition or Evolving Shrines (10)', 'Defeat an Essence monster with Hysteria, Horror, Delirium or Insanity (1)', 'Defeat Possessed map bosses (10)', 'Defeat bosses from Sacred Flora in maps (3)'], tab: 'leagues', sources: BOTH },
  { id: 'fundamental-foes', name: 'Fundamental Foes', req: 'Do any five of these the number of times shown, at area level 81+ where possible.', need: 5, steps: ['Complete all Rituals in maps with a Blood-filled Vessel (10)', 'Fully complete Ultimatums (10)', 'Defeat Queen Atziri in the Temple of Atzoatl (5)', 'Complete Logbooks with 10+ Remnants (5)', 'Complete Hive Fortresses or defeat Breach Marshals (5)', 'Domain of Timeless Conflict with 25+ reward crystals shattered (3)', 'Complete Syndicate Safehouses (5)', 'Complete Blighted or Blight-ravaged maps (5)', 'Defeat Bestiary bosses (3)', 'Complete Abyssal Depths (5)'], tab: 'leagues', sources: BOTH },
  { id: 'sigil-slayer', name: 'Sigil Slayer', req: 'Kill unique map bosses in red-tier maps with 400 invoked Fate tiers in total on them.', tab: 'covens', sources: BOTH },
  { id: 'creative-currencies', name: 'Creative Currencies', req: 'Use any 12 of these currency items.', need: 12, steps: ['Orb of Chance', 'Orb of Scouring', 'Orb of Fusing', 'Jeweller\'s Orb', 'Chromatic Orb', 'Vaal Orb', 'Orb of Annulment', 'Regal Orb', 'Chaos Orb', 'Exalted Orb', 'Blessed Orb', 'Ancient Orb', 'Divine Orb', 'Fracturing Orb', 'Sacred Orb', 'Hinekora\'s Lock', 'Mirror of Kalandra'], tip: 'Crafting bench options count. Chromatic and Jeweller\'s also come from vendor recipes.', tab: 'recipes', sources: BOTH },
  { id: 'vital-voidstones', name: 'Vital Voidstones', req: 'Socket four Voidstones into your Atlas.', tab: 'progress', sources: BOTH },
  { id: 'achieve-ascension', name: 'Achieve Ascension', req: 'Do each of these ascendancy tasks.', steps: ['Ascendancy Device in the Labyrinth', 'Ascendancy Device in the Cruel Labyrinth', 'Ascendancy Device in the Merciless Labyrinth', 'Ascendancy Device in the Eternal Labyrinth', 'Gain a Bloodline Class'], tab: 'progress', sources: BOTH },
  { id: 'promised-profits', name: 'Promised Profits', req: 'Defeat Fate-empowered bosses to get any ten of these reward types the number of times shown.', need: 10, steps: ['Unique Item (30)', 'Gem (30)', 'Increased Item Rarity (30)', 'Currency Items (30)', 'Viscera Item (30)', 'Threads (30)', 'Stacked Decks (30)', 'Gold (30)', 'Maps (30)', 'Fated Equipment (60)', 'Dreadmaidens\' Sacrament', 'Hide of the Vendigo', 'Corpse Rose', 'Ordered Fate', 'Doedre\'s Tongue'], tab: 'covens', sources: BOTH },
  { id: 'dubious-divination', name: 'Dubious Divination', req: 'Do each of these divination card tasks.', steps: ['Open Stacked Decks (100)', 'Turn in divination card sets (50)'], tip: 'Cheap one-card sets count: turn them in as you go.', sources: BOTH },
  { id: 'peddlers-produce-2', name: 'Peddler\'s Produce II', req: 'Get each of these items from a vendor recipe.', steps: peddlerSteps('Peddler\'s Produce II'), tip: 'The trophy recipes in Vendor recipes say what to sell.', tab: 'recipes', sources: BOTH },
  { id: 'mysterious-mirages', name: 'Mysterious Mirages', req: 'Do any three of these Mirage encounters.', need: 3, steps: ['Choose Wishes (30)', 'Choose Wishes with Sigils of Navira (10)', 'Choose Wishes with Sigils of Ruzhan (10)', 'Choose Wishes with Sigils of Kelari (10)', 'Defeat map bosses in Miraged areas (50)', 'Defeat Saresh, of the Weeping Black'], tab: 'leagues', sources: BOTH },
  { id: 'vulgar-viscera', name: 'Vulgar Viscera', req: 'Place any eight of these Viscera on your Wickerman.', need: 8, steps: ['Minotaur Head', 'Hydra Head', 'Chimera Head', 'Phoenix Head', 'Constrictor Head', 'Purifier Head', 'Enslaver Head', 'Eradicator Head', 'Baran\'s Head', 'Veritania\'s Head', 'Drox\'s Head', 'Al-Hezmin\'s Head', 'Nightmarish Book of Depravity', 'Nightmarish Head of Uhtred', 'Nightmarish Core of the Unbreakable', 'Nightmarish Wings of Lycia', 'Nightmarish Wings of Catarina'], tip: 'The heads come from guardian, Conqueror and Nightmare bosses you fight for other challenges anyway.', tab: 'covens', sources: BOTH },
  { id: 'unequaled-uniques', name: 'Unequaled Uniques', req: 'Complete any 15 of these unique maps.', need: 15, steps: ['Vaults of Atziri', 'Maelström of Chaos', 'The Coward\'s Trial', 'Acton\'s Nightmare', 'Poorjoy\'s Asylum', 'Mao Kun', 'Oba\'s Cursed Trove', 'Olmec\'s Sanctum', 'Death and Taxes', 'Whakawairua Tuahu', 'The Vinktar Square', 'Caer Blaidd, Wolfpack\'s Den', 'The Putrid Cloister', 'Hallowed Ground', 'The Twilight Temple', 'Pillars of Arun', 'Doryani\'s Machinarium', 'Hall of the Grandmasters'], tip: 'Low-tier unique maps are usually cheap to buy.', sources: BOTH },
  { id: 'tangled-threads', name: 'Tangled Threads', req: 'Complete maps with 1000 Threads in total.', tip: 'Counts every Thread you put in the map device; the Thread planner shows the cost per map.', tab: 'threads', sources: BOTH },
  { id: 'complicit-corruption', name: 'Complicit Corruption', req: 'Do any three of these corruption tasks.', need: 3, steps: ['Use Vaal Orbs (20)', 'Use Volatile Vaal Orbs (3)', 'Use Tainted Currency (20)', 'Double-corrupt items (5)', 'Turn in divination card sets that give corrupted items (15)'], sources: BOTH },
  { id: 'brilliant-branding', name: 'Brilliant Branding', req: 'Defeat map bosses with any ten of these tier 3 Fates invoked, in tier 16 maps with at least 100% Atlas Drops.', need: 10, steps: ['Crowkeeper', 'Sanguine', 'Incandescent', 'Dryad', 'Deathbringer', 'Torchbearer', 'Blood Moon', 'Wildfire', 'Murderous', 'Gravewalker', 'Houndmaster', 'Black Frost', 'Conjurer', 'Golemancer', 'Doomsayer', 'Avalanche', 'Butcher', 'Alchemist', 'Stormcaller', 'Tempestuous'], tab: 'covens', sources: BOTH },
  { id: 'cross-contamination', name: 'Cross Contamination', req: 'Do any six of these mixed league encounters.', need: 6, steps: ['Defeat a rare Sacred Fauna fertilised by Ritual ground', 'Defeat a Chaos-Blessed Rogue Exile', 'Defeat an Architect while affected by a Tempest', 'Defeat a Possessed Runic monster', 'Defeat a Breach Marshal while Delirious', 'Defeat a Legion General tagged by a Sentinel', 'Defeat a Syndicate member while affected by a Shrine', 'Open a Blighted Strongbox', 'Capture a beast holding an Essence', 'Defeat a Chaplain of the Well'], tab: 'leagues', sources: BOTH },
  { id: 'legacied-lineage', name: 'Legacied Lineage', req: 'Defeat any seven of these bosses or encounters.', need: 7, steps: ['The Trialmaster', 'The King in the Mists', 'Oshabi', 'Catarina', 'Aul', 'Olroth', 'Lycia', 'Farrul', 'Simulacrum', 'It That Was Tul and It That Was Esh', 'Saresh', 'Zorath'], tab: 'bosses', sources: BOTH },
  { id: 'adjacent-anomalies', name: 'Adjacent Anomalies', req: 'Complete 30 Atlas Anomalies.', sources: BOTH },
  { id: 'overpowering-omens', name: 'Overpowering Omens', req: 'Defeat the final boss of any twelve of these rare maps: tier 16, at least 100% Atlas Drops, empowered by a tier 3 Fate.', need: 12, steps: ['Maze of the Minotaur', 'Lair of the Hydra', 'Pit of the Chimera', 'Forge of the Phoenix', 'Map with the Constrictor', 'Map with the Purifier', 'Map with the Enslaver', 'Map with the Eradicator', 'Map with Baran\'s Citadel', 'Map with Veritania\'s Citadel', 'Map with Drox\'s Citadel', 'Map with Al-Hezmin\'s Citadel', ...NIGHTMARE_MAPS], tab: 'covens', sources: BOTH },
  { id: 'atlas-adventure', name: 'Atlas Adventure', req: 'Reach 25,000 Atlas Drops in total completing maps.', sources: BOTH },
  { id: 'otherworldly-obstructions', name: 'Otherworldly Obstructions', req: 'Do any two of these Eldritch encounters the number of times shown.', need: 2, steps: ['Activate Eater of Worlds altars (250)', 'Activate Searing Exarch altars (250)', 'Defeat Maven-witnessed map bosses (200)'], sources: BOTH },
  { id: 'amazingly-accomplished-atlas', name: 'Amazingly Accomplished Atlas', req: 'Allocate all Atlas passive skill points.', tab: 'progress', where: 'Atlas tree panel', sources: BOTH },
  { id: 'astounding-augury', name: 'Astounding Augury', req: 'Defeat any five of these pinnacle bosses with their Grim Fates invoked.', need: 5, steps: PINNACLES, tab: 'bosses', sources: BOTH },
  { id: 'zanas-zealotry', name: 'Zana\'s Zealotry', req: 'Reach 300 explicit modifiers in total completing Originator-influenced maps.', sources: BOTH },
  { id: 'woven-wonders', name: 'Woven Wonders', req: 'Complete tier 14+ rare maps with at least 100% Atlas Drops and 8 Threads of one type, for any five of these types, 10 times each.', need: 5, steps: ['Ritual (10)', 'Ultimatum (10)', 'Incursion (10)', 'Expedition (10)', 'Breach (10)', 'Legion (10)', 'Betrayal (10)', 'Blight (10)', 'Bestiary (10)', 'Abyss (10)'], tip: 'Pick the five cheapest Threads: the Thread planner shows the cost of 8.', tab: 'threads', sources: BOTH },
  { id: 'nightmarish-nests', name: 'Nightmarish Nests', req: 'Complete any three of these Nightmare maps, 5 times each.', need: 3, steps: NIGHTMARE_MAPS.map(m => `${m} (5)`), sources: BOTH },
  { id: 'deceptive-darktongue-deals', name: 'Deceptive Darktongue Deals', req: 'Defeat The Coven Queen in any three of these ways.', need: 3, steps: ['No more than 4 stacks of Corpserot', 'Without Blackfire or Blackfire Tornado on you', 'Without being hit by Crowstorm Vortex', 'Without being hit by Blackfire Detonation'], tab: 'covens', sources: BOTH },
  { id: 'ultimate-undertaking', name: 'Ultimate Undertaking', req: 'Defeat any three of these pinnacle bosses at area level 85 with their Grim Fates invoked.', need: 3, steps: PINNACLES, tab: 'bosses', sources: BOTH },
  { id: 'grand-goal-grind', name: 'Grand Goal Grind', req: 'Do any four of these the number of times shown.', need: 4, steps: ['Reach level 100', 'Use the Divine Font in the endgame Labyrinth (50)', 'Complete rare Shaper, Elder, Conqueror or Memory Guardian maps with at least 100% Atlas Drops (50)', 'Complete rare tier 16 maps with 8+ Threads of any league mechanic (150)', 'Defeat level 83+ rare monsters with 6+ modifiers (100)', 'Defeat map bosses in rare tier 16 maps empowered by a tier 3 Fate (100)'], sources: BOTH }
]

// how many challenges the league has (GGG lists 40; Ruthless adds its own, not listed here)
export const CHALLENGE_TOTAL = 40
// challenges GGG has but this list doesn't have yet (shown in the panel)
export const challengesMissing = () => Math.max(0, CHALLENGE_TOTAL - CHALLENGES.length)

// ---- ticks (manual, per league, on this PC) ---------------------------------

export const CHALLENGE_TICKS_KEY = 'deathloom.cheats.challenges.v1'

// Softcore, Hardcore and SSF share one set of challenges in PoE; Ruthless has its own.
export function challengeLeagueKey (league: string | null | undefined): string {
  const l = (league ?? '').trim()
  if (!l) return ''
  const ruthless = /\bRuthless\b/i.test(l)
  const base = l.replace(/\b(Hardcore|HC|SSF|Solo Self-Found|Ruthless)\b/gi, ' ').replace(/\s+/g, ' ').trim() || l
  return ruthless ? `Ruthless ${base}` : base
}

// a step tick id: "<challenge id>:<step index>"
export const stepId = (c: Challenge, i: number) => `${c.id}:${i}`

const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string')

export function loadChallengeTicks (league: string): Set<string> {
  const key = challengeLeagueKey(league)
  try {
    const all = JSON.parse(localStorage.getItem(CHALLENGE_TICKS_KEY) ?? '{}')
    const list = all && typeof all === 'object' && Object.prototype.hasOwnProperty.call(all, key) ? all[key] : null
    if (isStrList(list)) return new Set(list.slice(0, 2000))
  } catch {}
  return new Set()
}

export function saveChallengeTicks (league: string, ticks: Set<string>) {
  const key = challengeLeagueKey(league)
  try {
    let all: Record<string, string[]> = {}
    try {
      const parsed = JSON.parse(localStorage.getItem(CHALLENGE_TICKS_KEY) ?? '{}')
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) all = parsed
    } catch {}
    const next: Record<string, string[]> = Object.create(null)
    for (const [k, v] of Object.entries(all)) if (k !== key && isStrList(v)) next[k] = v
    if (ticks.size) next[key] = [...ticks]
    localStorage.setItem(CHALLENGE_TICKS_KEY, JSON.stringify(next))
  } catch {}
}

export function toggleTick (ticks: Set<string>, id: string): Set<string> {
  const t = new Set(ticks)
  if (t.has(id)) t.delete(id)
  else t.add(id)
  return t
}

export const isDone = (ticks: Set<string>, c: Challenge) => ticks.has(c.id)
export const doneCount = (ticks: Set<string>, list: Challenge[] = CHALLENGES) => list.filter(c => ticks.has(c.id)).length
export const stepsDone = (ticks: Set<string>, c: Challenge) => (c.steps ?? []).filter((_, i) => ticks.has(stepId(c, i))).length
export const stepsNeeded = (c: Challenge) => c.need ?? c.steps?.length ?? 0

export type ChallengeFilter = 'all' | 'todo' | 'done'
export function filterChallenges (ticks: Set<string>, filter: ChallengeFilter, list: Challenge[] = CHALLENGES): Challenge[] {
  if (filter === 'todo') return list.filter(c => !ticks.has(c.id))
  if (filter === 'done') return list.filter(c => ticks.has(c.id))
  return list
}
