// Deathloom fork: gray (surfaces/text) and blue (accent) come from CSS variables
// set by src/web/appearance.ts; defaults in App.vue (:root). Red and green too,
// so the colour-blind palette (Settings → Appearance) can swap them app-wide
const scale = (v) => Object.fromEntries([100, 200, 300, 400, 500, 600, 700, 800, 900]
  .map(n => [n, `rgb(var(--${v}-${n}) / <alpha-value>)`]))
// panel backgrounds (gray 800/900) follow the panel opacity setting
const panel = (n) => `rgb(var(--g-${n}) / calc(<alpha-value> * var(--panel-alpha, 1)))`
const r = (rem) => `calc(${rem}rem * var(--round, 1))`

module.exports = {
  content: ['./src/**/*.{ts,vue}'],
  theme: {
    extend: {
      fontFamily: {
      },
      backgroundColor: {
        gray: { ...scale('g'), 800: panel(800), 900: panel(900) }
      },
      borderRadius: {
        none: '0px',
        sm: r(0.125),
        DEFAULT: r(0.25),
        md: r(0.375),
        lg: r(0.5),
        xl: r(0.75),
        '2xl': r(1),
        '3xl': r(1.5)
      }
    },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',

      black: '#000',
      white: '#fff',

      gray: scale('g'),
      red: scale('r'),
      orange: {
        100: '#fffaf0',
        200: '#feebc8',
        300: '#fbd38d',
        400: '#f6ad55',
        500: '#ed8936',
        600: '#dd6b20',
        700: '#c05621',
        800: '#9c4221',
        900: '#7b341e',
      },
      yellow: {
        100: '#fffff0',
        200: '#fefcbf',
        300: '#faf089',
        400: '#f6e05e',
        500: '#ecc94b',
        600: '#d69e2e',
        700: '#b7791f',
        800: '#975a16',
        900: '#744210',
      },
      green: scale('gn'),
      teal: {
        100: '#e6fffa',
        200: '#b2f5ea',
        300: '#81e6d9',
        400: '#4fd1c5',
        500: '#38b2ac',
        600: '#319795',
        700: '#2c7a7b',
        800: '#285e61',
        900: '#234e52',
      },
      blue: scale('b'),
      accent: 'rgb(var(--accent) / <alpha-value>)',
      indigo: {
        100: '#ebf4ff',
        200: '#c3dafe',
        300: '#a3bffa',
        400: '#7f9cf5',
        500: '#667eea',
        600: '#5a67d8',
        700: '#4c51bf',
        800: '#434190',
        900: '#3c366b',
      },
      purple: {
        100: '#faf5ff',
        200: '#e9d8fd',
        300: '#d6bcfa',
        400: '#b794f4',
        500: '#9f7aea',
        600: '#805ad5',
        700: '#6b46c1',
        800: '#553c9a',
        900: '#44337a',
      },
      pink: {
        100: '#fff5f7',
        200: '#fed7e2',
        300: '#fbb6ce',
        400: '#f687b3',
        500: '#ed64a6',
        600: '#d53f8c',
        700: '#b83280',
        800: '#97266d',
        900: '#702459',
      },
      // Deathloom fork: colours the PoE2 price check (Exiled Exchange 2) uses
      fire: '#c80000',
      cold: '#5aadff',
      lightning: '#ffff00',
      normal: '#c8c8c8',
      magic: '#8888ff',
      rare: '#ffff77',
      unique: '#af6025',
      rose: { 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337' },
      fuchsia: { 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75' },
      slate: { 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' }
    }
  },
  variants: {},
  plugins: []
}
