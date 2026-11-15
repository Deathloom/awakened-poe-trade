// Deathloom fork: make your own vendor / stash search (Build panel → Notes →
// Search strings → Make your own). The game's search takes a regex, up to 50
// characters, case-insensitive; several "quoted" parts must all match.
// Pure logic (unit tested in tests/logic.test.mjs).

export const MAX_LEN = 50

export type Colour = 'r' | 'g' | 'b' | 'w' | 'x'
export type Element = 'fire' | 'cold' | 'lightning' | 'chaos'

export interface VendorQuery {
  // linked sockets: number of sockets in the link (0 = don't care)
  links: number
  // wanted colours for the link, 'x' = any (length = links; empty = any colours)
  colours: Colour[]
  // movement speed at least this % (0 = don't care)
  moveSpeed: number
  // maximum life at least (0 = don't care)
  life: number
  // resistances: which, at least this % (0 = any value)
  resists: Element[]
  resistMin: number
  // "+1 to Level of all ... Gems"
  plusGems: boolean
  // "Adds # to # Physical Damage" (weapons, rings, quivers)
  flatPhys: boolean
  // your own text (found as typed; regex characters are escaped)
  custom: string
  // any: one of the parts is enough; all: every part must match
  match: 'any' | 'all'
}

export function emptyQuery (): VendorQuery {
  return { links: 0, colours: [], moveSpeed: 0, life: 0, resists: [], resistMin: 0, plusGems: false, flatPhys: false, custom: '', match: 'any' }
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function range (lo: number, hi: number): string {
  if (lo === hi) return String(lo)
  if (lo === 0 && hi === 9) return '\\d'
  return `[${lo}-${hi}]`
}

// Regex for whole numbers >= n with at most maxDigits digits (no leading zeros).
// e.g. atLeast(15, 2) = "1[5-9]|[2-9]\d"
export function atLeast (n: number, maxDigits: number): string {
  n = Math.max(0, Math.floor(n))
  const digits = String(n).split('').map(Number)
  const d = digits.length
  if (d > maxDigits) return ''
  const alts: string[] = []
  // trailing zeros are covered by "\d" (20 -> [2-9]\d, not 2\d|[3-9]\d)
  let zeros = 0
  if (n > 0) while (digits[d - 1 - zeros] === 0) zeros++
  // same number of digits: the first digit that is larger decides
  for (let i = d - 1 - zeros; i >= 0; i--) {
    const last = i === d - 1 - zeros
    const lo = digits[i] + (last ? 0 : 1)
    const hi = 9
    if (lo > hi) continue
    if (i === 0 && d > 1 && lo === 0) continue
    const rest = d - i - 1
    alts.push(digits.slice(0, i).join('') + range(lo, hi) + (rest ? (rest === 1 ? '\\d' : `\\d{${rest}}`) : ''))
  }
  // more digits
  if (maxDigits > d) {
    const extraMin = d
    const extraMax = maxDigits - 1
    alts.push('[1-9]' + (extraMin === extraMax ? (extraMin === 1 ? '\\d' : `\\d{${extraMin}}`) : `\\d{${extraMin},${extraMax}}`))
  }
  return alts.join('|')
}

const group = (alts: string) => alts.includes('|') ? `(${alts})` : alts

// all orders of the wanted colours along a link, e.g. r,g,b -> "r-g-b|r-b-g|..."
export function linkPattern (links: number, colours: Colour[]): string {
  if (links < 2) return ''
  const want: Colour[] = colours.length === links ? colours : Array(links).fill('x')
  if (want.every(c => c === 'x')) return Array(links).fill('\\w').join('-')
  const seen = new Set<string>()
  const out: string[] = []
  const permute = (rest: Colour[], acc: Colour[]) => {
    if (!rest.length) {
      const s = acc.map(c => c === 'x' ? '\\w' : c).join('-')
      if (!seen.has(s)) { seen.add(s); out.push(s) }
      return
    }
    for (let i = 0; i < rest.length; i++) {
      if (rest.indexOf(rest[i]) !== i) continue
      permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, rest[i]])
    }
  }
  permute(want, [])
  return out.join('|')
}

export interface VendorPart { label: string, regex: string }

export function vendorParts (q: VendorQuery): VendorPart[] {
  const parts: VendorPart[] = []
  if (q.links >= 2) {
    const want = q.colours.length === q.links ? q.colours.filter(c => c !== 'x') : []
    parts.push({
      label: `${q.links}-link${want.length ? ` (${want.map(c => c.toUpperCase()).join('')})` : ''}`,
      regex: linkPattern(q.links, q.colours)
    })
  }
  if (q.moveSpeed > 0) {
    parts.push({ label: `Movement speed ${q.moveSpeed}%+`, regex: `${group(atLeast(q.moveSpeed, 2))}% increased mov` })
  }
  if (q.life > 0) {
    parts.push({ label: `Life ${q.life}+`, regex: `\\+${group(atLeast(q.life, 3))} to maximum life` })
  }
  if (q.resists.length) {
    const els = q.resists.length === 4 ? '' : group(q.resists.map(e => e === 'lightning' ? 'light' : e).join('|'))
    const num = q.resistMin > 0 ? group(atLeast(q.resistMin, 2)) : '\\d+'
    parts.push({
      label: `${q.resists.length === 4 ? 'Any' : q.resists.join(', ')} resistance${q.resistMin > 0 ? ` ${q.resistMin}%+` : ''}`,
      regex: els ? `${num}% to ${els}` : `${num}% to \\w+ res`
    })
  }
  if (q.plusGems) parts.push({ label: '+1 to gem levels', regex: 'level of all' })
  if (q.flatPhys) parts.push({ label: 'Adds physical damage', regex: 'adds \\d+ to \\d+ phys' })
  const custom = q.custom.trim()
  if (custom) parts.push({ label: `"${custom}"`, regex: escapeRe(custom.toLowerCase()) })
  return parts
}

export interface VendorResult {
  text: string
  length: number
  tooLong: boolean
  parts: VendorPart[]
}

export function vendorRegex (q: VendorQuery): VendorResult {
  const parts = vendorParts(q).filter(p => p.regex)
  let text = ''
  if (parts.length) {
    text = q.match === 'all'
      ? parts.map(p => `"${p.regex}"`).join(' ')
      : `"${parts.map(p => p.regex).join('|')}"`
  }
  return { text, length: text.length, tooLong: text.length > MAX_LEN, parts }
}
