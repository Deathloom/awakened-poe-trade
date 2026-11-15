// Deathloom fork: background decorations for themes (Loot Goblin window).
// All drawn here by us as plain CSS gradients and tiny inline SVG shapes:
// no pictures, no GGG artwork, nothing downloaded. Kept faint so text stays readable.

export interface Decor {
  // CSS background-image layers (top first)
  image: string
  // background-size per layer
  size: string
}

const svg = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`

const glow = (x: string, y: string, rgba: string, r = '45%') =>
  `radial-gradient(circle at ${x} ${y}, ${rgba}, transparent ${r})`

// small shapes, centred on 0,0
const star4 = (x: number, y: number, s: number, fill: string, op: number) =>
  `<path transform='translate(${x} ${y}) scale(${s})' d='M0-6L1.5-1.5L6 0L1.5 1.5L0 6L-1.5 1.5L-6 0L-1.5-1.5Z' fill='${fill}' opacity='${op}'/>`
const dot = (x: number, y: number, r: number, fill: string, op: number) =>
  `<circle cx='${x}' cy='${y}' r='${r}' fill='${fill}' opacity='${op}'/>`
const leaf = (x: number, y: number, rot: number, fill: string, op: number) =>
  `<g transform='translate(${x} ${y}) rotate(${rot})' opacity='${op}'><path d='M0-9C6-5 6 5 0 9C-6 5-6-5 0-9Z' fill='${fill}'/><path d='M0-9V11' stroke='${fill}' stroke-width='1'/></g>`
const flake = (x: number, y: number, s: number, op: number) =>
  `<g transform='translate(${x} ${y}) scale(${s})' stroke='#dff1ff' stroke-width='1.2' stroke-linecap='round' opacity='${op}'><path d='M0-7V7M-6-3.5L6 3.5M-6 3.5L6-3.5'/></g>`
const blossom = (x: number, y: number, fill: string, op: number) =>
  `<g transform='translate(${x} ${y})' opacity='${op}'>${[0, 72, 144, 216, 288].map(a => `<circle cx='0' cy='-3.5' r='2.6' fill='${fill}' transform='rotate(${a})'/>`).join('')}<circle r='1.6' fill='#ffe58a'/></g>`
const pumpkin = (x: number, y: number, op: number) =>
  `<g transform='translate(${x} ${y})' opacity='${op}'><ellipse rx='9' ry='7' fill='#ff7a1a'/><ellipse rx='3.5' ry='7' fill='#e2600a'/><rect x='-1' y='-10' width='2' height='4' fill='#5c8a3a'/></g>`
const egg = (x: number, y: number, rot: number, fill: string, op: number) =>
  `<g transform='translate(${x} ${y}) rotate(${rot})' opacity='${op}'><path d='M0-9C5-9 7 1 7 3C7 7 4 9 0 9C-4 9-7 7-7 3C-7 1-5-9 0-9Z' fill='${fill}'/><path d='M-6.6 1H6.6' stroke='#fff' stroke-width='1.4' opacity='.6'/></g>`
const heart = (x: number, y: number, s: number, fill: string, op: number) =>
  `<path transform='translate(${x} ${y}) scale(${s})' d='M0 4C-7-1-5-7 0-3.5C5-7 7-1 0 4Z' fill='${fill}' opacity='${op}'/>`
const coin = (x: number, y: number, op: number) =>
  `<g transform='translate(${x} ${y})' opacity='${op}'><circle r='6' fill='#e8b923'/><circle r='4' fill='none' stroke='#a57e0e' stroke-width='1'/></g>`
const confetti = (x: number, y: number, rot: number, fill: string, op: number) =>
  `<rect x='${x}' y='${y}' width='5' height='2.4' fill='${fill}' opacity='${op}' transform='rotate(${rot} ${x} ${y})'/>`
const moon = (x: number, y: number, s: number, fill: string, op: number) =>
  `<path transform='translate(${x} ${y}) scale(${s})' d='M2-8A8 8 0 1 0 2 8A6.5 6.5 0 1 1 2-8Z' fill='${fill}' opacity='${op}'/>`

export const DECOR: Record<string, Decor> = {
  summer: {
    image: [
      svg(180, 180, star4(30, 40, 0.6, '#ffd27a', 0.18) + star4(130, 120, 0.4, '#ffd27a', 0.14) + dot(90, 160, 1.4, '#ffd27a', 0.2)),
      glow('88%', '6%', 'rgba(255,184,64,.20)', '42%')
    ].join(', '),
    size: '180px 180px, cover'
  },
  autumn: {
    image: [
      svg(220, 220, leaf(40, 50, 30, '#d9662b', 0.14) + leaf(160, 90, -40, '#c79a2e', 0.12) + leaf(90, 180, 70, '#a8432a', 0.12)),
      glow('15%', '100%', 'rgba(217,102,43,.12)', '50%')
    ].join(', '),
    size: '220px 220px, cover'
  },
  winter: {
    image: [
      svg(160, 160, flake(30, 30, 1, 0.16) + flake(115, 90, 0.7, 0.12) + dot(70, 130, 1.5, '#dff1ff', 0.18) + dot(140, 20, 1.2, '#dff1ff', 0.16)),
      glow('50%', '0%', 'rgba(124,198,240,.12)', '55%')
    ].join(', '),
    size: '160px 160px, cover'
  },
  spring: {
    image: [
      svg(200, 200, blossom(40, 40, '#e48bbf', 0.18) + blossom(150, 120, '#f3b5d6', 0.14) + leaf(90, 170, 45, '#7cbf6a', 0.12)),
      glow('90%', '95%', 'rgba(124,191,106,.10)', '50%')
    ].join(', '),
    size: '200px 200px, cover'
  },
  halloween: {
    image: [
      svg(240, 240, pumpkin(50, 60, 0.16) + pumpkin(180, 170, 0.12) + moon(170, 50, 0.9, '#ffe2b8', 0.14) + star4(110, 120, 0.5, '#d8c6ff', 0.16) + dot(40, 190, 1.4, '#d8c6ff', 0.2)),
      glow('85%', '8%', 'rgba(255,122,26,.14)', '40%')
    ].join(', '),
    size: '240px 240px, cover'
  },
  festive: {
    image: [
      // a string of fairy lights along the top, plus a few sparkles
      svg(160, 360, '<path d=\'M0 12Q40 32 80 12T160 12\' fill=\'none\' stroke=\'#3c4f3f\' stroke-width=\'1.2\' opacity=\'.7\'/>' +
        dot(20, 19, 3, '#e0393e', 0.4) + dot(60, 23, 3, '#f2c94c', 0.4) + dot(100, 19, 3, '#4fbf6a', 0.4) + dot(140, 23, 3, '#5aa9e6', 0.4)),
      svg(200, 200, star4(50, 80, 0.5, '#f2c94c', 0.16) + star4(160, 160, 0.4, '#ffffff', 0.12)),
      glow('50%', '100%', 'rgba(224,57,62,.10)', '50%')
    ].join(', '),
    size: '160px 360px, 200px 200px, cover'
  },
  newyear: {
    image: [
      svg(180, 180, confetti(20, 30, 20, '#f2c94c', 0.3) + confetti(90, 60, -35, '#e5e7ef', 0.26) + confetti(150, 20, 60, '#ff6b9a', 0.24) +
        confetti(40, 130, -15, '#6bd1ff', 0.24) + confetti(120, 150, 40, '#f2c94c', 0.26) + star4(70, 110, 0.5, '#ffffff', 0.18)),
      glow('50%', '0%', 'rgba(242,201,76,.12)', '50%')
    ].join(', '),
    size: '180px 180px, cover'
  },
  easter: {
    image: [
      svg(200, 200, egg(40, 50, -15, '#8fd3a8', 0.16) + egg(150, 110, 20, '#c8a8ef', 0.16) + egg(80, 170, 5, '#ffd27a', 0.14)),
      glow('50%', '100%', 'rgba(143,211,168,.10)', '50%')
    ].join(', '),
    size: '200px 200px, cover'
  },
  valentine: {
    image: [
      svg(180, 180, heart(40, 40, 1.4, '#ff4d79', 0.16) + heart(130, 110, 1, '#ff8fab', 0.14) + heart(70, 150, 0.8, '#ff4d79', 0.12)),
      glow('50%', '50%', 'rgba(255,77,121,.08)', '60%')
    ].join(', '),
    size: '180px 180px, cover'
  },
  goblin: {
    image: [
      svg(200, 200, coin(40, 50, 0.2) + coin(52, 56, 0.18) + coin(150, 140, 0.18) + star4(120, 40, 0.6, '#fff3b0', 0.22) + star4(60, 160, 0.4, '#fff3b0', 0.18)),
      glow('80%', '90%', 'rgba(232,185,35,.12)', '45%')
    ].join(', '),
    size: '200px 200px, cover'
  },
  potato: {
    // a coarse pixel grid
    image: svg(8, 8, '<rect width=\'4\' height=\'4\' fill=\'#ffffff\' opacity=\'.025\'/><rect x=\'4\' y=\'4\' width=\'4\' height=\'4\' fill=\'#ffffff\' opacity=\'.025\'/>'),
    size: '16px 16px'
  },
  comic: {
    image: [
      'radial-gradient(circle, rgba(255,210,63,.10) 1.2px, transparent 1.8px)',
      glow('100%', '0%', 'rgba(255,59,107,.12)', '45%')
    ].join(', '),
    size: '10px 10px, cover'
  },
  vendor: {
    image: 'repeating-linear-gradient(135deg, rgba(166,138,91,.05) 0 12px, transparent 12px 24px)',
    size: 'auto'
  },
  mirror: {
    image: [
      'linear-gradient(115deg, transparent 20%, rgba(255,240,170,.10) 30%, transparent 38%, transparent 55%, rgba(255,240,170,.07) 62%, transparent 70%)',
      svg(160, 160, star4(30, 30, 0.7, '#fff6c8', 0.22) + star4(120, 100, 0.5, '#fff6c8', 0.18)),
      glow('50%', '0%', 'rgba(255,215,0,.14)', '55%')
    ].join(', '),
    size: 'cover, 160px 160px, cover'
  },
  covens: {
    image: [
      svg(220, 220, moon(50, 50, 1.1, '#d6cde5', 0.14) + star4(160, 40, 0.5, '#d6cde5', 0.16) + dot(120, 170, 1.4, '#7ddf64', 0.22) + dot(30, 160, 1.1, '#d6cde5', 0.18)),
      glow('10%', '100%', 'rgba(125,223,100,.10)', '45%'),
      glow('90%', '0%', 'rgba(150,100,220,.14)', '50%')
    ].join(', '),
    size: '220px 220px, cover, cover'
  }
}
