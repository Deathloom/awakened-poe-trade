// Deathloom fork (Q28): spoken callouts. Pure logic (settings, what to say, how
// often). Speaking itself is the OS's own voices through speechSynthesis
// (callouts-store.ts); only voices installed on this PC are used. Nothing here
// reads the game or sends anything to it: callouts react to events Orbhoarder
// already has (Client.txt trade whispers, price alerts, a map you price check,
// the crash and slowness watch).

export type CalloutKind = 'whisper' | 'priceAlert' | 'map' | 'health'

export interface CalloutSettings {
  on: boolean
  // voice name ('' = the system default)
  voice: string
  // 0.5 – 2
  rate: number
  // 0 – 1
  volume: number
  kinds: Record<CalloutKind, boolean>
}

export const CALLOUT_KINDS: Array<{ k: CalloutKind, label: string, help: string }> = [
  { k: 'whisper', label: 'Trade whispers', help: 'Someone wants to buy: item and price.' },
  { k: 'priceAlert', label: 'Price alerts', help: 'One of your price alerts fired.' },
  { k: 'map', label: 'Map warnings', help: 'A map you check has mods that are bad for your build.' },
  { k: 'health', label: 'Path of Building problems', help: 'PoB crashed, timed out or is very slow.' }
]

export const CALLOUTS_KEY = 'deathloom.callouts.v1'
// the same words again within this long are not repeated
export const SAME_TEXT_GAP_MS = 30_000
// at most one callout in this long (more are dropped, not queued)
export const ANY_GAP_MS = 3_000
export const MAX_CALLOUT_CHARS = 120

export function defaultCalloutSettings (): CalloutSettings {
  return { on: false, voice: '', rate: 1, volume: 0.8, kinds: { whisper: true, priceAlert: true, map: true, health: true } }
}

function clamp (n: unknown, lo: number, hi: number, dflt: number): number {
  const v = Number(n)
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt
}

export function readCalloutSettings (raw: unknown): CalloutSettings {
  const d = defaultCalloutSettings()
  if (raw == null || typeof raw !== 'object') return d
  const r = raw as Record<string, unknown>
  const kinds = (r.kinds != null && typeof r.kinds === 'object') ? r.kinds as Record<string, unknown> : {}
  return {
    on: r.on === true,
    voice: typeof r.voice === 'string' ? r.voice.slice(0, 200) : '',
    rate: clamp(r.rate, 0.5, 2, d.rate),
    volume: clamp(r.volume, 0, 1, d.volume),
    kinds: {
      whisper: kinds.whisper !== false,
      priceAlert: kinds.priceAlert !== false,
      map: kinds.map !== false,
      health: kinds.health !== false
    }
  }
}

// What the voice may say: letters, digits and plain punctuation, short. Whispers
// are other players' text, so anything odd is dropped.
export function sayable (text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N} .,:;'!?%+\-/()]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CALLOUT_CHARS)
}

const CURRENCY_WORDS: Record<string, string> = {
  chaos: 'chaos', divine: 'divine', div: 'divine', exalted: 'exalted', exa: 'exalted', mirror: 'mirror'
}

// "5 divine" from "5 divine", "5 div", "5.5 chaos"
function priceWords (price: string): string {
  const m = /^\s*([\d.,]+)\s+(\S+)/.exec(price)
  if (!m) return price
  const unit = CURRENCY_WORDS[m[2].toLowerCase()] ?? m[2]
  return `${m[1]} ${unit}`
}

export function whisperCallout (e: { direction: 'from' | 'to', item: string, price: string }): string | null {
  if (e.direction !== 'from') return null
  const text = sayable(`Trade: ${e.item}${e.price ? `, for ${priceWords(e.price)}` : ''}`)
  return text.length > 'Trade:'.length ? text : null
}

export function priceAlertCallout (f: { label: string, dir: string, value: number, unit: string }): string {
  const unit = f.unit === 'div' ? 'divine' : f.unit
  return sayable(`Price alert: ${f.label} is ${f.dir} ${f.value} ${unit}`)
}

export function mapCallout (bad: number): string | null {
  if (bad <= 0) return null
  return bad === 1 ? 'Careful: one map mod is bad for your build' : `Careful: ${bad} map mods are bad for your build`
}

export function healthCallout (text: string): string {
  return sayable(text)
}

// says yes at most once per ANY_GAP_MS and not the same words within SAME_TEXT_GAP_MS
export class CalloutGate {
  private lastAny = -Infinity
  private lastText = new Map<string, number>()

  allow (text: string, now: number): boolean {
    if (!text) return false
    if (now - this.lastAny < ANY_GAP_MS) return false
    const prev = this.lastText.get(text)
    if (prev != null && now - prev < SAME_TEXT_GAP_MS) return false
    this.lastAny = now
    this.lastText.set(text, now)
    if (this.lastText.size > 50) {
      for (const [k, at] of this.lastText) if (now - at >= SAME_TEXT_GAP_MS) this.lastText.delete(k)
    }
    return true
  }
}

// only voices on this PC (a network voice would send the words somewhere)
export function pickVoice<V extends { name: string, localService: boolean, default: boolean }> (voices: V[], name: string): V | null {
  const local = voices.filter(v => v.localService)
  return local.find(v => v.name === name) ?? local.find(v => v.default) ?? local[0] ?? null
}
