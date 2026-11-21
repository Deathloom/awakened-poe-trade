// Deathloom fork (Q7): Labyrinth helper while levelling. Pure logic (no Vue, no
// IPC) for the trial checklist and the next ascendancy pick; the overlay's level
// recorder (char-level.ts) feeds it Client.txt lines, the levelling planner shows it.
//
// Trials: the zones with a Labyrinth trial on the campaign route
// (campaign-route.json, part "trial"), by the area id the game writes in
// Client.txt ('Generating level 13 area "1_1_7_1"'). Normal needs the 6 of
// acts 1-3, Cruel the 3 of acts 6-7, Merciless the 3 of acts 8-10.
//
// What ticks a trial, from the local Client.txt only:
//  1. a game message about the trial being completed while you're in that
//     trial's zone. The exact wording isn't confirmed (GGG doesn't document it),
//     so any system line (": …") naming a trial and "complete" counts, and only
//     in a trial zone;
//  2. entering a Labyrinth of that difficulty: the game only lets you in with
//     all its trials done (and the lower labs done), so they're all ticked then;
//  3. a manual tick in the levelling planner (always possible, overrides 1 and 2).

export type LabDifficulty = 'normal' | 'cruel' | 'merciless' | 'eternal'
export const LAB_ORDER: LabDifficulty[] = ['normal', 'cruel', 'merciless', 'eternal']
export const LAB_LABEL: Record<LabDifficulty, string> = { normal: 'Normal', cruel: 'Cruel', merciless: 'Merciless', eternal: 'Eternal' }

export interface Trial { id: string, lab: Exclude<LabDifficulty, 'eternal'>, act: number, zone: string }
export const TRIALS: Trial[] = [
  { id: '1_1_7_1', lab: 'normal', act: 1, zone: 'The Lower Prison' },
  { id: '1_2_5_1', lab: 'normal', act: 2, zone: 'The Crypt Level 1' },
  { id: '1_2_6_2', lab: 'normal', act: 2, zone: 'The Chamber of Sins Level 2' },
  { id: '1_3_3_1', lab: 'normal', act: 3, zone: 'The Crematorium' },
  { id: '1_3_6', lab: 'normal', act: 3, zone: 'The Catacombs' },
  { id: '1_3_15', lab: 'normal', act: 3, zone: 'The Imperial Gardens' },
  { id: '2_6_7_1', lab: 'cruel', act: 6, zone: 'The Lower Prison' },
  { id: '2_7_4', lab: 'cruel', act: 7, zone: 'The Crypt' },
  { id: '2_7_5_2', lab: 'cruel', act: 7, zone: 'The Chamber of Sins Level 2' },
  { id: '2_8_5', lab: 'merciless', act: 8, zone: 'The Bath House' },
  { id: '2_9_7', lab: 'merciless', act: 9, zone: 'The Tunnel' },
  { id: '2_10_9', lab: 'merciless', act: 10, zone: 'The Ossuary' }
]
const TRIAL_IDS = new Set(TRIALS.map(t => t.id))
export function isTrialArea (code: string | undefined): boolean {
  return !!code && TRIAL_IDS.has(code)
}

// System message (no speaker / channel) about a trial being completed. Text after "] ".
const TRIAL_DONE = /^: (?=.*\btrial\b)(?=.*\bcomplete(?:d)?\b).{0,120}$/i
export function isTrialDoneText (text: string): boolean {
  return TRIAL_DONE.test(text)
}

// Labyrinth areas in Client.txt: "Labyrinth_Airlock" (Aspirants' Plaza, shared by
// all four) and the lab proper: "1_Labyrinth_…" / "2_…" / "3_…" (Normal, Cruel,
// Merciless) and "EndGame_Labyrinth_…" (Eternal); its area level says which one.
// The trials in maps ("EndGame_Labyrinth_trials_…") aren't the lab and don't count.
const LAB_PLAZA = 'Labyrinth_Airlock'
const LAB_PROPER = /^(?:[123]|EndGame)_Labyrinth_/i
export function isLabProper (code: string | undefined): boolean {
  return !!code && LAB_PROPER.test(code) && !/trials/i.test(code)
}
export function isLabArea (code: string | undefined): boolean {
  return code === LAB_PLAZA || isLabProper(code)
}
export function labFromArea (code: string | undefined, level: number): LabDifficulty | null {
  return isLabProper(code) ? labFromLevel(level) : null
}
// area levels 33 / 55 / 68 / 75
export function labFromLevel (level: number): LabDifficulty {
  return level >= 75 ? 'eternal' : level >= 68 ? 'merciless' : level >= 55 ? 'cruel' : 'normal'
}

// One of Izaro's last lines when he falls for good ("Triumphant at last!"). He has
// several and only this one is known here, so a lab also counts as done when a
// higher one is entered (labOnArea), and labs done can be typed in.
export function isIzaroDefeat (speaker: string, text: string): boolean {
  return speaker === 'Izaro' && /^Triumphant at last/.test(text)
}

// What the recorder keeps per character (in CharProgress)
export interface LabProgress {
  // trial area ids ticked from the log
  trials?: string[]
  // labs finished (Izaro defeated, or a higher lab entered)
  labs?: LabDifficulty[]
  // difficulty of the Labyrinth you're in (null/undefined = not in one)
  inLab?: LabDifficulty | null
  // last area id entered
  lastArea?: string
}

// One area change. Returns true when something changed.
export function labOnArea (p: LabProgress, code: string, level: number): boolean {
  const before = JSON.stringify([p.trials, p.labs, p.inLab, p.lastArea])
  p.lastArea = code
  const lab = labFromArea(code, level)
  if (lab) {
    p.inLab = lab
    const here = LAB_ORDER.indexOf(lab)
    // inside: every trial of this difficulty and the lower ones is done
    const add = TRIALS.filter(t => LAB_ORDER.indexOf(t.lab) <= here && !p.trials?.includes(t.id)).map(t => t.id)
    if (add.length) p.trials = [...(p.trials ?? []), ...add]
    // and the lower labs (the game only lets you in after those)
    const labs = LAB_ORDER.slice(0, here).filter(l => !p.labs?.includes(l))
    if (labs.length) p.labs = [...(p.labs ?? []), ...labs]
  } else if (!isLabArea(code)) {
    p.inLab = null
  }
  return JSON.stringify([p.trials, p.labs, p.inLab, p.lastArea]) !== before
}
export function labOnTrialDone (p: LabProgress): boolean {
  const id = p.lastArea
  if (!id || !isTrialArea(id) || p.trials?.includes(id)) return false
  p.trials = [...(p.trials ?? []), id]
  return true
}
export function labOnIzaro (p: LabProgress): boolean {
  const lab = p.inLab
  if (!lab || p.labs?.includes(lab)) return false
  p.labs = [...(p.labs ?? []), lab]
  return true
}

// Manual ticks (levelling planner), per character: trial id -> done or not,
// and the number of labs done when typed in
export interface LabManual { trials?: Record<string, boolean>, labs?: number }
export const LAB_MANUAL_KEY = 'deathloom.lab.manual.v1'
// keys that would reach Object.prototype when assigned
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
export function loadLabManual (): Record<string, LabManual> {
  try {
    const raw = JSON.parse(localStorage.getItem(LAB_MANUAL_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Record<string, LabManual> = {}
    for (const [name, m] of Object.entries(raw as Record<string, LabManual>)) {
      if (!m || typeof m !== 'object' || UNSAFE_KEYS.has(name)) continue
      const trials = Object.fromEntries(Object.entries(m.trials ?? {}).filter(([id, v]) => TRIAL_IDS.has(id) && typeof v === 'boolean'))
      const labs = Number.isInteger(m.labs) && m.labs! >= 0 && m.labs! <= 4 ? m.labs : undefined
      out[name] = { trials, labs }
    }
    return out
  } catch { return {} }
}
export function saveLabManual (all: Record<string, LabManual>) {
  // keep it small: the 20 most recently changed characters
  const kept = Object.entries(all).slice(-20)
  try { localStorage.setItem(LAB_MANUAL_KEY, JSON.stringify(Object.fromEntries(kept))) } catch {}
}

export function trialDone (id: string, p: LabProgress | null | undefined, m: LabManual | undefined): boolean {
  const manual = m?.trials?.[id]
  if (manual != null) return manual
  return p?.trials?.includes(id) === true
}

// Labs done: typed in, else from the log (Normal, Cruel … counted in order:
// a later lab can't be done before an earlier one)
export function labsDone (p: LabProgress | null | undefined, m: LabManual | undefined): number {
  if (m?.labs != null) return m.labs
  let n = 0
  while (n < LAB_ORDER.length && p?.labs?.includes(LAB_ORDER[n])) n++
  return n
}

export interface TrialRow { lab: Exclude<LabDifficulty, 'eternal'>, trials: Array<Trial & { done: boolean }>, done: number }
export function trialRows (p: LabProgress | null | undefined, m: LabManual | undefined): TrialRow[] {
  return (['normal', 'cruel', 'merciless'] as const).map(lab => {
    const trials = TRIALS.filter(t => t.lab === lab).map(t => ({ ...t, done: trialDone(t.id, p, m) }))
    return { lab, trials, done: trials.filter(t => t.done).length }
  })
}

// ---- ascendancy for the next lab ----
//
// What Path of Building gives (PoB fork, ImpactServer levelling plan): `ascendancy`
// is only the ascendancy notables the CURRENT levelling tree adds over the previous
// tree, sorted by name, multiple-choice options left out. Not the whole build, and
// no order to take them in (PoB keeps none). So this shows what this tree adds and
// which of those the game log already shows taken, and never claims an order.

export interface AscNode { id: number, name: string }
// tree map layout node: [id, x, y, kind, group, orbit, name, ascendancy | false, stats]
// kind 6 = ascendancy start
type LayoutNode = [number, number, number, number, number, number, string, string | false, string[]]
export interface AscLayout { nodes: LayoutNode[], links: Array<[number, number]> }

export interface AscendancyView {
  // the next lab (after `done` of them); null when all four are done
  lab: LabDifficulty | null
  // this tree's ascendancy notables not taken yet (by name, as PoB lists them)
  adds: AscNode[]
  // this tree's ascendancy notables the game log shows taken
  taken: AscNode[]
  // small passives on the way to `adds` (needs the tree layout and a known
  // starting point: no lab done yet, or the log followed from level 2); null: not known
  smalls: number | null
}

const lc = (s: string) => s.trim().toLowerCase()

// Names the game log shows allocated (Client.txt "Successfully allocated passive
// skill id: …, name: …"; the log's ids aren't PoB's node ids, so by name). Only
// names of this ascendancy's passives count: with the layout, a name also used by
// a main-tree passive is ambiguous and left out.
function takenAscNames (alloc: Record<string, number> | undefined, layout: AscLayout | null | undefined, asc: string | undefined): Set<string> {
  const names = new Set(Object.entries(alloc ?? {}).filter(([, c]) => c > 0).map(([k]) => lc(k)))
  if (!layout || !asc) return names
  const inAsc = new Set<string>(); const elsewhere = new Set<string>()
  for (const n of layout.nodes) (n[7] === asc ? inAsc : elsewhere).add(lc(n[6]))
  return new Set([...names].filter(k => inAsc.has(k) && !elsewhere.has(k)))
}

export function ascendancyView (
  listed: AscNode[],
  done: number,
  opts: { alloc?: Record<string, number>, layout?: AscLayout | null, logComplete?: boolean, ascendancyClass?: string } = {}
): AscendancyView {
  const lab = done >= 0 && done < LAB_ORDER.length ? LAB_ORDER[done] : null
  const seen = new Set<number>()
  const uniq = listed.filter(n => !seen.has(n.id) && seen.add(n.id))
  const layout = opts.layout
  const byId = new Map((layout?.nodes ?? []).map(n => [n[0], n]))
  const asc = uniq.map(n => byId.get(n.id)?.[7]).find((a): a is string => typeof a === 'string') ??
    (layout?.nodes.some(n => n[7] === opts.ascendancyClass) ? opts.ascendancyClass : undefined)
  const names = takenAscNames(opts.alloc, layout, asc)
  const taken = uniq.filter(n => names.has(lc(n.name)))
  const adds = uniq.filter(n => !names.has(lc(n.name)))
  let smalls: number | null = null
  if (layout && asc && adds.length && (opts.logComplete || done === 0)) {
    smalls = smallsOnTheWay(adds, layout, asc, names)
  }
  return { lab, adds, taken, smalls }
}

// Small passives to take on the way to `targets`: shortest paths from the
// ascendancy start plus what the log shows taken, one target after another
// (the order PoB lists them; the total can differ a little with another order).
function smallsOnTheWay (targets: AscNode[], layout: AscLayout, asc: string, takenNames: Set<string>): number | null {
  const inAsc = (n: LayoutNode | undefined) => n?.[7] === asc
  const byId = new Map(layout.nodes.filter(inAsc).map(n => [n[0], n]))
  const adj = new Map<number, number[]>()
  const add = (x: number, y: number) => { const l = adj.get(x); if (l) l.push(y); else adj.set(x, [y]) }
  for (const [x, y] of layout.links) if (byId.has(x) && byId.has(y)) { add(x, y); add(y, x) }
  const have = new Set([...byId.values()].filter(n => n[3] === 6 || takenNames.has(lc(n[6]))).map(n => n[0]))
  if (![...byId.values()].some(n => n[3] === 6)) return null
  const targetIds = new Set(targets.map(t => t.id))
  let smalls = 0
  for (const t of targets) {
    if (have.has(t.id)) continue
    const prev = new Map<number, number>()
    const queue = [...have]
    let found = false
    for (let qi = 0; qi < queue.length && !found; qi++) {
      for (const nb of adj.get(queue[qi]) ?? []) {
        if (have.has(nb) || prev.has(nb)) continue
        prev.set(nb, queue[qi])
        if (nb === t.id) { found = true; break }
        queue.push(nb)
      }
    }
    if (!found) return null
    for (let id: number | undefined = t.id; id != null && !have.has(id); id = prev.get(id)) {
      have.add(id)
      if (!targetIds.has(id)) smalls++
    }
  }
  return smalls
}

// ---- campaign guide's lab banner ----

export interface LabBanner { lab: LabDifficulty, level: number | null, done: boolean }
// One area change -> the banner (null: hidden). In the Aspirants' Plaza the
// difficulty isn't known yet (one plaza for all four): it's the next lab not done,
// until the first room of the lab proper gives the real one by its area level.
export function labBannerOnArea (prev: LabBanner | null, code: string, level: number, done: number): LabBanner | null {
  if (!isLabArea(code)) return null
  const lab = labFromArea(code, level)
  // same lab, later room (or the treasure room after Izaro): keep it
  if (lab) return prev && prev.lab === lab && prev.level != null ? prev : { lab, level, done: false }
  if (prev) return prev
  return { lab: LAB_ORDER[Math.min(Math.max(done, 0), LAB_ORDER.length - 1)], level: null, done: false }
}

// The banner's ascendancy line: this tree's notables not taken yet. Empty when
// there's no levelling plan (only the Orbhoarder window has one).
export function labBannerAscendancy (listed: AscNode[] | undefined, alloc?: Record<string, number>, layout?: AscLayout | null, ascendancyClass?: string): string[] {
  if (!listed?.length) return []
  return ascendancyView(listed, 0, { alloc, layout, ascendancyClass }).adds.map(n => n.name)
}
