// Deathloom fork (19 Nov 2026): a panel hotkey pressed in game shows only that panel.
// Main activates the overlay for it (the panel needs clicks), and an active overlay
// normally shows every open panel plus the menu bar, like Shift+Space. wm.solo()
// limits it to this panel until the overlay closes (Esc, click the game, hotkey again).
import type { WidgetManager } from './interfaces'

export function toggleFromHotkey (wm: WidgetManager, wmId: number, wants: 'show' | 'hide') {
  if (!wm.active.value) {
    wm.show(wmId)
    wm.solo(wmId)
  } else if (wants === 'hide') {
    wm.show(wmId)
  } else {
    wm.hide(wmId)
  }
}
