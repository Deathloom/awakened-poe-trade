// Deathloom fork: the last levelling plan (PobNext asks PoB for it), shared with
// the tree map in the same window so it can show and zoom to the next passives.
import { shallowRef } from 'vue'
import type { PobPlan } from '@ipc/types'

export const currentPlan = shallowRef<PobPlan | null>(null)

// Deathloom fork: plan.order indexes really taken, counted from the game log
// (null: not known, the plan's level-based guess is used). Set by the
// levelling planner; the tree map follows it so its "next" only moves once
// you've actually allocated the passive.
export const currentTaken = shallowRef<Set<number> | null>(null)
