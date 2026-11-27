// Deathloom fork (Q28): spoken callouts settings (localStorage, shared by every
// window on this PC) and the speaker. Only the overlay window speaks (it
// registers itself with enableSpeaker), so a callout is heard once even with the
// Orbhoarder window open too. Phones never speak.

import { shallowRef } from 'vue'
import {
  readCalloutSettings, pickVoice, sayable, CalloutGate, CALLOUTS_KEY,
  type CalloutKind, type CalloutSettings
} from './callouts'
import { IS_OTHER_DEVICE } from '@/web/market-history/price-alerts-store'
import { Host } from '@/web/background/IPC'

function load (): CalloutSettings {
  try { return readCalloutSettings(JSON.parse(localStorage.getItem(CALLOUTS_KEY) ?? 'null')) } catch { return readCalloutSettings(null) }
}

export const calloutSettings = shallowRef<CalloutSettings>(load())

try {
  window.addEventListener('storage', (e) => { if (e.key === CALLOUTS_KEY) calloutSettings.value = load() })
} catch {}

export function setCalloutSettings (patch: Partial<CalloutSettings>) {
  calloutSettings.value = readCalloutSettings({ ...calloutSettings.value, ...patch })
  try { localStorage.setItem(CALLOUTS_KEY, JSON.stringify(calloutSettings.value)) } catch {}
}

export function canSpeak (): boolean {
  return !IS_OTHER_DEVICE && typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function localVoices (): SpeechSynthesisVoice[] {
  if (!canSpeak()) return []
  return window.speechSynthesis.getVoices().filter(v => v.localService)
}

// speak now, with the saved voice / speed / volume (Test button, and callouts)
export function speakNow (text: string, s = calloutSettings.value): boolean {
  if (!canSpeak()) return false
  const words = sayable(text)
  if (!words) return false
  const voice = pickVoice(window.speechSynthesis.getVoices(), s.voice)
  // no voice on this PC: say nothing rather than risk a network voice
  if (!voice) return false
  const u = new SpeechSynthesisUtterance(words)
  u.voice = voice
  u.lang = voice.lang
  u.rate = s.rate
  u.volume = s.volume
  window.speechSynthesis.speak(u)
  return true
}

let speaker = false
const gate = new CalloutGate()

export function enableSpeaker () {
  // the real overlay only (not the same page opened in a browser)
  speaker = canSpeak() && Host.isElectron
}

export function callout (kind: CalloutKind, text: string | null) {
  if (!speaker || !text) return
  const s = calloutSettings.value
  if (!s.on || !s.kinds[kind]) return
  if (!gate.allow(text, Date.now())) return
  speakNow(text, s)
}
