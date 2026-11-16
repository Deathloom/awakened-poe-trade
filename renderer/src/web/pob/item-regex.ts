// Deathloom fork (16 Nov 2026): stash / vendor search for items like one of
// your build's items (Build → Gear → regex button). Each mod becomes a short
// regex: its value ("at least" or any) plus the start of the text after it.
// The game's search is case-insensitive, max 50 characters; "quoted" parts
// must all match. Pure logic (unit tested in tests/logic.test.mjs).
import { atLeast, MAX_LEN } from './vendor-regex'

export { MAX_LEN }

// how much of the mod text after the number is kept (enough to tell mods apart)
const TAIL = 14
const LEAD = 18

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const group = (alts: string) => alts.includes('|') ? `(${alts})` : alts

// finish the word if it ends within 4 more characters ("to maximum life", not "maximum li")
function snippet (s: string, max: number): string {
  if (s.length <= max) return s
  const end = s.indexOf(' ', max)
  const wordEnd = end < 0 ? s.length : end
  return wordEnd - max <= 4 ? s.slice(0, wordEnd) : s.slice(0, max)
}

// numbers in the kept text: any value
function anyNumbers (s: string): string {
  return escapeRe(s).replace(/\d+(?:\\\.\d+)?/g, '\\d+')
}

export function modRegex (text: string, minValue = true): string {
  const t = text.toLowerCase().replace(/\s+/g, ' ').trim()
  const m = /(\d+(?:\.\d+)?)/.exec(t)
  if (!m) return anyNumbers(snippet(t, LEAD).trim())
  const num = m[1]
  const signed = m.index > 0 && t[m.index - 1] === '+'
  let value: string
  if (!minValue || num.includes('.')) {
    value = num.includes('.') ? '\\d+(\\.\\d+)?' : '\\d+'
  } else {
    const n = Number(num)
    const digits = num.length
    // % values stay under 100; flat ones (life, armour) can go a digit longer
    const maxDigits = digits <= 2 && !t.slice(m.index + num.length).startsWith('%') ? digits + 1 : digits
    // the game never shows leading zeros: "\d{3}" is shorter than "[1-9]\d{2}"
    value = group(atLeast(n, maxDigits).replace(/\[1-9\]\\d\{(\d)\}/g, (_, k: string) => `\\d{${Number(k) + 1}}`))
  }
  // words just before the number ("Adds 10 to 20 …", "… Supported by Level 20 …"),
  // at most the last 12 characters, whole words
  let before = t.slice(0, signed ? m.index - 1 : m.index)
  if (before.length > 12) {
    const cut = before.slice(-12)
    const space = cut.indexOf(' ')
    before = space >= 0 && space < cut.length - 1 ? cut.slice(space + 1) : cut
  }
  const tail = snippet(t.slice(m.index + num.length), TAIL).trimEnd()
  return escapeRe(before) + (signed ? '\\+' : '') + value + anyNumbers(tail)
}

export interface ItemRegexPart {
  key: string
  label: string
  regex: string
  // base type part, or a mod line
  kind: 'name' | 'base' | 'mod'
  // the mod has a number (an "at least" choice makes sense)
  hasValue: boolean
}

export interface ItemLike {
  name: string
  baseName: string
  rarity: string
  mods: Array<{ text: string, kind: string, unsupported?: boolean }>
}

export function itemRegexParts (item: ItemLike, minValue: Record<string, boolean> = {}): ItemRegexPart[] {
  const parts: ItemRegexPart[] = []
  if (item.rarity === 'Unique' && item.name) {
    parts.push({ key: 'name', label: `Name: ${item.name}`, regex: escapeRe(item.name.toLowerCase()), kind: 'name', hasValue: false })
  } else if (item.baseName) {
    parts.push({ key: 'base', label: `Base: ${item.baseName}`, regex: escapeRe(item.baseName.toLowerCase()), kind: 'base', hasValue: false })
  }
  item.mods.forEach((mod, i) => {
    if (!mod.text.trim()) return
    // several lines in one mod: the first is enough to find it
    const line = mod.text.split('\n')[0]
    const key = `mod${i}`
    parts.push({
      key,
      label: line,
      regex: modRegex(line, minValue[key] ?? true),
      kind: 'mod',
      hasValue: /\d/.test(line)
    })
  })
  return parts
}

export interface ItemRegexResult {
  text: string
  length: number
  tooLong: boolean
}

export function itemRegex (parts: ItemRegexPart[], match: 'all' | 'any'): ItemRegexResult {
  const list = parts.filter(p => p.regex)
  let text = ''
  if (list.length) {
    text = match === 'all'
      ? list.map(p => `"${p.regex}"`).join(' ')
      : `"${list.map(p => p.regex).join('|')}"`
  }
  return { text, length: text.length, tooLong: text.length > MAX_LEN }
}
