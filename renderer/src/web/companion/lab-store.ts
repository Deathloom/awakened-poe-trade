// Deathloom fork (Q7): the Labyrinth hand ticks, shared by everything in this
// window (the desktop Levelling view shows the planner and the campaign guide
// side by side; `storage` events only reach the other windows).
import { shallowRef } from 'vue'
import { LAB_MANUAL_KEY, loadLabManual, saveLabManual, type LabManual } from './lab-helper'

export const labManualAll = shallowRef<Record<string, LabManual>>(loadLabManual())

// other windows (overlay, HUD) changed it
window.addEventListener('storage', (e) => {
  if (e.key === LAB_MANUAL_KEY) labManualAll.value = loadLabManual()
})

export function setLabManual (charName: string, m: LabManual) {
  // this character last (the store keeps the 20 most recently changed)
  const rest = Object.entries(labManualAll.value).filter(([k]) => k !== charName)
  const all = Object.fromEntries([...rest, [charName, m]]) as Record<string, LabManual>
  saveLabManual(all)
  labManualAll.value = Object.fromEntries(Object.entries(all).slice(-20))
}
