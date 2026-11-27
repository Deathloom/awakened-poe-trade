// Deathloom fork: the last levelling plan (PobNext asks PoB for it), shared with
// the tree map in the same window so it can show and zoom to the next passives.
import { computed, shallowRef } from 'vue'
import type { PobPlan, PobTreeMapLayout } from '@ipc/types'
import { getStep, moveStep } from './tree-steps'
import { orderKey } from './tree-step-logic'

export const currentPlan = shallowRef<PobPlan | null>(null)

// Deathloom fork (Gerhard 27 Nov 2026: no automatic tree tracking anywhere):
// where you are along the plan's order is only ever set by the back / forward
// buttons (or "Jump to my level", pressed by hand). Nothing follows the game
// log, your level or the tree map by itself. Every panel (Next steps, tree map,
// Build progress) reads this one step, so they always agree.
export const planStep = computed(() => {
  const p = currentPlan.value
  if (!p) return null
  const key = orderKey('tree', [...(Array.isArray(p.keptIds) ? p.keptIds : []), -1, ...p.order.map(n => n.id)])
  const len = p.order.length
  const pos = Math.min(getStep(key) ?? 0, len)
  return { key, len, pos, byLevel: Math.min(len, Math.max(0, p.taken ?? 0)) }
})
export function stepPlan (delta: number) {
  const st = planStep.value
  if (st) moveStep(st.key, st.pos, delta, st.len)
}
// pressed by hand: move once to where your level and quest points say you are
export function jumpPlanToLevel () {
  const st = planStep.value
  if (st) moveStep(st.key, 0, st.byLevel, st.len)
}

// Deathloom fork: the passive tree layout (links between passives), loaded by the
// tree map; the Next tab uses it to place taken passives along connected paths
export const treeLayout = shallowRef<PobTreeMapLayout | null>(null)
