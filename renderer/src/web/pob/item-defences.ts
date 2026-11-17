// Deathloom fork (Gerhard 17 Nov 2026): defences of a build item (armour,
// evasion, energy shield, ward, block) read from its Ctrl+C-style text, as the
// game tooltip shows them. Pure logic (unit tested).

export interface ItemDefence { name: string, short: string, value: string }

const LINES: Array<[string, string]> = [
  ['Chance to Block', 'Block'],
  ['Armour', 'AR'],
  ['Evasion Rating', 'EV'],
  ['Energy Shield', 'ES'],
  ['Ward', 'Ward']
]

export function itemDefences (text: string | undefined): ItemDefence[] {
  if (!text) return []
  const out: ItemDefence[] = []
  for (const [name, short] of LINES) {
    const m = new RegExp(`^${name}: (\\d+%?)`, 'm').exec(text)
    if (m) out.push({ name, short, value: m[1] })
  }
  return out
}
