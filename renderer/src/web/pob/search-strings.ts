// Deathloom fork: stash / vendor search strings for the build (Build panel → Notes).
// The game's stash and vendor search takes a regex in quotes, up to 50
// characters. Orbhoarder only puts the text on the clipboard: one click = one
// copy; you paste it in game yourself (Ctrl+F, Ctrl+V).
import type { PobSocketGroup } from '@ipc/types'
import { MAP_MOD_PRESETS } from './map-mods'

export const MAX_SEARCH = 50

export interface SearchString {
  key: string
  label: string
  hint?: string
  text: string
  // parts left out because the game's 50-character limit was reached
  dropped?: number
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "a|b|c" in quotes, split into as many strings as needed (each ≤ 50 characters)
export function chunked (parts: string[], prefix = ''): string[] {
  const out: string[] = []
  let cur: string[] = []
  const len = (list: string[]) => 2 + prefix.length + list.join('|').length
  for (const p of parts) {
    if (len([p]) > MAX_SEARCH) continue
    if (cur.length && len([...cur, p]) > MAX_SEARCH) { out.push(`"${prefix}${cur.join('|')}"`); cur = [] }
    cur.push(p)
  }
  if (cur.length) out.push(`"${prefix}${cur.join('|')}"`)
  return out
}

// gem names (lowercase, without " Support"), skills first
export function gemParts (groups: PobSocketGroup[]): string[] {
  const skills: string[] = []
  const supports: string[] = []
  for (const g of groups) {
    if (g.source || !g.enabled) continue
    for (const gem of g.gems) {
      if (!gem.enabled || !gem.name) continue
      const name = escapeRe(gem.name.replace(/ Support$/i, '').toLowerCase())
      const list = gem.support ? supports : skills
      if (!skills.includes(name) && !supports.includes(name)) list.push(name)
    }
  }
  return [...skills, ...supports]
}

// map mods to avoid -> one "!a|b" string (a negated search can't be split)
export function avoidString (mapMods: string[]): { text: string, dropped: number } {
  const parts = mapMods.map(m => MAP_MOD_PRESETS.find(p => p.text === m)?.search ??
    m.split('#').map(escapeRe).join('\\d+'))
  const kept: string[] = []
  for (const p of parts) {
    if (2 + 1 + [...kept, p].join('|').length > MAX_SEARCH) continue
    kept.push(p)
  }
  return { text: kept.length ? `"!${kept.join('|')}"` : '', dropped: parts.length - kept.length }
}

export function buildSearchStrings (groups: PobSocketGroup[] | null, mapMods: string[]): SearchString[] {
  const out: SearchString[] = []
  if (groups) {
    chunked(gemParts(groups)).forEach((text, i, all) => {
      out.push({ key: `gems${i}`, label: all.length > 1 ? `Build gems (${i + 1}/${all.length})` : 'Build gems', hint: 'stash or gem vendor', text })
    })
  }
  out.push(
    { key: 'ms', label: 'Boots with movement speed', hint: 'vendor', text: '"increased movement"' },
    { key: 'ms20', label: 'Movement speed 20% or more', hint: 'vendor', text: '"([2-9]\\d)% increased movement"' },
    { key: 'l3', label: '3-linked sockets', hint: 'vendor', text: '"\\w-\\w-\\w"' },
    { key: 'l4', label: '4-linked sockets', hint: 'vendor', text: '"\\w-\\w-\\w-\\w"' },
    { key: 'l5', label: '5-linked sockets', hint: 'vendor or stash', text: '"\\w-\\w-\\w-\\w-\\w"' }
  )
  const avoid = avoidString(mapMods)
  if (avoid.text) {
    out.push({ key: 'maps', label: 'Maps without the mods this build can\'t run', hint: 'map stash', text: avoid.text, dropped: avoid.dropped })
  }
  return out
}
