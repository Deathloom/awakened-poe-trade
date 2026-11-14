// Deathloom fork: "what pays" per atlas content, from poe.ninja ECONOMY prices only
// (poe.ninja allows third-party use of its economy overviews; builds/atlas data are
// internal to poe.ninja and not used). No extra requests: these are the same prices
// Loot Goblin already downloads for price checks (Prices.ts, one download per ~30 min,
// only while you use it).
// The value is a rough guide: the average price of the content's 5 dearest drops
// right now. It is not profit per map (drop rates aren't public data).
import type { NinjaListing } from '@/web/background/Prices'

interface DropMatch { category: string, re?: RegExp }

// what each content drops that poe.ninja prices (category = poe.ninja slug)
export const CONTENT_DROPS: Record<string, DropMatch[]> = {
  expedition: [{ category: 'artifacts' }],
  essence: [{ category: 'essences' }],
  breach: [{ category: 'fragments', re: /^Splinter of |Breachstone/ }, { category: 'currency', re: /^Blessing of / }],
  legion: [{ category: 'fragments', re: /^Timeless .*(Splinter|Emblem)/ }],
  ritual: [{ category: 'omens' }],
  harvest: [{ category: 'currency', re: /Crystallised Lifeforce/ }],
  blight: [{ category: 'oils' }],
  delirium: [{ category: 'delirium-orbs' }, { category: 'fragments', re: /Simulacrum/ }],
  beasts: [{ category: 'beasts' }],
  ultimatum: [{ category: 'currency', re: /Catalyst$/ }],
  incursion: [{ category: 'vials' }],
  ore: [{ category: 'runegrafts' }],
  eldritch: [{ category: 'currency', re: /^Eldritch |^Orb of Conflict/ }],
  divination: [{ category: 'divination-cards' }],
  mirage: [{ category: 'djinn-coins' }]
}

export const NINJA_ATLAS_URL = 'https://poe.ninja/posts/atlas-trees'

export interface ContentValue {
  // average chaos of the 5 dearest drops
  chaos: number
  top: NinjaListing[]
}

const TOP_N = 5

export function contentValues (items: NinjaListing[]): Record<string, ContentValue> {
  const out: Record<string, ContentValue> = {}
  for (const [id, matches] of Object.entries(CONTENT_DROPS)) {
    const hits = items.filter(it => matches.some(m =>
      it.category === m.category && (!m.re || m.re.test(it.name))))
    if (!hits.length) continue
    const top = [...hits].sort((a, b) => b.chaos - a.chaos).slice(0, TOP_N)
    out[id] = { chaos: top.reduce((s, it) => s + it.chaos, 0) / top.length, top }
  }
  return out
}
