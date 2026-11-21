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
//     all its trials done, so they're all ticked then;
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

// Labyrinth areas in Client.txt: "1_Labyrinth_…" (the lab proper; its area level
// says which one) and "Labyrinth_Airlock" (Aspirants' Plaza, shared by all)
export function isLabArea (code: string | undefined): boolean {
  return !!code && /Labyrinth/i.test(code)
}
export function labFromArea (code: string | undefined, level: number): LabDifficulty | null {
  if (!isLabArea(code) || /Airlock/i.test(code!)) return null
  return labFromLevel(level)
}
// area levels 33 / 55 / 68 / 75
export function labFromLevel (level: number): LabDifficulty {
  return level >= 75 ? 'eternal' : level >= 68 ? 'merciless' : level >= 55 ? 'cruel' : 'normal'
}

// Izaro's last words when he falls for good ("Triumphant at last!")
export function isIzaroDefeat (speaker: string, text: string): boolean {
  return speaker === 'Izaro' && /^Triumphant at last/.test(text)
}

// What the recorder keeps per character (in CharProgress)
export interface LabProgress {
  // trial area ids ticked from the log
  trials?: string[]
  // labs finished (Izaro defeated)
  labs?: LabDifficulty[]
  // difficulty of the Labyrinth you're in (null/undefined = not in one)
  inLab?: LabDifficulty | null
  // last area id entered
  lastArea?: string
}

// One area change. Returns true when something changed.
export function labOnArea (p: LabProgress, code: string, level: number): boolean {
  const before = JSON.stringify([p.trials, p.inLab, p.lastArea])
  p.lastArea = code
  const lab = labFromArea(code, level)
  if (lab) {
    p.inLab = lab
    // inside: every trial of this difficulty is done
    const add = TRIALS.filter(t => t.lab === lab && !p.trials?.includes(t.id)).map(t => t.id)
    if (add.length) p.trials = [...(p.trials ?? []), ...add]
  } else if (!isLabArea(code)) {
    p.inLab = null
  }
  return JSON.stringify([p.trials, p.inLab, p.lastArea]) !== before
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
export function loadLabManual (): Record<string, LabManual> {
  try {
    const raw = JSON.parse(localStorage.getItem(LAB_MANUAL_KEY) ?? 'null')
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
    const out: Record<string, LabManual> = {}
    for (const [name, m] of Object.entries(raw as Record<string, LabManual>)) {
      if (!m || typeof m !== 'object') continue
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

// ---- next ascendancy pick ----

export interface AscNode { id: number, name: string }
// tree map layout node: [id, x, y, kind, group, orbit, name, ascendancy | false, stats]
// kind 6 = ascendancy start
type LayoutNode = [number, number, number, number, number, number, string, string | false, string[]]
export interface AscLayout { nodes: LayoutNode[], links: Array<[number, number]> }

// The build's ascendancy passives in the order to take them, one entry per point.
// PoB keeps no allocation order, so it's the order the levelling planner lists
// them (its trees in level order). With the tree layout (once the tree map has
// loaded it) the small passives on the way to each one are put in front of it,
// so every entry is one point and the pairs line up with the labs.
export function ascendancyPoints (listed: AscNode[], layout?: AscLayout | null): AscNode[] {
  const seen = new Set<number>()
  const uniq = listed.filter(n => !seen.has(n.id) && seen.add(n.id))
  if (!layout) return uniq
  const byId = new Map(layout.nodes.map(n => [n[0], n]))
  const asc = uniq.map(n => byId.get(n.id)?.[7]).find((a): a is string => typeof a === 'string')
  if (!asc) return uniq
  const inAsc = (id: number) => byId.get(id)?.[7] === asc
  const adj = new Map<number, number[]>()
  const add = (x: number, y: number) => { const l = adj.get(x); if (l) l.push(y); else adj.set(x, [y]) }
  for (const [x, y] of layout.links) if (inAsc(x) && inAsc(y)) { add(x, y); add(y, x) }
  const have = new Set(layout.nodes.filter(n => n[3] === 6 && n[7] === asc).map(n => n[0]))
  const out: AscNode[] = []
  for (const n of uniq) {
    if (have.has(n.id)) continue
    // shortest path from what's taken to this passive (breadth first)
    const prev = new Map<number, number>()
    const queue = [...have]
    let found = false
    for (let qi = 0; qi < queue.length && !found; qi++) {
      for (const nb of adj.get(queue[qi]) ?? []) {
        if (have.has(nb) || prev.has(nb)) continue
        prev.set(nb, queue[qi])
        if (nb === n.id) { found = true; break }
        queue.push(nb)
      }
    }
    const path: number[] = []
    if (found) for (let id: number | undefined = n.id; id != null && !have.has(id); id = prev.get(id)) path.unshift(id)
    else path.push(n.id)
    for (const id of path) {
      have.add(id)
      out.push({ id, name: id === n.id ? n.name : (byId.get(id)?.[6] ?? n.name) })
    }
  }
  return out
}

export interface NextAscendancy {
  lab: LabDifficulty
  // the 2 points this lab gives (fewer when the tree has no more)
  picks: AscNode[]
  // the points after those
  later: AscNode[]
}
// The next lab (after `done` of them) and the 2 points it gives; null when all 4
// are done. When the game log shows some of the build's ascendancy passives taken
// (`taken`: lower-case names), the next 2 not taken are the picks; else the labs
// count says how far along the list you are.
export function nextAscendancy (points: AscNode[], done: number, taken?: Set<string>): NextAscendancy | null {
  if (done < 0 || done >= LAB_ORDER.length) return null
  const isTaken = (n: AscNode) => taken?.has(n.name.trim().toLowerCase()) === true
  const rest = points.some(isTaken) ? points.filter(n => !isTaken(n)) : points.slice(done * 2)
  return { lab: LAB_ORDER[done], picks: rest.slice(0, 2), later: rest.slice(2) }
}
