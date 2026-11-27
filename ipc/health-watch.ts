// Deathloom fork (Q26): crash and slowness watch. Pure logic shared by main
// (main/src/HealthWatch.ts keeps the samples in apt-data/health-watch.json) and the
// Settings → Tools → Speed and crashes. Everything stays on this PC: nothing here is sent anywhere.

export type HealthKind = 'pob-start' | 'pob-call' | 'pob-crash' | 'trade-search' | 'trade-fetch'

export interface HealthSample {
  k: HealthKind
  // how long it took (0 for a crash)
  ms: number
  ok: boolean
  // ms since epoch
  at: number
  // PoB command name ('load', 'impact', ...) or a short error
  what?: string
  // PoB didn't answer before its time limit
  timeout?: boolean
}

export interface HealthKindSummary {
  k: HealthKind
  count: number
  fails: number
  slow: number
  median: number
  p90: number
  max: number
  lastAt: number
}

export interface HealthHint {
  k: HealthKind
  level: 'warn' | 'info'
  text: string
  fix: string
}

export interface HealthState {
  samples: HealthSample[]
  warn: boolean
}

export const HEALTH_KINDS: HealthKind[] = ['pob-start', 'pob-call', 'pob-crash', 'trade-search', 'trade-fetch']
export const HEALTH_KEEP_MS = 7 * 24 * 3600_000
export const HEALTH_MAX_SAMPLES = 500
// at most one warning per kind in this long
export const HEALTH_WARN_GAP_MS = 30 * 60_000

const KIND_NAMES: Record<HealthKind, string> = {
  'pob-start': 'Path of Building start',
  'pob-call': 'Path of Building answers',
  'pob-crash': 'Path of Building crashes',
  'trade-search': 'Trade site search',
  'trade-fetch': 'Trade site listings'
}
export function healthKindName (k: HealthKind): string {
  return KIND_NAMES[k]
}

// slower than this counts as slow (PoB 'load' of a big build is allowed longer)
export function slowLimitMs (k: HealthKind, what?: string): number {
  switch (k) {
    case 'pob-start': return 40_000
    case 'pob-call': return what === 'load' ? 60_000 : 15_000
    case 'trade-search':
    case 'trade-fetch': return 6_000
    default: return Infinity
  }
}

export function isSlow (s: HealthSample): boolean {
  return s.ms >= slowLimitMs(s.k, s.what)
}

function isKind (k: unknown): k is HealthKind {
  return typeof k === 'string' && (HEALTH_KINDS as string[]).includes(k)
}

// A sample from a window: only known kinds, sane numbers, short text
export function cleanSample (raw: unknown, now: number): HealthSample | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isKind(r.k)) return null
  const ms = Number(r.ms)
  if (!Number.isFinite(ms) || ms < 0 || ms > 3600_000) return null
  const s: HealthSample = { k: r.k, ms: Math.round(ms), ok: r.ok === true, at: now }
  if (typeof r.what === 'string' && r.what) s.what = r.what.replace(/[^\w .:-]/g, '').slice(0, 40)
  if (r.timeout === true) s.timeout = true
  return s
}

// keep the last 7 days and at most HEALTH_MAX_SAMPLES
export function addSample (list: HealthSample[], s: HealthSample, now: number): HealthSample[] {
  const from = now - HEALTH_KEEP_MS
  const out = list.filter(x => x.at >= from)
  out.push(s)
  return out.length > HEALTH_MAX_SAMPLES ? out.slice(out.length - HEALTH_MAX_SAMPLES) : out
}

export function readHealthState (raw: unknown, now: number): HealthState {
  const r = (raw != null && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const samples: HealthSample[] = []
  if (Array.isArray(r.samples)) {
    for (const x of r.samples) {
      const at = Number((x as Record<string, unknown> | null)?.at)
      const s = cleanSample(x, at)
      if (s && Number.isFinite(at) && at >= now - HEALTH_KEEP_MS && at <= now + 60_000) samples.push(s)
    }
  }
  return { samples: samples.slice(-HEALTH_MAX_SAMPLES), warn: r.warn !== false }
}

function pct (sorted: number[], p: number): number {
  if (!sorted.length) return 0
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}

export function summarize (samples: HealthSample[]): HealthKindSummary[] {
  return HEALTH_KINDS.map(k => {
    const mine = samples.filter(s => s.k === k)
    const times = mine.filter(s => s.ok).map(s => s.ms).sort((a, b) => a - b)
    return {
      k,
      count: mine.length,
      fails: mine.filter(s => !s.ok).length,
      slow: mine.filter(isSlow).length,
      median: pct(times, 0.5),
      p90: pct(times, 0.9),
      max: times.length ? times[times.length - 1] : 0,
      lastAt: mine.reduce((m, s) => Math.max(m, s.at), 0)
    }
  })
}

export function secs (ms: number): string {
  return ms >= 10_000 ? `${Math.round(ms / 1000)} s` : `${(ms / 1000).toFixed(1)} s`
}

// What to tell the player about the last 7 days, worst first
export function healthHints (samples: HealthSample[]): HealthHint[] {
  const out: HealthHint[] = []
  const by = new Map(summarize(samples).map(s => [s.k, s]))
  const crash = by.get('pob-crash')!
  if (crash.count >= 2) {
    out.push({
      k: 'pob-crash',
      level: 'warn',
      text: `Path of Building crashed ${crash.count} times this week.`,
      fix: 'Settings → Path of Building: leave the PoB folder empty to use Orbhoarder\'s own copy, or check that your own PoB folder is complete. If it happens with one build only, open that build in PoB itself and look for a broken item or tree.'
    })
  }
  const start = by.get('pob-start')!
  if (start.count && start.median >= slowLimitMs('pob-start')) {
    out.push({
      k: 'pob-start',
      level: 'warn',
      text: `Path of Building takes ${secs(start.median)} to start (usually under 15 s).`,
      fix: 'Antivirus scanning PoB is the usual cause: add the PoB folder to Windows Security → Virus & threat protection → Exclusions. PoB on an SSD helps too.'
    })
  }
  const calls = samples.filter(s => s.k === 'pob-call')
  const timeouts = calls.filter(s => s.timeout).length
  if (timeouts >= 2) {
    out.push({
      k: 'pob-call',
      level: 'warn',
      text: `Path of Building didn't answer in time ${timeouts} times this week.`,
      fix: 'Close the PoB desktop app while playing (both use the CPU), and keep the build to the item sets and trees you use. Orbhoarder starts PoB again by itself.'
    })
  } else {
    const slowCalls = calls.filter(s => s.ok && isSlow(s))
    if (slowCalls.length >= 3 && slowCalls.length >= calls.length / 4) {
      out.push({
        k: 'pob-call',
        level: 'info',
        text: `${slowCalls.length} of ${calls.length} Path of Building answers were slow this week.`,
        fix: 'Big builds with many item sets, trees or loadouts take longer. Closing the PoB desktop app while playing frees the CPU.'
      })
    }
  }
  for (const k of ['trade-search', 'trade-fetch'] as const) {
    const t = by.get(k)!
    if (t.count >= 3 && t.median >= slowLimitMs(k)) {
      out.push({
        k,
        level: 'info',
        text: `The trade site took ${secs(t.median)} to answer (middle value).`,
        fix: 'That is the trade site or your connection, not Orbhoarder. Try pathofexile.com/trade in a browser; a VPN or a busy league start makes it slower.'
      })
    } else if (t.count >= 5 && t.fails >= t.count / 3) {
      out.push({
        k,
        level: 'info',
        text: `${t.fails} of ${t.count} trade site requests failed this week.`,
        fix: 'Often the trade site is down or rate-limiting. Check the trade site in a browser; waiting a minute between many price checks helps.'
      })
    }
  }
  return out
}

// A warning to show right away for this one sample (crash, PoB timeout, very slow),
// or null. The caller makes sure it shows at most once per kind per HEALTH_WARN_GAP_MS.
export function warnNow (s: HealthSample): { text: string, fix: string } | null {
  if (s.k === 'pob-crash') {
    return { text: 'Path of Building stopped unexpectedly.', fix: 'Orbhoarder starts it again on the next request. Settings → Tools has hints if it keeps happening.' }
  }
  if (s.k === 'pob-call' && s.timeout) {
    return { text: `Path of Building didn't answer in time${s.what ? ` (${s.what})` : ''}.`, fix: 'Close the PoB desktop app if it is open. Settings → Tools has more.' }
  }
  if (s.k === 'pob-start' && s.ok && isSlow(s)) {
    return { text: `Path of Building took ${secs(s.ms)} to start.`, fix: 'Antivirus is the usual cause. Settings → Tools shows how to fix it.' }
  }
  if (s.k === 'pob-call' && s.ok && s.ms >= 2 * slowLimitMs(s.k, s.what)) {
    return { text: `Path of Building took ${secs(s.ms)} to answer.`, fix: 'Settings → Tools has hints.' }
  }
  return null
}
