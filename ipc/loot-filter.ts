// Deathloom fork (Q10): loot filter add-on. Pure helpers shared by main (writes the
// file) and the renderer (what to send); unit-tested in tests/logic.test.mjs.
//
// The game loads ONE filter and the first block that matches an item wins, so the
// add-on is a separate new file "<his filter> + Orbhoarder.filter": our Show blocks
// first, then an unchanged copy of his filter. His own file is never changed.

import type { Game } from './game'

export const ADDON_SUFFIX = ' + Orbhoarder.filter'
// first line of every file we write: we only ever overwrite a file that starts with it
export const ADDON_MARKER = '# Orbhoarder loot filter add-on'
// his filter (and so the file we write) may be at most this big
export const MAX_FILTER_BYTES = 8 * 1024 * 1024
// names per kind (a build has far fewer; keeps the request small)
export const MAX_NAMES = 200
// at most this many left-out names are sent back / shown
export const MAX_REFUSED = 50

export interface LootFilterWants {
  // base types of the rares the build still needs ("Vaal Regalia")
  bases: string[]
  // base types of the uniques the build still needs (filters can't match a unique's own name)
  uniqueBases: string[]
  // gem names as the game calls them ("Added Fire Damage Support")
  gems: string[]
}

// A filter file name in the filter folder: no folders, no hidden files, ends in .filter
export function isFilterFileName (name: unknown): name is string {
  if (typeof name !== 'string' || name.length < 8 || name.length > 120) return false
  if (!name.toLowerCase().endsWith('.filter')) return false
  if (name.startsWith('.') || name.startsWith(' ') || name.endsWith(' .filter')) return false
  // letters, digits, space and a few punctuation marks only (no / \ : * ? " < > | or control characters)
  return /^[\p{L}\p{N} _.,'()[\]{}+!&#@$%=~-]+$/u.test(name) && !name.includes('..')
}

// one of ours (not offered as a source, so add-ons don't stack)
export function isAddonFileName (name: string): boolean {
  return name.toLowerCase().endsWith(ADDON_SUFFIX.toLowerCase())
}

// "NeverSink Strict.filter" -> "NeverSink Strict + Orbhoarder.filter"; null if not allowed
export function addonFileName (source: unknown): string | null {
  if (!isFilterFileName(source) || isAddonFileName(source)) return null
  const out = source.slice(0, -'.filter'.length) + ADDON_SUFFIX
  return isFilterFileName(out) ? out : null
}

// An item / gem name that can go between quotes in a filter. Filters have no way to
// escape a quote, so names with quotes, line breaks, # or other odd characters are refused.
export function isSafeItemName (name: unknown): name is string {
  if (typeof name !== 'string') return false
  const s = name.trim()
  return s.length >= 2 && s.length <= 60 && /^[\p{L}\p{N} ',.:-]+$/u.test(s)
}

// PoB calls support gems "Added Fire Damage"; the game's base type is "Added Fire Damage Support"
export function gemBaseType (name: string, support: boolean): string {
  const s = name.trim()
  return support && !/ Support$/i.test(s) ? `${s} Support` : s
}

function clean (list: unknown): { names: string[], refused: string[] } {
  const names: string[] = []
  const refused: string[] = []
  const seen = new Set<string>()
  if (!Array.isArray(list)) return { names, refused }
  for (const v of list) {
    if (!isSafeItemName(v)) {
      if (typeof v === 'string' && v.trim()) refused.push(v.slice(0, 60))
      continue
    }
    const s = v.trim()
    const k = s.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    if (names.length < MAX_NAMES) names.push(s)
  }
  return { names, refused }
}

// Checked lists from a request (main re-checks what the renderer sent)
export function cleanWants (w: unknown): { wants: LootFilterWants, refused: string[] } {
  const o = (w != null && typeof w === 'object') ? w as Record<string, unknown> : {}
  const bases = clean(o.bases)
  const uniqueBases = clean(o.uniqueBases)
  const gems = clean(o.gems)
  return {
    wants: { bases: bases.names, uniqueBases: uniqueBases.names, gems: gems.names },
    refused: [...bases.refused, ...uniqueBases.refused, ...gems.refused].slice(0, MAX_REFUSED)
  }
}

// PoE1 refuses to load a whole filter when a `BaseType ==` name matches no item, so
// only names the app's own item data knows go in (the renderer passes lookups over its
// price-check data). `gem` returns the game's base type for that gem (transfigured gems:
// the normal gem they come from) or null. Unknown names come back in `unknown`.
export function keepKnown (
  w: LootFilterWants,
  known: { base: (name: string) => boolean, gem: (name: string) => string | null }
): { wants: LootFilterWants, unknown: string[] } {
  const unknown: string[] = []
  const keep = (list: string[], ok: (n: string) => string | null) => {
    const out: string[] = []
    for (const n of list) {
      const real = ok(n)
      if (real && isSafeItemName(real)) { if (!out.includes(real)) out.push(real) } else unknown.push(n)
    }
    return out
  }
  const base = (n: string) => known.base(n) ? n : null
  return {
    wants: { bases: keep(w.bases, base), uniqueBases: keep(w.uniqueBases, base), gems: keep(w.gems, known.gem) },
    unknown: unknown.slice(0, MAX_REFUSED)
  }
}

export function wantsCount (w: LootFilterWants): number {
  return w.bases.length + w.uniqueBases.length + w.gems.length
}

const quoted = (names: string[]) => names.map(n => `"${n}"`).join(' ')

// The blocks that go before his filter. `when` is only written into a comment.
export function addonBlocks (w: LootFilterWants, opts: { source: string, game: Game, when?: string }): string {
  const lines: string[] = [
    ADDON_MARKER,
    `# Made by Orbhoarder from "${isFilterFileName(opts.source) ? opts.source : 'your filter'}"${opts.when ? ` on ${opts.when}` : ''}.`,
    '# Orbhoarder writes this whole file again each time; edit your own filter instead.',
    '# Below: what your build still needs (Market > Shopping), then your filter unchanged.',
    ''
  ]
  const style = (border: string, icon: string, effect: string) => [
    '  SetFontSize 42',
    `  SetBorderColor ${border} 255`,
    '  SetBackgroundColor 20 20 20 240',
    `  PlayEffect ${effect}`,
    `  MinimapIcon 1 ${icon} Star`
  ]
  if (w.uniqueBases.length) {
    lines.push('# Orbhoarder: uniques your build needs (by base type)',
      'Show',
      '  Rarity Unique',
      `  BaseType == ${quoted(w.uniqueBases)}`,
      ...style('175 96 37', 'Brown', 'Brown'), '')
  }
  if (w.bases.length) {
    lines.push('# Orbhoarder: bases your build needs',
      'Show',
      '  Rarity <= Rare',
      `  BaseType == ${quoted(w.bases)}`,
      ...style('255 255 119', 'Yellow', 'Yellow'), '')
  }
  // PoE2 gems drop uncut (no skill name to match), so gems are PoE1 only
  if (w.gems.length && opts.game !== 'poe2') {
    lines.push('# Orbhoarder: gems your build needs',
      'Show',
      '  Class == "Skill Gems" "Support Gems"',
      `  BaseType == ${quoted(w.gems)}`,
      ...style('27 162 155', 'Cyan', 'Cyan'), '')
  }
  lines.push('# ---- your filter, unchanged ----', '', '')
  return lines.join('\r\n')
}

// Shopping rows still to buy -> what the add-on shows. `name` is the base type for
// uniques / rares and the gem name for gems.
export function wantsFromShop (rows: Array<{ kind: 'unique' | 'rare' | 'gem', owned: boolean, name: string, support?: boolean }>): LootFilterWants {
  const w: LootFilterWants = { bases: [], uniqueBases: [], gems: [] }
  for (const r of rows) {
    if (r.owned || !r.name) continue
    if (r.kind === 'unique') w.uniqueBases.push(r.name)
    else if (r.kind === 'rare') w.bases.push(r.name)
    else w.gems.push(gemBaseType(r.name, r.support === true))
  }
  return w
}

// Is this text one of our files (safe to overwrite)?
export function isAddonText (text: string): boolean {
  return text.replace(/^﻿/, '').startsWith(ADDON_MARKER)
}
