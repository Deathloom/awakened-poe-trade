// Deathloom fork (Q6): price alerts ("tell me when X goes above / below Y").
// Checked in main whenever the shared poe.ninja price list is downloaded again
// (proxy.ts, 10-minute cache): no extra requests to poe.ninja. Fired alerts go to
// every open Orbhoarder window and to a paired phone over the existing link.
// Pure logic only (no Electron, no Vue), tested in tests/logic.test.mjs.

export type PriceAlertDir = 'above' | 'below'
export type PriceAlertUnit = 'chaos' | 'div'

// What the PC sends to add an alert
export interface PriceAlertInput {
  league: string
  // poe.ninja overview type the price came from ("Currency", "UniqueWeapon", …)
  type: string
  name: string
  variant?: string
  // shown to the player
  label: string
  dir: PriceAlertDir
  value: number
  unit: PriceAlertUnit
}

export interface PriceAlertRule extends PriceAlertInput {
  id: string
  createdAt: number
  // false after it fired, true again once the price went back past the line.
  // Missing until the first price is seen (an alert never fires for a price
  // that was already past the line when it was made).
  armed?: boolean
  firedAt?: number
  // last price seen, in the alert's unit
  last?: number
}

export interface PriceAlertFired {
  id: string
  ruleId: string
  league: string
  label: string
  dir: PriceAlertDir
  value: number
  unit: PriceAlertUnit
  // price that crossed the line, in the alert's unit, and in chaos
  price: number
  chaos: number
  at: number
}

export interface PriceAlertState {
  rules: PriceAlertRule[]
  // newest first
  fired: PriceAlertFired[]
  // Windows notification on this PC also when a phone got the alert
  pcAlways: boolean
}

export const MAX_PRICE_ALERTS = 50
export const MAX_FIRED_KEPT = 20
// an alert fires at most once an hour, even if the price jumps around the line
export const PRICE_ALERT_COOLDOWN_MS = 60 * 60 * 1000
// it arms again only when the price is this far back past the line (3%)
export const PRICE_ALERT_REARM = 0.03
// a divine price below this is a broken list, not a real price (same as Prices.ts)
const MIN_DIVINE_CHAOS = 30

export function emptyAlertState (): PriceAlertState {
  return { rules: [], fired: [], pcAlways: false }
}

const TYPE_RE = /^[A-Za-z]{1,40}$/

function cleanText (v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  // no control characters (the label ends up in a Windows notification)
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  return (s && s.length <= max) ? s : null
}

// a new alert from the PC, checked field by field; error text for the player otherwise
export function validateAlertInput (input: unknown, existing: number): PriceAlertInput | string {
  if (existing >= MAX_PRICE_ALERTS) return `At most ${MAX_PRICE_ALERTS} price alerts: remove one first.`
  if (input == null || typeof input !== 'object') return 'No item picked.'
  const o = input as Record<string, unknown>
  const league = cleanText(o.league, 80)
  const name = cleanText(o.name, 200)
  const label = cleanText(o.label, 200)
  const type = typeof o.type === 'string' && TYPE_RE.test(o.type) ? o.type : null
  if (!league || !name || !label || !type) return 'This item has no poe.ninja price.'
  let variant: string | undefined
  if (o.variant != null && o.variant !== '') {
    const v = cleanText(o.variant, 200)
    if (!v) return 'This item has no poe.ninja price.'
    variant = v
  }
  if (o.dir !== 'above' && o.dir !== 'below') return 'Pick above or below.'
  if (o.unit !== 'chaos' && o.unit !== 'div') return 'Pick chaos or divine.'
  const value = typeof o.value === 'number' ? o.value : NaN
  if (!Number.isFinite(value) || value <= 0 || value > 1e7) return 'Type a price above 0.'
  return { league, type, name, variant, label, dir: o.dir, value, unit: o.unit }
}

// the same item, direction, price and unit is already an alert
export function isDuplicateAlert (rules: PriceAlertInput[], input: PriceAlertInput): boolean {
  return rules.some(r => r.league === input.league && r.type === input.type && r.name === input.name &&
    (r.variant ?? '') === (input.variant ?? '') && r.dir === input.dir && r.unit === input.unit && r.value === input.value)
}

// how long main waits for a phone to say it got the alert before the PC notifies anyway
export const PHONE_ACK_WAIT_MS = 8 * 1000

// Windows notification on this PC? Yes unless a phone confirmed it got the alert
// (a socket that looks connected may belong to a locked phone), or always when asked.
export function shouldNotifyPc (o: { pcAlways: boolean, phoneAcked: boolean }): boolean {
  return o.pcAlways || !o.phoneAcked
}

const ID_RE = /^[A-Za-z0-9_-]{1,60}$/

// ids a phone sends back when it got alerts ('ack'); anything else dropped
export function cleanAckIds (ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  return ids.slice(0, MAX_FIRED_KEPT).filter((x): x is string => typeof x === 'string' && ID_RE.test(x))
}

// `path` is the part after `/proxy/` of a poe.ninja price list download; the
// league it is for (PoE 1 only), else null
export function ninjaLeague (path: string): string | null {
  let url: URL
  try {
    url = new URL('https://' + path)
  } catch {
    return null
  }
  if (url.hostname !== 'poe.ninja') return null
  if (!/^\/(poe1\/)?api\/economy\/current\/dense\/overviews$/.test(url.pathname)) return null
  return url.searchParams.get('league') || null
}

const OVERVIEW = '{"type":"'

// chaos price of one item in poe.ninja's dense overview list (the same lookup the
// price check does: name + variant inside that item type's section), else null
export function ninjaChaos (blob: string, type: string, name: string, variant?: string): number | null {
  const section = OVERVIEW + type + '"'
  // NOTE: same key order as poe.ninja (and Prices.ts findPriceByQuery)
  const search = JSON.stringify({ name, variant, chaos: 0 }).replace(':0}', ':')
  let start = blob.indexOf(section)
  while (start !== -1) {
    const end = blob.indexOf(OVERVIEW, start + 1)
    const at = blob.indexOf(search, start)
    if (at !== -1 && (end === -1 || at < end)) {
      const m = /^-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/.exec(blob.slice(at + search.length, at + search.length + 32))
      const chaos = m ? Number(m[0]) : NaN
      return Number.isFinite(chaos) ? chaos : null
    }
    start = blob.indexOf(section, start + 1)
  }
  return null
}

export function ninjaDivine (blob: string): number | null {
  const chaos = ninjaChaos(blob, 'Currency', 'Divine Orb')
  return chaos != null && chaos >= MIN_DIVINE_CHAOS ? chaos : null
}

function crossed (dir: PriceAlertDir, price: number, value: number): boolean {
  return dir === 'above' ? price >= value : price <= value
}

function backPast (dir: PriceAlertDir, price: number, value: number): boolean {
  return dir === 'above' ? price < value * (1 - PRICE_ALERT_REARM) : price > value * (1 + PRICE_ALERT_REARM)
}

// One rule against a new price (in the rule's unit). Fires once per crossing:
// - the first price seen only sets whether it is armed (no alert for a price that
//   was already past the line when the alert was made);
// - armed + past the line = fire, then disarmed;
// - it arms again once the price is 3% back on the other side, and fires again
//   at most once an hour.
export function stepRule (rule: PriceAlertRule, price: number | null, now: number): { rule: PriceAlertRule, fire: boolean } {
  if (price == null || !Number.isFinite(price)) return { rule, fire: false }
  const past = crossed(rule.dir, price, rule.value)
  if (rule.armed === undefined) {
    return { rule: { ...rule, armed: !past, last: price }, fire: false }
  }
  if (rule.armed && past) {
    if (rule.firedAt != null && now - rule.firedAt < PRICE_ALERT_COOLDOWN_MS) {
      return { rule: { ...rule, last: price }, fire: false }
    }
    return { rule: { ...rule, armed: false, firedAt: now, last: price }, fire: true }
  }
  if (!rule.armed && backPast(rule.dir, price, rule.value)) {
    return { rule: { ...rule, armed: true, last: price }, fire: false }
  }
  return { rule: { ...rule, last: price }, fire: false }
}

// Check every alert of this league against a freshly downloaded price list
export function checkAlerts (
  state: PriceAlertState,
  blob: string,
  league: string,
  now: number
): { state: PriceAlertState, fired: PriceAlertFired[], changed: boolean } {
  const mine = state.rules.filter(r => r.league === league)
  if (!mine.length) return { state, fired: [], changed: false }
  const divine = ninjaDivine(blob)
  const fired: PriceAlertFired[] = []
  let changed = false
  const rules = state.rules.map(rule => {
    if (rule.league !== league) return rule
    const chaos = ninjaChaos(blob, rule.type, rule.name, rule.variant)
    let price: number | null = null
    if (chaos != null) price = rule.unit === 'div' ? (divine ? chaos / divine : null) : chaos
    const step = stepRule(rule, price, now)
    if (step.rule !== rule) changed = true
    if (step.fire && price != null && chaos != null) {
      fired.push({
        id: `${rule.id}-${now}`,
        ruleId: rule.id,
        league: rule.league,
        label: rule.label,
        dir: rule.dir,
        value: rule.value,
        unit: rule.unit,
        price,
        chaos,
        at: now
      })
    }
    return step.rule
  })
  if (!changed) return { state, fired, changed }
  return {
    state: { ...state, rules, fired: [...[...fired].reverse(), ...state.fired].slice(0, MAX_FIRED_KEPT) },
    fired,
    changed
  }
}

export function fmtAlertPrice (n: number): string {
  if (n >= 100) return String(Math.round(n))
  return String(Math.round(n * 10) / 10)
}

export function unitLabel (unit: PriceAlertUnit): string {
  return unit === 'div' ? 'div' : 'c'
}

// "Mageblood is above 150 div (now 152 div)"
export function alertText (f: Pick<PriceAlertFired, 'label' | 'dir' | 'value' | 'unit' | 'price'>): string {
  const u = unitLabel(f.unit)
  return `${f.label} is ${f.dir} ${fmtAlertPrice(f.value)} ${u} (now ${fmtAlertPrice(f.price)} ${u})`
}

// "above 150 div"
export function ruleText (r: Pick<PriceAlertRule, 'dir' | 'value' | 'unit'>): string {
  return `${r.dir} ${fmtAlertPrice(r.value)} ${unitLabel(r.unit)}`
}

// state read back from the file: anything broken is dropped, not trusted
export function readAlertState (raw: unknown): PriceAlertState {
  const out = emptyAlertState()
  if (raw == null || typeof raw !== 'object') return out
  const o = raw as Record<string, unknown>
  out.pcAlways = o.pcAlways === true
  if (Array.isArray(o.rules)) {
    for (const r of o.rules.slice(0, MAX_PRICE_ALERTS)) {
      const input = validateAlertInput(r, 0)
      if (typeof input === 'string') continue
      const x = r as Record<string, unknown>
      if (typeof x.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(x.id)) continue
      if (isDuplicateAlert(out.rules, input)) continue
      out.rules.push({
        ...input,
        id: x.id,
        createdAt: typeof x.createdAt === 'number' ? x.createdAt : 0,
        armed: typeof x.armed === 'boolean' ? x.armed : undefined,
        firedAt: typeof x.firedAt === 'number' ? x.firedAt : undefined,
        last: typeof x.last === 'number' ? x.last : undefined
      })
    }
  }
  if (Array.isArray(o.fired)) {
    for (const f of o.fired.slice(0, MAX_FIRED_KEPT)) {
      if (f == null || typeof f !== 'object') continue
      const x = f as Record<string, unknown>
      const label = cleanText(x.label, 200)
      const league = cleanText(x.league, 80)
      const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
      if (typeof x.id !== 'string' || !ID_RE.test(x.id) || typeof x.ruleId !== 'string' || !ID_RE.test(x.ruleId) || !label ||
        !league || (x.dir !== 'above' && x.dir !== 'below') || (x.unit !== 'chaos' && x.unit !== 'div') ||
        !num(x.value) || !num(x.price) || !num(x.chaos) || !num(x.at)) continue
      out.fired.push({ id: x.id, ruleId: x.ruleId, league, label, dir: x.dir, value: x.value as number, unit: x.unit, price: x.price as number, chaos: x.chaos as number, at: x.at as number })
    }
  }
  return out
}
