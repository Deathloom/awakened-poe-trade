// Deathloom fork: the last levelling plan (PobNext asks PoB for it), shared with
// the tree map in the same window so it can show and zoom to the next passives.
import { shallowRef } from 'vue'
import type { PobPlan } from '@ipc/types'

export const currentPlan = shallowRef<PobPlan | null>(null)
