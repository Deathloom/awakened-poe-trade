// Deathloom fork: your character's copy of the build you follow,
// "<build> (my character).xml". Path of Building fills it with Import character;
// Orbhoarder only reads the saved file (Gear compare and the Gems tab use it).
export const MINE = ' (my character)'
const MINE_RE = new RegExp(`${MINE.replace(/[()]/g, '\\$&')}\\.xml$`, 'i')

export function minePathOf (active: string): string {
  return MINE_RE.test(active) ? active : active.replace(/\.xml$/i, `${MINE}.xml`)
}

export function planPathOf (active: string, builds: string[]): string {
  const plan = active.replace(MINE_RE, '.xml')
  return builds.includes(plan) ? plan : active
}

export function mineExistsIn (active: string, builds: string[]): boolean {
  const mine = minePathOf(active).toLowerCase()
  return builds.some(b => b.toLowerCase() === mine)
}
