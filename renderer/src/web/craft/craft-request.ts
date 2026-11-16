// Deathloom fork (Gerhard, 16 Nov 2026): "Craft this" from the build gear panel.
// The gear panel saves the item here and opens the Craft tab; the crafting
// simulator picks it up (same window: a DOM event; other windows: storage event).

import { Host } from '@/web/background/IPC'
import type { PobGearItem } from '@ipc/types'

export const CRAFT_REQUEST_KEY = 'deathloom.craft-request.v1'
export const CRAFT_REQUEST_EVENT = 'deathloom-craft-request'

export interface CraftRequest {
  at: number
  name: string
  baseName: string
  itemLevel?: number
  mods: Array<{ text: string, kind: string, crafted?: boolean }>
}

export function requestCraft (item: PobGearItem) {
  const req: CraftRequest = {
    at: Date.now(),
    name: item.title || item.name,
    baseName: item.baseName,
    itemLevel: item.itemLevel,
    mods: item.mods.map(m => ({ text: m.text, kind: m.kind, crafted: m.crafted }))
  }
  try {
    localStorage.setItem(CRAFT_REQUEST_KEY, JSON.stringify(req))
    localStorage.setItem('deathloom.craft-tab.v1', 'craft')
  } catch {}
  window.dispatchEvent(new CustomEvent(CRAFT_REQUEST_EVENT))
  Host.sendEvent({ name: 'CLIENT->MAIN::user-action', payload: { action: 'open-window-view', view: 'craft' } })
}

export function loadCraftRequest (): CraftRequest | null {
  try {
    const r = JSON.parse(localStorage.getItem(CRAFT_REQUEST_KEY) ?? 'null')
    return r && typeof r.baseName === 'string' && Array.isArray(r.mods) ? r as CraftRequest : null
  } catch { return null }
}
export function clearCraftRequest () {
  try { localStorage.removeItem(CRAFT_REQUEST_KEY) } catch {}
}
