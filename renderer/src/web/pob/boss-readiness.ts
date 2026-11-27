// Deathloom fork (Q21, 27 Nov 2026): boss readiness card. Pure: takes the active
// build's saved Path of Building stats (PlayerStat values from the build file,
// the same profile the map check uses) and says, per pinnacle boss, whether the
// build meets a rule-of-thumb bar for DPS, resistances, chaos resistance and the
// maximum hit it can take from the boss's main damage types. Nothing is read
// from the game or GGG's site. Unit-tested in tests/boss-readiness.test.mjs.
//
// The bars are community rules of thumb (a guess, not GGG data): enough to kill
// in a reasonable time and survive one big hit you didn't dodge. Mechanics text
// is short and general; it doesn't replace learning the fight.

export type HitType = 'Physical' | 'Fire' | 'Cold' | 'Lightning' | 'Chaos'

export interface Boss {
  id: string
  name: string
  uber: boolean
  // tick id in Reference → Tracking → Checklist (Pinnacle bosses), if it has one
  progressId?: string
  // damage types of the hits that kill most often
  hits: HitType[]
  // rule-of-thumb bars (guess)
  dps: number
  maxHit: number
  chaosRes: number
  mechanics: string[]
}

const P = (dps: number, maxHit: number, chaosRes: number) => ({ dps, maxHit, chaosRes })
const NORMAL = P(2_000_000, 7_000, 0)
const UBER = P(20_000_000, 12_000, 40)

export const BOSSES: Boss[] = [
  {
    id: 'exarch',
    name: 'The Searing Exarch',
    uber: false,
    progressId: 'exarch',
    hits: ['Fire', 'Physical'],
    ...NORMAL,
    mechanics: ['Mostly fire: cap fire resistance and keep a fire-res flask for the last phase.', 'Falling meteors and fire balls: keep moving, never stand in burning ground.']
  },
  {
    id: 'eater',
    name: 'The Eater of Worlds',
    uber: false,
    progressId: 'eater',
    hits: ['Physical', 'Lightning', 'Chaos'],
    ...NORMAL,
    mechanics: ['Tentacle slams and spikes from the ground: dodge sideways when the floor marks them.', 'Void spheres and ground effects: move to clean ground.']
  },
  {
    id: 'maven',
    name: 'The Maven',
    uber: false,
    progressId: 'maven',
    hits: ['Physical', 'Fire', 'Lightning'],
    ...NORMAL,
    mechanics: ['Memory game: watch the order the brain lights up, then stand in the safe slices in that order.', 'Rings of ground blasts: step into the ring that just went off.']
  },
  {
    id: 'shaper',
    name: 'The Shaper',
    uber: false,
    progressId: 'shaper',
    hits: ['Physical', 'Cold'],
    ...NORMAL,
    mechanics: ['Slam has a long wind-up and hits very hard: walk out of it.', 'Beam: walk sideways out of the line. Bullet hell: keep moving between the shots.']
  },
  {
    id: 'elder',
    name: 'The Elder',
    uber: false,
    progressId: 'elder',
    hits: ['Physical', 'Chaos'],
    ...P(1_500_000, 6_000, 0),
    mechanics: ['Kill the guardians\' adds quickly and stay off the purple degen ground.']
  },
  {
    id: 'uelder',
    name: 'The Uber Elder',
    uber: false,
    progressId: 'uelder',
    hits: ['Physical', 'Cold', 'Chaos'],
    ...P(3_000_000, 8_000, 20),
    mechanics: ['Shaper and Elder at once: Shaper\'s slam and beam as above, and the Elder\'s degen ground.', 'Damage both down together; they share a phase change.']
  },
  {
    id: 'sirus',
    name: 'Sirus, Awakener of Worlds',
    uber: false,
    progressId: 'sirus',
    hits: ['Physical', 'Lightning', 'Chaos'],
    ...NORMAL,
    mechanics: ['"Die" beam: move out of its line as soon as he starts it.', 'Storms and clones: don\'t stand still; last phase meteor: leave its circle.']
  },
  {
    id: 'venarius',
    name: 'High Templar Venarius',
    uber: false,
    hits: ['Physical', 'Fire'],
    ...NORMAL,
    mechanics: ['Slams and glyphs on the floor: stay out of the marked areas.']
  },
  { id: 'u-exarch', name: 'Uber Searing Exarch', uber: true, progressId: 'ubers', hits: ['Fire', 'Physical'], ...UBER, maxHit: 15_000, mechanics: ['Much bigger fire hits: fire resistance over the cap helps against exposure.'] },
  { id: 'u-eater', name: 'Uber Eater of Worlds', uber: true, progressId: 'ubers', hits: ['Physical', 'Lightning', 'Chaos'], ...UBER, mechanics: ['Same fight with harder hits and more ground effects.'] },
  { id: 'u-maven', name: 'Uber Maven', uber: true, progressId: 'ubers', hits: ['Physical', 'Fire', 'Lightning'], ...UBER, mechanics: ['Longer memory game; the ring blasts can one-shot.'] },
  { id: 'u-shaper', name: 'Uber Shaper', uber: true, progressId: 'ubers', hits: ['Physical', 'Cold'], ...UBER, mechanics: ['Slam and beam can one-shot: dodge them, don\'t tank them.'] },
  { id: 'u-uelder', name: 'Uber Uber Elder', uber: true, progressId: 'ubers', hits: ['Physical', 'Cold', 'Chaos'], ...UBER, mechanics: ['Both bosses hit much harder; keep moving out of the degen.'] },
  { id: 'u-sirus', name: 'Uber Sirus', uber: true, progressId: 'ubers', hits: ['Physical', 'Lightning', 'Chaos'], ...UBER, mechanics: ['"Die" beam and the final meteor kill almost anything: dodge both.'] },
  { id: 'u-venarius', name: 'Uber Venarius', uber: true, progressId: 'ubers', hits: ['Physical', 'Fire'], ...UBER, mechanics: ['Harder slams and more glyphs.'] }
]

export type CheckId = 'dps' | 'res' | 'chaos' | 'hit'
export interface ReadinessCheck {
  id: CheckId
  label: string
  // null: the build file doesn't have this stat (save the build in PoB)
  ok: boolean | null
  // how close (have / want), for the verdict; null when unknown
  ratio: number | null
  have: string
  want: string
}
export type Verdict = 'ready' | 'close' | 'not' | 'unknown'
export interface Readiness { boss: Boss, checks: ReadinessCheck[], verdict: Verdict }

const num = (v: unknown): number | undefined => typeof v === 'number' && Number.isFinite(v) ? v : undefined

export function fmtNum (n: number): string {
  const a = Math.abs(n)
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)}B`
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `${+(n / 1e3).toFixed(1)}k`
  return String(Math.round(n))
}

// the build's total DPS as PoB shows it (minion builds: minion DPS)
export function buildDps (stats: Record<string, number | undefined>): number | undefined {
  const s = (k: string) => num(stats[k])
  return s('FullDPS') ?? s('CombinedDPS') ?? s('MinionDPS') ??
    (s('TotalDPS') != null || s('TotalDotDPS') != null ? (s('TotalDPS') ?? 0) + (s('TotalDotDPS') ?? 0) : undefined)
}

export const ELE_CAP = 75

export function readiness (boss: Boss, stats: Record<string, number | undefined>): Readiness {
  const s = (k: string) => num(stats[k])
  const checks: ReadinessCheck[] = []

  const dps = buildDps(stats)
  checks.push({
    id: 'dps',
    label: 'DPS',
    ok: dps == null ? null : dps >= boss.dps,
    ratio: dps == null ? null : dps / boss.dps,
    have: dps == null ? '?' : fmtNum(dps),
    want: fmtNum(boss.dps)
  })

  const eles = (['Fire', 'Cold', 'Lightning'] as const).map(e => ({ e, v: s(`${e}Resist`) }))
  const known = eles.filter((x): x is { e: 'Fire' | 'Cold' | 'Lightning', v: number } => x.v != null)
  const low = known.filter(x => x.v < ELE_CAP)
  const minRes = known.length ? Math.min(...known.map(x => x.v)) : undefined
  checks.push({
    id: 'res',
    label: 'Resistances',
    ok: known.length < 3 ? null : !low.length,
    ratio: minRes == null ? null : Math.max(0, minRes) / ELE_CAP,
    have: known.length < 3 ? '?' : low.length ? low.map(x => `${x.e} ${Math.round(x.v)}%`).join(', ') : 'capped',
    want: `${ELE_CAP}% each`
  })

  const chaos = s('ChaosResist')
  checks.push({
    id: 'chaos',
    label: 'Chaos resistance',
    ok: chaos == null ? null : chaos >= boss.chaosRes,
    // 0% wanted: -60% (act 10 penalty) is "far", 0 is "there"
    ratio: chaos == null ? null : boss.chaosRes > 0 ? Math.max(0, chaos) / boss.chaosRes : (chaos + 60) / 60,
    have: chaos == null ? '?' : `${Math.round(chaos)}%`,
    want: `${boss.chaosRes}%+`
  })

  const hits = boss.hits.map(t => ({ t, v: s(`${t}MaximumHitTaken`) })).filter((x): x is { t: HitType, v: number } => x.v != null)
  const worst = hits.length ? hits.reduce((a, b) => b.v < a.v ? b : a) : undefined
  checks.push({
    id: 'hit',
    label: 'Biggest hit you survive',
    ok: worst == null ? null : worst.v >= boss.maxHit,
    ratio: worst == null ? null : worst.v / boss.maxHit,
    have: worst == null ? '?' : `${fmtNum(worst.v)} ${worst.t.toLowerCase()}`,
    want: fmtNum(boss.maxHit)
  })

  return { boss, checks, verdict: verdictOf(checks) }
}

// ready: every known check passes; not: DPS under half or the max hit under 70 %
// of the bar, or resistances well under the cap; close: in between
export function verdictOf (checks: ReadinessCheck[]): Verdict {
  const known = checks.filter(c => c.ok != null)
  if (!known.length) return 'unknown'
  if (known.every(c => c.ok)) return 'ready'
  const far = known.some(c => !c.ok && c.ratio != null && (
    (c.id === 'dps' && c.ratio < 0.5) || (c.id === 'hit' && c.ratio < 0.7) || (c.id === 'res' && c.ratio < 0.8)))
  return far ? 'not' : 'close'
}

export function readinessAll (stats: Record<string, number | undefined>, uber: boolean): Readiness[] {
  return BOSSES.filter(b => b.uber === uber).map(b => readiness(b, stats))
}

export const VERDICT_LABEL: Record<Verdict, string> = { ready: 'Ready', close: 'Close', not: 'Not yet', unknown: 'No stats' }
