// Deathloom fork: customisable All tab in the Loot Goblin window.
// Columns of stacked panels; widths and heights are fractions. Saved per
// player in localStorage (each player has their own install).
import { ref, watch } from 'vue'
import type { PanelKey } from '@ipc/types'
import { inWindow } from './panels'

export type AllPanelId = 'gear' | 'guide' | 'trades' | 'market' | 'overview' | 'search' | 'tree' | 'atlas' | 'session' | 'board'

export interface AllPanelDef {
  id: AllPanelId
  label: string
  icon: string
  // panels with a "Loot Goblin window" toggle in Settings → Where panels show
  settingsKey?: PanelKey
}

// Trade site is left out on purpose: it is one live page (stays signed in and
// keeps its place), so it lives on its own tab. Atlas tree: not in the
// default layout (Edit layout → Add panel).
export const ALL_PANELS: AllPanelDef[] = [
  { id: 'gear', label: 'Build (gear, gems, tree)', icon: 'fa-hammer', settingsKey: 'gear' },
  { id: 'guide', label: 'Levelling guide', icon: 'fa-route', settingsKey: 'guide' },
  { id: 'tree', label: 'Tree map', icon: 'fa-project-diagram', settingsKey: 'tree' },
  { id: 'atlas', label: 'Atlas tree', icon: 'fa-globe', settingsKey: 'atlas' },
  { id: 'trades', label: 'Trade companion', icon: 'fa-handshake', settingsKey: 'trades' },
  { id: 'market', label: 'Market history', icon: 'fa-chart-line', settingsKey: 'market' },
  { id: 'overview', label: 'Market overview (poe.ninja)', icon: 'fa-coins', settingsKey: 'overview' },
  { id: 'search', label: 'Market search', icon: 'fa-search' },
  { id: 'board', label: "Friends' trade board", icon: 'fa-people-carry', settingsKey: 'board' },
  { id: 'session', label: 'This session', icon: 'fa-stopwatch', settingsKey: 'session' }
]
const IDS = new Set(ALL_PANELS.map(p => p.id))

export interface LayoutItem { id: AllPanelId, h: number }
export interface LayoutCol { w: number, items: LayoutItem[] }
export interface AllLayout { v: 1, cols: LayoutCol[] }

export const MAX_COLS = 5
const MIN = 0.06
const KEY = 'deathloom.all-layout.v1'

export function defaultLayout (): AllLayout {
  return {
    v: 1,
    cols: [
      { w: 0.34, items: [{ id: 'gear', h: 0.6 }, { id: 'trades', h: 0.2 }, { id: 'market', h: 0.2 }] },
      { w: 0.36, items: [{ id: 'guide', h: 1 }] },
      { w: 0.3, items: [{ id: 'tree', h: 0.65 }, { id: 'session', h: 0.35 }] }
    ]
  }
}

// sizes from the fixed layout (1.0.42–1.0.59), so nobody loses their resizing
function fromOldSplits (): AllLayout {
  const l = defaultLayout()
  const read = (k: string, n: number) => {
    try {
      const v = JSON.parse(localStorage.getItem(`deathloom.split.${k}.v1`) ?? 'null')
      return Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && x > 0) ? v as number[] : null
    } catch { return null }
  }
  const cols = read('all-cols', 3)
  const left = read('all-left', 3)
  const right = read('all-right-v2', 2)
  if (cols) l.cols.forEach((c, i) => { c.w = cols[i] })
  if (left) l.cols[0].items.forEach((it, i) => { it.h = left[i] })
  if (right) l.cols[2].items.forEach((it, i) => { it.h = right[i] })
  return l
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function valid (l: any): l is AllLayout {
  if (!l || l.v !== 1 || !Array.isArray(l.cols) || !l.cols.length || l.cols.length > MAX_COLS) return false
  const seen = new Set<string>()
  for (const c of l.cols) {
    if (typeof c?.w !== 'number' || !(c.w > 0) || !Array.isArray(c.items) || !c.items.length) return false
    for (const it of c.items) {
      if (!IDS.has(it?.id) || seen.has(it.id) || typeof it.h !== 'number' || !(it.h > 0)) return false
      seen.add(it.id)
    }
  }
  return true
}

function normalise (l: AllLayout) {
  l.cols = l.cols.filter(c => c.items.length)
  const tw = l.cols.reduce((a, c) => a + c.w, 0) || 1
  for (const c of l.cols) {
    c.w /= tw
    const th = c.items.reduce((a, it) => a + it.h, 0) || 1
    for (const it of c.items) it.h /= th
  }
}

function load (): AllLayout {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (valid(saved)) { normalise(saved); return saved }
  } catch {}
  return fromOldSplits()
}

export const layout = ref<AllLayout>(load())

export function saveLayout () {
  try { localStorage.setItem(KEY, JSON.stringify(layout.value)) } catch {}
}

export function resetLayout () {
  layout.value = defaultLayout()
  saveLayout()
}

export function panelDef (id: AllPanelId) {
  return ALL_PANELS.find(p => p.id === id)!
}

// switched off for the window in Settings → Where panels show
export function shownBySettings (id: AllPanelId) {
  const k = panelDef(id).settingsKey
  return k ? inWindow(k) : true
}

export function inLayout (id: AllPanelId) {
  return layout.value.cols.some(c => c.items.some(it => it.id === id))
}

function take (l: AllLayout, id: AllPanelId): LayoutItem | undefined {
  for (const c of l.cols) {
    const i = c.items.findIndex(it => it.id === id)
    if (i >= 0) return c.items.splice(i, 1)[0]
  }
}

export function removePanel (id: AllPanelId) {
  const l = layout.value
  take(l, id)
  if (!l.cols.some(c => c.items.length)) { resetLayout(); return }
  normalise(l)
  saveLayout()
}

// add to the column with the fewest panels (new panels get an even share)
export function addPanel (id: AllPanelId) {
  const l = layout.value
  if (inLayout(id)) return
  const col = l.cols.reduce((a, c) => c.items.length < a.items.length ? c : a, l.cols[0])
  col.items.push({ id, h: 1 / col.items.length })
  normalise(l)
  saveLayout()
}

// target: into column `col` before item index `index`, or a new column at `newCol`
export type DropTarget = { col: number, index: number } | { newCol: number }

export function movePanel (id: AllPanelId, to: DropTarget) {
  const l = layout.value
  // where the target sits once the panel is taken out of its old place
  let fromCol = -1
  let fromIdx = -1
  l.cols.forEach((c, ci) => { const i = c.items.findIndex(it => it.id === id); if (i >= 0) { fromCol = ci; fromIdx = i } })
  if (fromCol < 0) return
  if ('newCol' in to && l.cols.length >= MAX_COLS && l.cols[fromCol].items.length > 1) return
  const item = l.cols[fromCol].items.splice(fromIdx, 1)[0]
  if ('newCol' in to) {
    const emptied = !l.cols[fromCol].items.length
    let at = to.newCol
    if (emptied) { l.cols.splice(fromCol, 1); if (fromCol < at) at-- }
    l.cols.splice(at, 0, { w: 1 / (l.cols.length + 1), items: [{ id: item.id, h: 1 }] })
  } else {
    let { col, index } = to
    if (col === fromCol && fromIdx < index) index--
    const target = l.cols[col]
    item.h = target.items.length ? 1 / target.items.length : 1
    target.items.splice(index, 0, item)
  }
  normalise(l)
  saveLayout()
}

// resizing: move the line between two visible neighbours (fractions of the
// visible ones, so hidden panels keep their share for later)
export function resize (sizes: number[], i: number, j: number, deltaPx: number, totalPx: number, shown: number[]) {
  if (!totalPx) return
  const visible = shown.reduce((a, k) => a + sizes[k], 0)
  let d = deltaPx / totalPx * visible
  d = Math.max(MIN - sizes[i], Math.min(sizes[j] - MIN, d))
  sizes[i] += d
  sizes[j] -= d
}

// Settings → Where panels show → Loot Goblin window switched back on: put the
// panel back on the All tab if it was taken off
export function useSettingsSync () {
  for (const p of ALL_PANELS) {
    if (!p.settingsKey) continue
    const k = p.settingsKey
    watch(() => inWindow(k), (on, was) => { if (on && was === false && !inLayout(p.id)) addPanel(p.id) })
  }
}
