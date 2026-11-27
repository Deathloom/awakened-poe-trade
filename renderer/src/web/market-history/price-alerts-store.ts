// Deathloom fork (Q6): price alerts as every window (and a paired phone) sees them.
// The alerts themselves live in main (ipc/price-alerts.ts, main/src/PriceAlerts.ts);
// this keeps a copy, and which fired alerts this device has dismissed (local only:
// dismissing on the phone doesn't touch the PC).

import { computed, ref, shallowRef } from 'vue'
import { createGlobalState } from '@vueuse/core'
import { Host } from '@/web/background/IPC'
import { emptyAlertState, type PriceAlertInput, type PriceAlertState, type PriceAlertFired } from '@ipc/price-alerts'
import { gameKey } from '../game-storage'

const DISMISSED_KEY = 'deathloom.price-alerts.dismissed.v1'
// fired alerts older than this aren't shown as new any more
const SHOW_FIRED_MS = 24 * 60 * 60 * 1000

// a phone or another PC (not this one): it can look, not change (request-guard.ts)
export const IS_OTHER_DEVICE = (() => {
  try {
    return !['localhost', '127.0.0.1', '[::1]', '::1'].includes(location.hostname)
  } catch { return false }
})()

function loadDismissed (): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(gameKey(DISMISSED_KEY)) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-100) : []
  } catch { return [] }
}

export const usePriceAlerts = createGlobalState(() => {
  const state = shallowRef<PriceAlertState>(emptyAlertState())
  const error = ref('')
  const dismissed = ref<string[]>(loadDismissed())
  const now = ref(Date.now())
  // clock for "x min ago": tick only while the window is shown, catch up when shown again
  setInterval(() => { if (!document.hidden) now.value = Date.now() }, 60_000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) now.value = Date.now() })

  Host.onEvent('MAIN->CLIENT::price-alerts', (e) => {
    const { error: err, ...rest } = e
    state.value = rest
    error.value = err ?? ''
  })
  Host.onEvent('MAIN->CLIENT::price-alert-fired', (e) => {
    now.value = Date.now()
    // a phone tells the PC it got them (else the PC shows a Windows notification)
    if (IS_OTHER_DEVICE) Host.sendEvent({ name: 'CLIENT->MAIN::price-alerts', payload: { op: 'ack', ids: e.fired.map(f => f.id) } })
  })
  Host.sendEvent({ name: 'CLIENT->MAIN::price-alerts', payload: { op: 'list' } })

  try {
    window.addEventListener('storage', (e) => { if (e.key === gameKey(DISMISSED_KEY)) dismissed.value = loadDismissed() })
  } catch {}

  function saveDismissed () {
    try { localStorage.setItem(gameKey(DISMISSED_KEY), JSON.stringify(dismissed.value.slice(-100))) } catch {}
  }

  const fresh = computed<PriceAlertFired[]>(() => state.value.fired.filter(f =>
    now.value - f.at < SHOW_FIRED_MS && !dismissed.value.includes(f.id)))

  function add (rule: PriceAlertInput) {
    error.value = ''
    Host.sendEvent({ name: 'CLIENT->MAIN::price-alerts', payload: { op: 'add', rule } })
  }
  function remove (id: string) {
    Host.sendEvent({ name: 'CLIENT->MAIN::price-alerts', payload: { op: 'remove', id } })
  }
  function clearFired () {
    Host.sendEvent({ name: 'CLIENT->MAIN::price-alerts', payload: { op: 'clear-fired' } })
  }
  function setPcAlways (on: boolean) {
    Host.sendEvent({ name: 'CLIENT->MAIN::price-alerts', payload: { op: 'settings', pcAlways: on } })
  }
  function dismiss (id: string) {
    dismissed.value = [...dismissed.value.filter(x => x !== id), id]
    saveDismissed()
  }
  function dismissAll () {
    dismissed.value = [...dismissed.value, ...fresh.value.map(f => f.id)]
    saveDismissed()
  }
  function rulesFor (league: string | undefined, type: string | undefined, name: string, variant?: string) {
    return state.value.rules.filter(r => r.league === league && r.name === name &&
      (r.variant ?? '') === (variant ?? '') && (!type || r.type === type))
  }

  return { state, error, fresh, add, remove, clearFired, setPcAlways, dismiss, dismissAll, rulesFor }
})
