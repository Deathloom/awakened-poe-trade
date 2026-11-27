// Deathloom fork (27 Nov 2026, Q27): first-run tour of the Orbhoarder window.
// Only this small file is in the main bundle; the tour itself (OnboardingTour.vue)
// is its own chunk, loaded the first time it opens.
import { ref } from 'vue'

export const TOUR_KEY = 'deathloom.tour-seen.v1'
export const tourOpen = ref(false)

export function tourSeen (): boolean {
  try { return localStorage.getItem(TOUR_KEY) != null } catch { return true }
}

export function markTourSeen (): void {
  try { localStorage.setItem(TOUR_KEY, '1') } catch {}
}

// Call once when the window starts, before the setup guide can finish.
// New install (setup guide not done yet): the tour opens by itself once the guide
// closes. Existing installs never get it by itself (Settings → About → Take the tour).
export function autoTourWanted (setupDone: boolean | undefined): boolean {
  if (tourSeen()) return false
  if (setupDone) {
    markTourSeen()
    return false
  }
  return true
}
