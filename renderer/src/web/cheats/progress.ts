// Deathloom fork (idea 11): league checklist (Cheat sheets → Checklist): league
// start (was Help → League-start checklist), then endgame progress. Ticks are
// saved per league on this PC; nothing is read from the game or GGG.

export interface ProgressGroup { title: string, items: Array<{ id: string, label: string, hint?: string }> }

export const PROGRESS: ProgressGroup[] = [
  {
    title: 'League start: before launch',
    items: [
      { id: 'ls-notes', label: 'Read the patch notes: is your skill, its supports, your ascendancy or key unique buffed, nerfed or not mentioned?' },
      { id: 'ls-pick', label: 'Pick a cheap starter build and a backup that fit how you play', hint: 'Help → Get a build' },
      { id: 'ls-pob', label: 'Make or import the build in Path of Building once it has the new league data; levelling trees for about level 30, 60 and 90', hint: 'Build panel → import' },
      { id: 'ls-push', label: 'Push the build so friends get it', hint: 'Build panel → cloud' },
      { id: 'ls-route', label: 'Check the campaign route still matches (lab timing, gem rewards, campaign changes)', hint: 'Levelling tab' }
    ]
  },
  {
    title: 'League start: at launch',
    items: [
      { id: 'ls-league', label: 'Pick the new league for prices and trade', hint: 'Settings → Price check → League' },
      { id: 'ls-theme', label: 'Optional: follow the current league\'s look', hint: 'Settings → Appearance' },
      { id: 'ls-filter', label: "Get a loot filter for the new league (NeverSink's on FilterBlade), tune it for your build and pick it in game", hint: 'Options → UI → Loot filter' },
      { id: 'ls-buildnotes', label: "Put the filter link and the map mods you can't run in the build's notes", hint: 'Build panel → Notes' }
    ]
  },
  {
    title: 'League start: first days',
    items: [
      { id: 'ls-atlas', label: 'Plan one low-effort atlas strategy that suits the build', hint: 'Atlas tab → ready-made tree' },
      { id: 'ls-sell', label: 'Sell early what is worth most at league start, while prices are high', hint: 'Market overview' },
      { id: 'ls-resist', label: 'After acts 5 and 10, fix resistances (Kitava)', hint: 'Build panel → Gear' },
      { id: 'ls-friends', label: 'Post spare uniques and bases for friends', hint: "Friends' board" }
    ]
  },
  {
    title: 'Labyrinth (ascendancy points)',
    items: [
      { id: 'lab1', label: 'Normal Labyrinth', hint: 'after act 3' },
      { id: 'lab2', label: 'Cruel Labyrinth', hint: 'after act 6' },
      { id: 'lab3', label: 'Merciless Labyrinth', hint: 'after act 10' },
      { id: 'lab4', label: 'Eternal (Uber) Labyrinth', hint: 'Offering to the Goddess, from maps' }
    ]
  },
  {
    title: 'Atlas',
    items: [
      { id: 'kirac', label: 'Kirac\'s missions unlocked', hint: 'first maps after the campaign' },
      { id: 'red', label: 'Red maps (tier 11+) reached' },
      { id: 'bonus', label: 'Most atlas bonus objectives done', hint: 'complete maps (all bonus) for atlas points' },
      { id: 'regions', label: 'First Shaped Region objective done', hint: '3.30: gives free Threads in that region' },
      { id: 'void1', label: 'Voidstone 1' },
      { id: 'void2', label: 'Voidstone 2' },
      { id: 'void3', label: 'Voidstone 3' },
      { id: 'void4', label: 'Voidstone 4' }
    ]
  },
  {
    title: 'Pinnacle bosses',
    items: [
      { id: 'exarch', label: 'The Searing Exarch' },
      { id: 'eater', label: 'The Eater of Worlds' },
      { id: 'maven', label: 'The Maven' },
      { id: 'shaper', label: 'The Shaper' },
      { id: 'elder', label: 'The Elder' },
      { id: 'uelder', label: 'The Uber Elder' },
      { id: 'sirus', label: 'Sirus' },
      { id: 'covenqueen', label: 'The Coven Queen', hint: 'Covens league boss' },
      { id: 'ubers', label: 'Any uber boss', hint: 'the hardest versions' }
    ]
  },
  {
    title: 'Character',
    items: [
      { id: 'res', label: 'Resistances capped after act 10' },
      { id: 'l6', label: 'Main skill in a 6-link' },
      { id: 'flasks', label: 'Flasks remove freeze, shock, ignite, bleed' },
      { id: 'lvl90', label: 'Level 90' },
      { id: 'lvl95', label: 'Level 95' }
    ]
  }
]

const KEY = 'deathloom.endgame-progress.v1'

// ticks from the old Help → League-start checklist (same ids without "ls-")
const OLD_LEAGUE_START_KEY = 'deathloom.league-start.v1'

export function loadProgress (league: string): Set<string> {
  const ticks = new Set<string>()
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    if (Array.isArray(all?.[league])) for (const id of all[league]) ticks.add(id)
  } catch {}
  try {
    const old = JSON.parse(localStorage.getItem(OLD_LEAGUE_START_KEY) ?? '{}')
    if (Array.isArray(old?.[league])) for (const id of old[league]) ticks.add('ls-' + id)
  } catch {}
  return ticks
}

export function saveProgress (league: string, ticks: Set<string>) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}
    all[league] = [...ticks]
    localStorage.setItem(KEY, JSON.stringify(all))
    // now saved here: drop this league from the old list (else an untick comes back)
    const old = JSON.parse(localStorage.getItem(OLD_LEAGUE_START_KEY) ?? '{}') ?? {}
    if (old[league]) {
      localStorage.setItem(OLD_LEAGUE_START_KEY, JSON.stringify(Object.fromEntries(Object.entries(old).filter(([k]) => k !== league))))
    }
  } catch {}
}
