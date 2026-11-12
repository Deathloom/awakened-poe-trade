// Deathloom fork: poe.ninja lookup keys for items from the website's stash
// answer (no Ctrl+C text there, so this is an approximation of what the price
// check does in price-check/trends/getDetailsId.ts).

import type { StashItem } from '@ipc/types'

// frameType: 0 normal, 1 magic, 2 rare, 3 unique, 4 gem, 5 currency, 6 divination card, 9 relic
export function stashQuery (item: StashItem): { ns: string, name: string, variant: string | undefined } | null {
  switch (item.frameType) {
    case 3:
    case 9: {
      if (!item.name) return null
      const parts = [item.baseType]
      if (item.links && item.links >= 5) parts.push(`${item.links}L`)
      return { ns: 'UNIQUE', name: item.name, variant: parts.join(', ') }
    }
    case 4: {
      const level = item.gemLevel ?? 1
      let variant = level >= 20 ? String(level) : '1'
      if (item.corrupted) variant += 'c'
      return { ns: 'GEM', name: item.typeLine.replace(/^Superior /, ''), variant }
    }
    case 5:
    case 6:
      return { ns: 'ITEM', name: item.typeLine, variant: undefined }
    case 0:
      // Fragments, scarabs, maps and the like are "normal" items
      return { ns: 'ITEM', name: item.typeLine, variant: undefined }
    default:
      return null
  }
}
