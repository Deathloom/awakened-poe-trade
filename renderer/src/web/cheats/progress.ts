// Deathloom fork (idea 11): endgame progress checklist (Cheat sheets → Progress).
// Ticks are saved per league on this PC; nothing is read from the game or GGG.

export interface ProgressGroup { title: string, items: Array<{ id: string, label: string, hint?: string }> }

export const PROGRESS: ProgressGroup[] = [
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

export function loadProgress (league: string): Set<string> {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return new Set(Array.isArray(all?.[league]) ? all[league] : [])
  } catch { return new Set() }
}

export function saveProgress (league: string, ticks: Set<string>) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {}
    all[league] = [...ticks]
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {}
}
