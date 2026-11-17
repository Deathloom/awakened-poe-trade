// Deathloom fork: where you are along each build's passive / atlas order (set by
// the back / forward buttons on the tree maps). Kept in localStorage so every
// panel and window shows the same step; other windows follow via 'storage'.
import { shallowRef } from 'vue'
import { clampStep } from './tree-step-logic'

const KEY = 'deathloom.tree-steps.v1'
function read (): Record<string, number> {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}
export const treeSteps = shallowRef<Record<string, number>>(read())
try {
  window.addEventListener('storage', (e) => { if (e.key === KEY) treeSteps.value = read() })
} catch {}

export function getStep (key: string): number | undefined {
  const v = treeSteps.value[key]
  return typeof v === 'number' ? v : undefined
}
export function setStep (key: string, pos: number) {
  // keep the store small: last 40 builds (newest last)
  const entries = Object.entries(treeSteps.value).filter(([k]) => k !== key)
  entries.push([key, pos])
  const next = Object.fromEntries(entries.slice(-40))
  treeSteps.value = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
}
export function moveStep (key: string, from: number, delta: number, len: number): number {
  const pos = clampStep(from, delta, len)
  setStep(key, pos)
  return pos
}
