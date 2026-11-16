// Deathloom fork: themes and look settings (Settings → Appearance).
// Tailwind's gray and blue colours, corner rounding and panel opacity are CSS
// variables (tailwind.config.js); this file sets them for the chosen theme.
// Gray = surfaces and text, blue = the accent colour.
import { decorAt, splitLayers } from './theme-decor'
import './theme-decor.css'
import './motion.css'

export type ThemeId = 'clean' | 'classic' | 'midnight' | 'ember' | 'abyss' | 'contrast' |
  // seasons and holidays (also picked by date in Seasonal mode)
  'summer' | 'autumn' | 'winter' | 'spring' |
  'halloween' | 'festive' | 'newyear' | 'easter' | 'valentine' |
  // fun
  'goblin' | 'potato' | 'comic' | 'vendor' | 'mirror' |
  // leagues: colour moods named after the league, nothing more
  'covens'
export type UiFont = 'poe-sc' | 'poe' | 'system'
// fixed = the picked theme; seasonal = by today's date; league = by the league in Price check settings
export type ThemeMode = 'fixed' | 'seasonal' | 'league'

export interface AppearanceConfig {
  theme: ThemeId
  themeMode: ThemeMode
  // seasons follow this half of the world (Gerhard is in South Africa)
  hemisphere: 'south' | 'north'
  // Seasonal mode: Halloween, festive, New Year, Easter, Valentine's override the season for a few days
  holidays: boolean
  // our own CSS/SVG background decoration of the theme (Orbhoarder window, theme background only)
  decorations: boolean
  // Deathloom fork (16 Nov 2026): small print a bit bigger, brighter and in a plain font
  readableText: boolean
  // full: transitions, panels easing in, theme backgrounds that move; subtle: transitions only; off
  motion: 'full' | 'subtle' | 'off'
  // Orbhoarder window: panels are frosted glass over the background (blurred, see-through)
  glass: boolean
  // how visible the theme's decorations are, % (100 = as drawn)
  decorStrength: number
  // '' = the theme's own accent
  accent: string
  font: UiFont
  // 0 = square, 1 = normal, 2 = round
  rounding: number
  // 40–100 (%), panels in the overlay over the game
  overlayOpacity: number
  // Orbhoarder window
  windowBg: 'theme' | 'color' | 'image'
  windowBgColor: string
  // file name in the uploads folder
  windowBgImage: string
  // 0–90 (%), darkens the background image so text stays readable
  windowBgDim: number
  // 40–100 (%), panels in the window over the background
  windowOpacity: number
  // Deathloom fork (16 Nov 2026): set once the Clean look became the default
  cleanV1?: boolean
}

export const defaultAppearance = (): AppearanceConfig => ({
  theme: 'clean',
  themeMode: 'fixed',
  hemisphere: 'south',
  holidays: true,
  decorations: true,
  readableText: true,
  motion: 'full',
  glass: true,
  decorStrength: 180,
  accent: '',
  font: 'poe-sc',
  rounding: 1,
  overlayOpacity: 100,
  windowBg: 'theme',
  windowBgColor: '#1a202c',
  windowBgImage: '',
  windowBgDim: 50,
  windowOpacity: 100
})

export type ThemeGroup = 'standard' | 'season' | 'holiday' | 'fun' | 'league'

interface Theme {
  name: string
  group?: ThemeGroup
  // used instead of the default font (Fontin Small Caps) / Normal corners, if those weren't changed
  font?: UiFont
  rounding?: number
  // extra CSS class on <html> for the theme's own small style touches (theme-decor.css)
  style?: string
  // window background decoration: CSS gradients / inline SVG drawn by us (theme-decor.ts)
  decor?: string
  // gray 100..900
  gray: string[]
  // blue 100..900 for classic (exact upstream colours), else derived from accent
  blue?: string[]
  accent: string
  // Orbhoarder window background
  windowBg: string
  // flat look: no glass panels or accent glow, whatever the glass setting says
  flat?: boolean
}

const CLASSIC_BLUE = ['#ebf8ff', '#bee3f8', '#90cdf4', '#63b3ed', '#4299e1', '#3182ce', '#2b6cb0', '#2c5282', '#2a4365']

export const THEMES: Record<ThemeId, Theme> = {
  // Deathloom fork (16 Nov 2026): the default look. Flat surfaces, neutral greys
  // with more contrast between text and background, system font, one accent.
  clean: {
    name: 'Clean (flat, easy to read)',
    gray: ['#f8f9fb', '#eceff3', '#dde1e7', '#c4cad3', '#a3abb8', '#7d8696', '#3d434f', '#22262e', '#14161b'],
    accent: '#4f8cff',
    windowBg: '#0e1014',
    font: 'system',
    style: 'clean',
    flat: true
  },
  classic: {
    name: 'Classic',
    gray: ['#f7fafc', '#edf2f7', '#e2e8f0', '#cbd5e0', '#a0aec0', '#718096', '#4a5568', '#2d3748', '#1a202c'],
    blue: CLASSIC_BLUE,
    accent: '#4299e1',
    windowBg: '#1a202c'
  },
  midnight: {
    name: 'Midnight (modern dark)',
    gray: ['#f5f7fa', '#e8ecf2', '#d5dbe5', '#b9c2d0', '#9aa4b5', '#6b7588', '#3f4757', '#232833', '#14171e'],
    accent: '#5b8def',
    windowBg: '#0d0f14'
  },
  ember: {
    name: 'Wraeclast (warm, PoE style)',
    gray: ['#faf6ee', '#f1e8d6', '#e4d5b7', '#cdb995', '#b09c7a', '#7f6f55', '#524735', '#2e2820', '#1a1611'],
    accent: '#c8a24a',
    windowBg: '#110e0a'
  },
  abyss: {
    name: 'Abyss (deep purple)',
    gray: ['#f7f5fb', '#ebe7f3', '#d9d2e8', '#bdb2d3', '#9f93b8', '#6f6488', '#463d5a', '#28223a', '#171323'],
    accent: '#a57bf0',
    windowBg: '#0e0b16'
  },
  contrast: {
    name: 'High contrast',
    gray: ['#ffffff', '#ffffff', '#f5f5f5', '#e5e5e5', '#d4d4d4', '#a3a3a3', '#525252', '#1f1f1f', '#000000'],
    accent: '#ffd400',
    windowBg: '#000000'
  },
  // seasons
  summer: {
    name: 'Summer (sunny gold)',
    group: 'season',
    gray: ['#fffaf0', '#fdf0d8', '#f3dfba', '#dcc49a', '#bba57c', '#86745a', '#55493a', '#302922', '#1b1712'],
    accent: '#f59e0b',
    windowBg: '#16120d',
    decor: 'summer'
  },
  autumn: {
    name: 'Autumn (rust and falling leaves)',
    group: 'season',
    gray: ['#fbf6f2', '#f2e6dc', '#e3cfbf', '#c9ae98', '#a88b75', '#7a6252', '#4e3f35', '#2d241f', '#1a1411'],
    accent: '#d9662b',
    windowBg: '#120d0a',
    decor: 'autumn'
  },
  winter: {
    name: 'Winter (ice blue, snow)',
    group: 'season',
    gray: ['#f5fafd', '#e6f1f8', '#d0e2ee', '#afc6d8', '#8ea7bb', '#62788b', '#3d4c5a', '#232c36', '#131a21'],
    accent: '#7cc6f0',
    windowBg: '#0b1117',
    decor: 'winter'
  },
  spring: {
    name: 'Spring (fresh green, blossoms)',
    group: 'season',
    gray: ['#f6fbf5', '#e8f3e5', '#d2e6cd', '#b0cca9', '#8fae88', '#62805d', '#3f533c', '#243023', '#141c14'],
    accent: '#e48bbf',
    windowBg: '#0d130d',
    decor: 'spring'
  },
  // holidays
  halloween: {
    name: 'Halloween (pumpkin orange)',
    group: 'holiday',
    gray: ['#faf6fb', '#efe6f2', '#dccde3', '#c0abc9', '#a28bad', '#73607d', '#4a3c52', '#2a2130', '#18121c'],
    accent: '#ff7a1a',
    windowBg: '#0f0a12',
    decor: 'halloween'
  },
  festive: {
    name: 'Festive (pine, red and fairy lights)',
    group: 'holiday',
    gray: ['#f6faf6', '#e6f0e7', '#cfe0d1', '#adc6b0', '#8ba88f', '#5f7a63', '#3c4f3f', '#223024', '#131c15'],
    accent: '#e0393e',
    windowBg: '#0c130d',
    decor: 'festive'
  },
  newyear: {
    name: 'New Year (midnight and confetti)',
    group: 'holiday',
    gray: ['#f7f8fb', '#e9ecf4', '#d4d9e8', '#b4bcd3', '#949db8', '#666f8a', '#41485d', '#252a37', '#14171f'],
    accent: '#f2c94c',
    windowBg: '#0b0d14',
    decor: 'newyear'
  },
  easter: {
    name: 'Easter (pastel eggs)',
    group: 'holiday',
    gray: ['#fbf8fd', '#f1ebf6', '#e2d7ec', '#c8b8d7', '#aa98bc', '#7a6a8c', '#4e445b', '#2c2735', '#1a1720'],
    accent: '#8fd3a8',
    windowBg: '#121017',
    decor: 'easter'
  },
  valentine: {
    name: "Valentine's (rose and hearts)",
    group: 'holiday',
    gray: ['#fdf6f8', '#f6e6eb', '#ebcdd7', '#d5a9b8', '#b98799', '#875f6d', '#573e48', '#321f27', '#1e1217'],
    accent: '#ff4d79',
    windowBg: '#140b0f',
    decor: 'valentine'
  },
  // fun
  goblin: {
    name: 'Orbhoarder (goblin green and gold coins)',
    group: 'fun',
    gray: ['#f6fbf2', '#e8f3dc', '#d1e6b9', '#b0cc8f', '#8fae6c', '#62804a', '#3f5530', '#24321b', '#141d0f'],
    accent: '#e8b923',
    windowBg: '#0c1208',
    decor: 'goblin'
  },
  potato: {
    name: 'Potato PC (chunky, square, low-res)',
    group: 'fun',
    gray: ['#f4f1ea', '#e6e0d2', '#d1c8b2', '#b3a888', '#958a6a', '#6b6249', '#47412f', '#2b271c', '#1a1710'],
    accent: '#d4a64a',
    windowBg: '#15120c',
    font: 'system',
    rounding: 0,
    style: 'potato',
    decor: 'potato'
  },
  comic: {
    name: 'Comic Exile (wobbly corners, halftone)',
    group: 'fun',
    gray: ['#fbfbff', '#eef0fb', '#dadff4', '#bac2e6', '#9aa3d0', '#6c74a2', '#454b6e', '#272b43', '#161828'],
    accent: '#ffd23f',
    windowBg: '#12142a',
    font: 'poe',
    rounding: 2,
    style: 'comic',
    decor: 'comic'
  },
  vendor: {
    name: 'Vendor Trash (brown, grey, scraps)',
    group: 'fun',
    gray: ['#f5f3f0', '#e8e4de', '#d3ccc2', '#b5ab9e', '#968b7d', '#6b6257', '#463f38', '#2a2622', '#191714'],
    accent: '#a68a5b',
    windowBg: '#14120f',
    style: 'vendor',
    decor: 'vendor'
  },
  mirror: {
    name: 'Mirror Tier (absurdly shiny)',
    group: 'fun',
    gray: ['#fffcf0', '#fdf3cf', '#f7e39e', '#e9c96a', '#c9a646', '#8f7530', '#5c4b20', '#352b13', '#1e180a'],
    accent: '#ffd700',
    windowBg: '#120e05',
    style: 'mirror',
    decor: 'mirror'
  },
  // leagues (colour mood named after the league; no league art)
  covens: {
    name: 'Covens league (witchy purple and green)',
    group: 'league',
    gray: ['#f7f5fa', '#ebe6f2', '#d6cde5', '#b8aacd', '#9a8bb1', '#6c5f84', '#453c58', '#271f35', '#160f20'],
    accent: '#7ddf64',
    windowBg: '#0d0914',
    decor: 'covens'
  }
}

export const THEME_GROUPS: Array<{ id: ThemeGroup, name: string }> = [
  { id: 'standard', name: 'Standard' },
  { id: 'season', name: 'Seasons' },
  { id: 'holiday', name: 'Holidays' },
  { id: 'fun', name: 'Just for fun' },
  { id: 'league', name: 'Leagues' }
]

export const themeGroup = (id: ThemeId): ThemeGroup => THEMES[id]?.group ?? 'standard'

// League id (Price check → League, e.g. "Covens", "Hardcore Covens", "SSF Covens") → theme.
// To add a league: a colour-mood theme above plus one line here. No match → the picked theme.
export const LEAGUE_THEMES: Array<{ match: RegExp, theme: ThemeId, league: string }> = [
  { match: /\bcovens\b/i, theme: 'covens', league: 'Covens' }
]

export function leagueTheme (leagueId: string | undefined): ThemeId | null {
  if (!leagueId) return null
  return LEAGUE_THEMES.find(l => l.match.test(leagueId))?.theme ?? null
}

// Easter Sunday (Gregorian calendar, anonymous algorithm)
export function easterSunday (year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

const dayNo = (d: Date) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000)

export function holidayFor (date: Date): ThemeId | null {
  const m = date.getMonth() + 1
  const d = date.getDate()
  if ((m === 12 && d === 31) || (m === 1 && d <= 2)) return 'newyear'
  if (m === 12 && d >= 15) return 'festive'
  if ((m === 10 && d >= 24) || (m === 11 && d === 1)) return 'halloween'
  if (m === 2 && d >= 12 && d <= 15) return 'valentine'
  // Good Friday to Easter Monday
  const diff = dayNo(date) - dayNo(easterSunday(date.getFullYear()))
  if (diff >= -2 && diff <= 1) return 'easter'
  return null
}

export function seasonFor (date: Date, hemisphere: 'south' | 'north'): ThemeId {
  const m = date.getMonth() + 1
  const south: ThemeId = (m === 12 || m <= 2) ? 'summer' : m <= 5 ? 'autumn' : m <= 8 ? 'winter' : 'spring'
  if (hemisphere === 'south') return south
  return ({ summer: 'winter', autumn: 'spring', winter: 'summer', spring: 'autumn' } as Record<string, ThemeId>)[south]
}

export function seasonalTheme (date: Date, hemisphere: 'south' | 'north', holidays: boolean): ThemeId {
  return (holidays ? holidayFor(date) : null) ?? seasonFor(date, hemisphere)
}

export interface ActiveTheme {
  id: ThemeId
  // e.g. "Seasonal: Spring (southern hemisphere)"
  why: string
  // Seasonal mode: the next theme and the day it starts
  next?: { id: ThemeId, date: Date }
}

export function resolveTheme (cfg: Partial<AppearanceConfig> | undefined, leagueId?: string, now = new Date()): ActiveTheme {
  const a = { ...defaultAppearance(), ...cfg }
  const picked: ThemeId = THEMES[a.theme] ? a.theme : 'clean'
  if (a.themeMode === 'seasonal') {
    const id = seasonalTheme(now, a.hemisphere, a.holidays)
    let next: ActiveTheme['next']
    for (let i = 1; i <= 370; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
      const nid = seasonalTheme(day, a.hemisphere, a.holidays)
      if (nid !== id) { next = { id: nid, date: day }; break }
    }
    const kind = themeGroup(id) === 'holiday' ? 'holiday' : `${a.hemisphere}ern hemisphere`
    return { id, why: `Seasonal: ${THEMES[id].name} (${kind})`, next }
  }
  if (a.themeMode === 'league') {
    const id = leagueTheme(leagueId)
    if (id) return { id, why: `League ${leagueId}: ${THEMES[id].name}` }
    return { id: picked, why: `No theme for ${leagueId ? `league ${leagueId}` : 'the league'} yet, so your picked theme: ${THEMES[picked].name}` }
  }
  return { id: picked, why: THEMES[picked].name }
}

export const FONTS: Record<UiFont, { name: string, css: string }> = {
  'poe-sc': { name: 'Fontin Small Caps (PoE style; Clean uses the system font)', css: 'FontinSmallCaps, FrizQuadrataC' },
  'poe': { name: 'Fontin', css: 'Fontin, FrizQuadrataC' },
  'system': { name: 'System (Segoe UI)', css: '"Segoe UI", system-ui, sans-serif' }
}

function hexToRgb (hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as [number, number, number]
}

// 100..900 shades around the accent (500): lighter toward white, darker toward black
export function accentShades (accent: string): string[] | null {
  const c = hexToRgb(accent)
  if (!c) return null
  const W: [number, number, number] = [255, 255, 255]
  const K: [number, number, number] = [0, 0, 0]
  const steps: Array<[typeof W, number]> = [[W, 0.88], [W, 0.7], [W, 0.48], [W, 0.24], [W, 0], [K, 0.14], [K, 0.3], [K, 0.45], [K, 0.6]]
  return steps.map(([to, t]) => mix(c, to, t).join(' '))
}

const triplet = (hex: string) => (hexToRgb(hex) ?? [0, 0, 0]).join(' ')

export function isValidColor (hex: string): boolean {
  return hexToRgb(hex) != null
}

export type Surface = 'overlay' | 'hud' | 'desktop'

let lastApplied: { cfg: Partial<AppearanceConfig> | undefined, surface: Surface, leagueId?: string, id: ThemeId } | null = null
let timer: ReturnType<typeof setInterval> | null = null

export function applyAppearance (cfg: Partial<AppearanceConfig> | undefined, surface: Surface, leagueId?: string): void {
  const a = { ...defaultAppearance(), ...cfg }
  const active = resolveTheme(a, leagueId)
  const theme = THEMES[active.id] ?? THEMES.clean
  const root = document.documentElement.style
  lastApplied = { cfg, surface, leagueId, id: active.id }
  // Seasonal: switch at midnight while the app keeps running
  if (!timer) {
    timer = setInterval(() => {
      if (!lastApplied) return
      const now = resolveTheme(lastApplied.cfg, lastApplied.leagueId).id
      if (now !== lastApplied.id) applyAppearance(lastApplied.cfg, lastApplied.surface, lastApplied.leagueId)
    }, 10 * 60 * 1000)
  }

  theme.gray.forEach((hex, i) => { root.setProperty(`--g-${(i + 1) * 100}`, triplet(hex)) })

  const accent = a.accent && isValidColor(a.accent) ? a.accent : theme.accent
  const blue = (!a.accent && theme.blue)
    ? theme.blue.map(triplet)
    : (accentShades(accent) ?? CLASSIC_BLUE.map(triplet))
  blue.forEach((rgb, i) => { root.setProperty(`--b-${(i + 1) * 100}`, rgb) })
  root.setProperty('--accent', triplet(accent))

  // a theme's own corners / font only replace the defaults (Normal, Fontin Small Caps)
  const rounding = (a.rounding === 1 && theme.rounding != null) ? theme.rounding : a.rounding
  const font = (a.font === 'poe-sc' && theme.font) ? theme.font : a.font
  root.setProperty('--round', String(Math.max(0, Math.min(2, rounding))))
  root.setProperty('--ui-font', (FONTS[font] ?? FONTS['poe-sc']).css)

  const cls = document.documentElement.classList
  Array.from(cls).filter(c => c.startsWith('lg-style-') || c.startsWith('lg-motion-')).forEach(c => { cls.remove(c) })
  if (theme.style) cls.add(`lg-style-${theme.style}`)
  const motion = a.motion === 'off' || a.motion === 'subtle' ? a.motion : 'full'
  cls.add(`lg-motion-${motion}`)
  cls.toggle('lg-readable', a.readableText !== false)

  const pct = (v: number) => String(Math.max(40, Math.min(100, v)) / 100)
  root.setProperty('--panel-alpha', surface === 'desktop' ? pct(a.windowOpacity) : surface === 'overlay' ? pct(a.overlayOpacity) : '1')

  if (surface === 'desktop') {
    const decor = decorAt(Math.max(25, Math.min(300, a.decorStrength ?? 100)) / 100)
    // glass panels: see-through (unless you set your own panel opacity) and blurred
    const glass = a.glass !== false && !theme.flat
    cls.toggle('lg-glass', glass)
    if (glass && a.windowOpacity >= 100) root.setProperty('--panel-alpha', '0.62')
    // the theme's motif in the corner of each glass panel (its first pattern layer)
    const motifDecor = a.windowBg === 'theme' && a.decorations && theme.decor ? decor[theme.decor] : undefined
    const motifIdx = motifDecor ? splitLayers(motifDecor.image).findIndex(l => l.startsWith('url(')) : -1
    if (motifDecor && motifIdx >= 0) {
      root.setProperty('--theme-motif', splitLayers(motifDecor.image)[motifIdx])
      root.setProperty('--theme-motif-size', splitLayers(motifDecor.size)[motifIdx] ?? 'auto')
      cls.add('lg-motif')
    } else {
      cls.remove('lg-motif')
    }
    const base = a.windowBg === 'color' && isValidColor(a.windowBgColor) ? a.windowBgColor : theme.windowBg
    root.setProperty('--window-bg', base)
    root.setProperty('--window-bg-size', 'cover')
    if (a.windowBg === 'image' && /^[0-9a-f]{32}\.(png|jpe?g|webp|gif)$/i.test(a.windowBgImage)) {
      const dim = Math.max(0, Math.min(90, a.windowBgDim)) / 100
      // file name comes from our own uploads route (hash + extension); quoted and encoded
      const url = `/uploads/${encodeURIComponent(a.windowBgImage)}`
      root.setProperty('--window-bg-image', `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${url}")`)
    } else if (a.windowBg === 'theme' && a.decorations && theme.decor && decor[theme.decor]) {
      const d = decor[theme.decor]
      const images = splitLayers(d.image)
      const sizes = splitLayers(d.size)
      // Animations: Full: the drifting layer moves on its own layer (html.lg-drift, motion.css)
      if (d.drift && motion === 'full' && images[d.drift.layer]) {
        const [tile] = images.splice(d.drift.layer, 1)
        const [tileSize] = sizes.splice(d.drift.layer, 1)
        root.setProperty('--decor-tile', tile)
        root.setProperty('--decor-tile-size', tileSize)
        root.setProperty('--decor-dx', `${d.drift.dx}px`)
        root.setProperty('--decor-dy', `${d.drift.dy}px`)
        root.setProperty('--decor-pad', `${Math.max(Math.abs(d.drift.dx), Math.abs(d.drift.dy))}px`)
        root.setProperty('--decor-seconds', `${d.drift.seconds}s`)
        cls.add('lg-drift')
      } else {
        cls.remove('lg-drift')
      }
      root.setProperty('--window-bg-image', images.length ? images.join(', ') : 'none')
      root.setProperty('--window-bg-size', sizes.length ? sizes.join(', ') : 'cover')
    } else {
      root.setProperty('--window-bg-image', 'none')
    }
    if (!(a.windowBg === 'theme' && a.decorations && theme.decor && decor[theme.decor]?.drift && motion === 'full')) cls.remove('lg-drift')
  }
}
