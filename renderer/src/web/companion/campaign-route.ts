// Deathloom fork: campaign guide route (PoE1, acts 1-10).
//
// Written for this fork (no third-party route data, so no licence to track).
// It's a draft: zone order and the main objectives per act. Acts 1-5 have
// more notes than 6-10. Fix anything that's off as you level and keep it short:
// one line per zone. The guide moves to the next matching zone in this list
// when Client.txt says "You have entered <zone>."

export interface RouteStep {
  zone: string
  note?: string
  // Optional side quest worth doing (passive points, useful rewards)
  optional?: boolean
  // Labyrinth trial in this zone
  trial?: boolean
  // Quest reward picked up in this zone: passive skill points (Book of Skill)
  // and/or passive respec points. Respec-only quests are marked skippable.
  // Checked 2026-11-14 against poedb's passive skill list, mobalytics'
  // "All 24 Passive Point Quests" and the quest pages (poedb / poewiki).
  reward?: { quest: string, passive?: number, respec?: number, turnIn?: string }
}

export interface RouteAct {
  act: number
  steps: RouteStep[]
}

export const ROUTE: RouteAct[] = [
  {
    act: 1,
    steps: [
      { zone: 'The Twilight Strand', note: 'Kill Hillock' },
      { zone: "Lioneye's Watch", note: 'Hand in, pick up first skill gem' },
      { zone: 'The Coast', note: 'Waypoint; head to Mud Flats (Tidal Island: Medicine Chest for the flask quest)' },
      { zone: 'The Mud Flats', note: 'Collect the 3 glyphs, open the Submerged Passage' },
      { zone: 'The Submerged Passage', note: 'Waypoint; Flooded Depths optional (Dweller of the Deep: passive point)' },
      { zone: 'The Flooded Depths', note: 'Kill the Deep Dweller', optional: true, reward: { quest: 'The Dweller of the Deep', passive: 1, turnIn: 'Tarkleigh' } },
      { zone: 'The Ledge', note: 'Run through' },
      { zone: 'The Climb', note: 'Run through to the Lower Prison' },
      { zone: 'The Lower Prison', note: 'Labyrinth trial', trial: true },
      { zone: 'The Upper Prison', note: 'Kill Brutus' },
      { zone: "Prisoner's Gate", note: 'To the Ship Graveyard' },
      { zone: 'The Ship Graveyard', note: 'Allflame in the Cave, then kill Fairgraves', reward: { quest: 'The Marooned Mariner', passive: 1, turnIn: 'Bestel' } },
      { zone: 'The Ship Graveyard Cave', note: 'Get the Allflame', optional: true },
      { zone: 'The Cavern of Wrath', note: 'Run through' },
      { zone: 'The Cavern of Anger', note: 'Kill Merveil, go to act 2' }
    ]
  },
  {
    act: 2,
    steps: [
      { zone: 'The Southern Forest', note: 'Run to the Forest Encampment' },
      { zone: 'The Forest Encampment', note: 'Hand in' },
      { zone: 'The Old Fields', note: 'To the Crossroads (Den: optional)' },
      { zone: 'The Crossroads', note: 'Hub: Chamber of Sins, Broken Bridge, Fellshrine' },
      { zone: 'The Chamber of Sins Level 1', note: 'Run through' },
      { zone: 'The Chamber of Sins Level 2', note: 'Trial; kill Fidelitas, take the Baleful Gem', trial: true },
      { zone: 'The Broken Bridge', note: 'Bandit Kraityn' },
      { zone: 'The Fellshrine Ruins', note: 'To the Crypt' },
      { zone: 'The Crypt Level 1', note: 'Trial; Golden Hand on level 2 (passive point)', trial: true },
      { zone: 'The Crypt Level 2', note: 'Golden Hand', optional: true, reward: { quest: 'Through Sacred Ground', passive: 1, respec: 2, turnIn: 'Yeena' } },
      { zone: 'The Riverways', note: 'To the Western Forest, then the Wetlands' },
      { zone: 'The Western Forest', note: 'Bandit Alira; kill Captain Arteri, take the Thaumetic Emblem', reward: { quest: 'The Way Forward', passive: 1, turnIn: 'Bestel (act 1)' } },
      { zone: "The Weaver's Chambers", note: "Kill the Weaver, take Maligaro's Spike" },
      { zone: 'The Wetlands', note: 'Bandit Oak; open the Vaal Ruins. Kill all three bandits for a passive point (or help one)', reward: { quest: 'Deal with the Bandits', passive: 1, turnIn: 'Eramir' } },
      { zone: 'The Vaal Ruins', note: 'Run through' },
      { zone: 'The Northern Forest', note: 'To the Caverns' },
      { zone: 'The Caverns', note: 'Run through' },
      { zone: 'The Ancient Pyramid', note: 'Kill the Vaal Oversoul, go to act 3' }
    ]
  },
  {
    act: 3,
    steps: [
      { zone: 'The City of Sarn', note: 'Rescue Clarissa' },
      { zone: 'The Sarn Encampment', note: 'Hand in' },
      { zone: 'The Slums', note: 'To the Crematorium' },
      { zone: 'The Crematorium', note: "Trial; kill Piety, Tolman's bracelet", trial: true },
      { zone: 'The Sewers', note: 'Collect the three busts', reward: { quest: "Victario's Secrets", passive: 1, respec: 2, turnIn: 'Hargan' } },
      { zone: 'The Marketplace', note: 'Catacombs trial is here' },
      { zone: 'The Catacombs', note: 'Labyrinth trial', trial: true },
      { zone: 'The Battlefront', note: 'Ribbon spool; to the Docks' },
      { zone: 'The Docks', note: 'Thaumetic Sulphite' },
      { zone: 'The Solaris Temple Level 1', note: 'Run through' },
      { zone: 'The Solaris Temple Level 2', note: 'Infernal Talc (Lady Dialla)' },
      { zone: 'The Ebony Barracks', note: 'Kill General Gravicius' },
      { zone: 'The Lunaris Temple Level 1', note: 'Run through' },
      { zone: 'The Lunaris Temple Level 2', note: 'Kill Piety', reward: { quest: "Piety's Pets", passive: 1, turnIn: 'Grigor' } },
      { zone: 'The Imperial Gardens', note: 'Trial; Library (Siosa) optional', trial: true },
      { zone: 'The Library', note: 'Siosa: extra gems', optional: true },
      { zone: 'The Sceptre of God', note: 'Run to the top' },
      { zone: 'The Upper Sceptre of God', note: 'Kill Dominus, go to act 4' }
    ]
  },
  {
    act: 4,
    steps: [
      { zone: 'The Aqueduct', note: 'Run to Highgate' },
      { zone: 'Highgate', note: 'Hand in' },
      { zone: 'The Dried Lake', note: 'Kill Voll' },
      { zone: 'The Mines Level 1', note: 'Run through' },
      { zone: 'The Mines Level 2', note: "Free Deshret's spirit", reward: { quest: 'An Indomitable Spirit', passive: 1, respec: 2, turnIn: 'Tasuni' } },
      { zone: 'The Crystal Veins', note: 'Hub for both dreams' },
      { zone: "Kaom's Dream", note: 'Run through' },
      { zone: "Kaom's Stronghold", note: 'Kill King Kaom (Eye of Fury)' },
      { zone: "Daresso's Dream", note: 'Run through' },
      { zone: 'The Grand Arena', note: 'Kill Daresso (Eye of Desire)' },
      { zone: 'The Belly of the Beast Level 1', note: 'Run through' },
      { zone: 'The Belly of the Beast Level 2', note: 'Kill Piety' },
      { zone: 'The Harvest', note: 'Kill the three organ bosses' },
      { zone: 'The Ascent', note: 'Kill Malachai, go to act 5' }
    ]
  },
  {
    act: 5,
    steps: [
      { zone: 'The Slave Pens', note: 'Kill the Overseer' },
      { zone: "Overseer's Tower", note: 'Hand in' },
      { zone: 'The Control Blocks', note: 'Miasmeter; kill Justicar Casticus', reward: { quest: 'In Service to Science', passive: 1, turnIn: 'Vilenta' } },
      { zone: 'Oriath Square', note: 'To the Templar Courts' },
      { zone: 'The Templar Courts', note: 'Run through' },
      { zone: 'The Chamber of Innocence', note: 'Kill High Templar Avarius' },
      { zone: 'The Torched Courts', note: 'Run through' },
      { zone: 'The Ruined Square', note: 'Hub: Reliquary and Ossuary' },
      { zone: 'The Reliquary', note: "Kitava's three torments", optional: true, reward: { quest: "Kitava's Torments", passive: 1, respec: 2, turnIn: 'Lani' } },
      { zone: 'The Ossuary', note: 'Sign of Purity' },
      { zone: 'The Cathedral Rooftop', note: 'Kill Kitava, go to act 6' }
    ]
  },
  {
    act: 6,
    steps: [
      { zone: 'The Twilight Strand', note: 'Clear the strand for Lilly (respec points only)', reward: { quest: 'Fallen from Grace', respec: 2, turnIn: 'Lilly' } },
      { zone: 'The Coast', note: 'To the Mud Flats' },
      { zone: 'The Mud Flats', note: 'To the Karui Fortress' },
      { zone: 'The Karui Fortress', note: 'Kill Tukohama', reward: { quest: 'The Father of War', passive: 1, turnIn: 'Tarkleigh' } },
      { zone: 'The Ridge', note: 'Run through' },
      { zone: 'The Lower Prison', note: 'To the Upper Prison' },
      { zone: "Shavronne's Tower", note: 'Kill Shavronne and Brutus' },
      { zone: "Prisoner's Gate", note: 'Kill Abberath', reward: { quest: 'The Cloven One', passive: 1, turnIn: 'Bestel' } },
      { zone: 'The Western Forest', note: 'Run through' },
      { zone: 'The Riverways', note: 'To the Wetlands' },
      { zone: 'The Wetlands', note: 'Kill Ryslatha', reward: { quest: 'The Puppet Mistress', passive: 1, turnIn: 'Tarkleigh' } },
      { zone: 'The Southern Forest', note: 'Run through' },
      { zone: 'The Cavern of Anger', note: 'Run through' },
      { zone: 'The Beacon', note: 'Light the beacon' },
      { zone: "The Brine King's Reef", note: 'Kill Tsoagoth, go to act 7' }
    ]
  },
  {
    act: 7,
    steps: [
      { zone: 'The Broken Bridge', note: 'Run through' },
      { zone: 'The Crossroads', note: 'Hub' },
      { zone: 'The Fellshrine Ruins', note: 'To the Crypt' },
      { zone: 'The Crypt', note: "Maligaro's map" },
      { zone: 'The Chamber of Sins Level 1', note: 'Run through' },
      { zone: 'The Chamber of Sins Level 2', note: "Maligaro's Sanctum (kill Maligaro)" },
      { zone: 'The Den', note: 'Run through' },
      { zone: 'The Ashen Fields', note: 'Kill Greust (Ralakesh) in the old Forest Encampment', reward: { quest: 'The Master of a Million Faces', passive: 1, turnIn: 'Eramir' } },
      { zone: 'The Northern Forest', note: 'Run through' },
      { zone: 'The Dread Thicket', note: 'Fireflies for Yeena; Den of Despair: kill Gruthkul', optional: true, reward: { quest: 'Queen of Despair', passive: 1, turnIn: 'Eramir' } },
      { zone: 'The Causeway', note: "Kishara's Star in the lockbox near the exit", reward: { quest: "Kishara's Star", passive: 1, respec: 2, turnIn: 'Weylam' } },
      { zone: 'The Vaal City', note: 'To the Temple of Decay' },
      { zone: 'The Temple of Decay Level 1', note: 'Run through' },
      { zone: 'The Temple of Decay Level 2', note: 'Kill Arakaali, go to act 8' }
    ]
  },
  {
    act: 8,
    steps: [
      { zone: 'The Sarn Ramparts', note: 'Run to the encampment' },
      { zone: 'The Toxic Conduits', note: 'Run through' },
      { zone: "Doedre's Cesspool", note: 'Kill Doedre' },
      { zone: 'The Grand Promenade', note: 'To the Bath House / Lunaris side' },
      { zone: 'The Bath House', note: 'Run through' },
      { zone: 'The High Gardens', note: 'Kill Yugul', reward: { quest: 'Reflection of Terror', passive: 1, turnIn: 'Sin' } },
      { zone: 'The Lunaris Concourse', note: 'Moon orb' },
      { zone: 'The Quay', note: 'Ankh of Eternity; kill Tolman at the Resurrection Site', reward: { quest: 'Love is Dead', passive: 1, respec: 2, turnIn: 'Clarissa' } },
      { zone: 'The Grain Gate', note: 'Kill the Gemling Legionnaires', reward: { quest: 'The Gemling Legion', passive: 1, turnIn: 'Maramoa' } },
      { zone: 'The Imperial Fields', note: 'Run through' },
      { zone: 'The Solaris Concourse', note: 'Sun orb' },
      { zone: 'The Harbour Bridge', note: 'Kill Solaris and Lunaris, go to act 9' }
    ]
  },
  {
    act: 9,
    steps: [
      { zone: 'The Blood Aqueduct', note: 'Run to Highgate' },
      { zone: 'The Descent', note: 'Run through' },
      { zone: 'The Vastiri Desert', note: 'Storm blade quest' },
      { zone: 'The Oasis', note: 'Kill Shakari', reward: { quest: 'Queen of the Sands', passive: 1, turnIn: 'Irasha' } },
      { zone: 'The Foothills', note: 'Hub' },
      { zone: 'The Boiling Lake', note: 'Kill the Basilisk' },
      { zone: 'The Tunnel', note: 'Run through' },
      { zone: 'The Quarry', note: 'Kill Garukhan, take the Sekhema Feather; on to the Refinery', reward: { quest: 'The Ruler of Highgate', passive: 1, turnIn: 'Tasuni or Irasha' } },
      { zone: 'The Refinery', note: 'Kill General Adus' },
      { zone: 'The Belly of the Beast', note: 'Run through' },
      { zone: 'The Rotting Core', note: 'Kill the Depraved Trinity, go to act 10' }
    ]
  },
  {
    act: 10,
    steps: [
      { zone: 'The Cathedral Rooftop', note: 'Run through' },
      { zone: 'The Ravaged Square', note: 'Hub' },
      { zone: 'The Control Blocks', note: 'Kill Vilenta', optional: true, reward: { quest: "Vilenta's Vengeance", passive: 1, turnIn: 'Lani' } },
      { zone: 'The Torched Courts', note: 'Run through' },
      { zone: 'The Desecrated Chambers', note: 'Kill Avarius' },
      { zone: 'The Canals', note: 'Run through' },
      { zone: 'The Feeding Trough', note: 'Kill Kitava. Campaign done: on to maps', reward: { quest: 'An End to Hunger', passive: 2, turnIn: 'Lani' } }
    ]
  }
]

// Passive points from quests on the route: 24 (23, plus 1 for killing all three bandits)
export const QUEST_PASSIVES = ROUTE.reduce((n, a) => n + a.steps.reduce((m, s) => m + (s.reward?.passive ?? 0), 0), 0)

// Flat list with act numbers, in route order
export const STEPS = ROUTE.flatMap(a => a.steps.map(s => ({ ...s, act: a.act })))

const norm = (z: string) => z.toLowerCase().replace(/^the /, '').trim()

// Act from the area id in Client.txt ('Generating level 13 area "1_3_7"' -> 3;
// "2_6_1" -> 6). null for hideouts, maps and anything else.
export function actFromAreaCode (code: string | undefined): number | null {
  const m = code?.match(/^\d+_(\d+)_/)
  const act = m ? Number(m[1]) : NaN
  return act >= 1 && act <= 10 ? act : null
}

// Forward-only: the next matching step after the current one, so going back
// to a town or an earlier zone never moves the guide backwards. With the act
// known (from the area id) only that act's steps count, so act 1's "The Coast"
// never jumps to act 6's. Without it, only the current and the next act.
// Returns -1 when there's no forward match.
export function findStep (zone: string, current: number, act: number | null = null): number {
  const target = norm(zone)
  const curAct = STEPS[Math.max(0, Math.min(current, STEPS.length - 1))].act
  for (let i = Math.max(0, current + 1); i < STEPS.length; i++) {
    const s = STEPS[i]
    if (act != null ? s.act !== act : s.act > curAct + 1) continue
    if (norm(s.zone) === target) return i
  }
  return -1
}

// Whether the zone is anywhere on the route (for the "not on the route" note)
export function isOnRoute (zone: string): boolean {
  const target = norm(zone)
  return STEPS.some(s => norm(s.zone) === target)
}
