// Deathloom fork: themes and look settings (Settings → Appearance).
// Tailwind's gray and blue colours, corner rounding and panel opacity are CSS
// variables (tailwind.config.js); this file sets them for the chosen theme.
// Gray = surfaces and text, blue = the accent colour.

export type ThemeId = 'classic' | 'midnight' | 'ember' | 'abyss' | 'contrast'
export type UiFont = 'poe-sc' | 'poe' | 'system'

export interface AppearanceConfig {
  theme: ThemeId
  // '' = the theme's own accent
  accent: string
  font: UiFont
  // 0 = square, 1 = normal, 2 = round
  rounding: number
  // 40–100 (%), panels in the overlay over the game
  overlayOpacity: number
  // Loot Goblin window
  windowBg: 'theme' | 'color' | 'image'
  windowBgColor: string
  // file name in the uploads folder
  windowBgImage: string
  // 0–90 (%), darkens the background image so text stays readable
  windowBgDim: number
  // 40–100 (%), panels in the window over the background
  windowOpacity: number
}

export const defaultAppearance = (): AppearanceConfig => ({
  theme: 'classic',
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

interface Theme {
  name: string
  // gray 100..900
  gray: string[]
  // blue 100..900 for classic (exact upstream colours), else derived from accent
  blue?: string[]
  accent: string
  // Loot Goblin window background
  windowBg: string
}

const CLASSIC_BLUE = ['#ebf8ff', '#bee3f8', '#90cdf4', '#63b3ed', '#4299e1', '#3182ce', '#2b6cb0', '#2c5282', '#2a4365']

export const THEMES: Record<ThemeId, Theme> = {
  classic: {
    name: 'Classic (Awakened PoE Trade)',
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
  }
}

export const FONTS: Record<UiFont, { name: string, css: string }> = {
  'poe-sc': { name: 'Fontin Small Caps (default)', css: 'FontinSmallCaps, FrizQuadrataC' },
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

export function applyAppearance (cfg: Partial<AppearanceConfig> | undefined, surface: Surface): void {
  const a = { ...defaultAppearance(), ...cfg }
  const theme = THEMES[a.theme] ?? THEMES.classic
  const root = document.documentElement.style

  theme.gray.forEach((hex, i) => { root.setProperty(`--g-${(i + 1) * 100}`, triplet(hex)) })

  const accent = a.accent && isValidColor(a.accent) ? a.accent : theme.accent
  const blue = (!a.accent && theme.blue)
    ? theme.blue.map(triplet)
    : (accentShades(accent) ?? CLASSIC_BLUE.map(triplet))
  blue.forEach((rgb, i) => { root.setProperty(`--b-${(i + 1) * 100}`, rgb) })
  root.setProperty('--accent', triplet(accent))

  root.setProperty('--round', String(Math.max(0, Math.min(2, a.rounding))))
  root.setProperty('--ui-font', (FONTS[a.font] ?? FONTS['poe-sc']).css)

  const pct = (v: number) => String(Math.max(40, Math.min(100, v)) / 100)
  root.setProperty('--panel-alpha', surface === 'desktop' ? pct(a.windowOpacity) : surface === 'overlay' ? pct(a.overlayOpacity) : '1')

  if (surface === 'desktop') {
    const base = a.windowBg === 'color' && isValidColor(a.windowBgColor) ? a.windowBgColor : theme.windowBg
    root.setProperty('--window-bg', base)
    if (a.windowBg === 'image' && /^[0-9a-f]{32}\.(png|jpe?g|webp|gif)$/i.test(a.windowBgImage)) {
      const dim = Math.max(0, Math.min(90, a.windowBgDim)) / 100
      // file name comes from our own uploads route (hash + extension); quoted and encoded
      const url = `/uploads/${encodeURIComponent(a.windowBgImage)}`
      root.setProperty('--window-bg-image', `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${url}")`)
    } else {
      root.setProperty('--window-bg-image', 'none')
    }
  }
}
