// Deathloom fork: trade companion entries and the sales ledger (kept in the
// overlay's local storage; per viewer, can be wiped by clearing app data).

export interface TradeEntry {
  id: string
  at: number
  direction: 'from' | 'to'
  char: string
  item: string
  price: string
  league: string
  tab?: { name: string, left: number, top: number }
  message?: string
  done?: boolean
}

const KEY = 'deathloom.trade-ledger.v1'

export function loadLedger (): TradeEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveLedger (list: TradeEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {}
}

// "5 chaos", "1.5 divine", "10 exalted" -> totals[currency] += amount
export function addPrice (totals: Record<string, number>, price: string) {
  const m = price.trim().match(/^([\d.,]+)\s+(.+)$/)
  if (!m) return
  const amount = Number(m[1].replace(',', '.'))
  if (!Number.isFinite(amount)) return
  const cur = m[2].trim()
  totals[cur] = (totals[cur] ?? 0) + amount
}

// Deathloom fork: several windows can show the trade companion (overlay or HUD,
// and the desktop window), and each sees "Trade accepted." in Client.txt.
// Append to the newest stored list and skip a trade another window already logged.
export function appendToLedger (entry: TradeEntry): TradeEntry[] {
  const list = loadLedger()
  const dup = list.some(e => e.direction === entry.direction && e.char === entry.char &&
    e.item === entry.item && e.price === entry.price && Math.abs(e.at - entry.at) < 2 * 60_000)
  const next = dup ? list : [...list, entry].slice(-2000)
  if (!dup) saveLedger(next)
  return next
}

export function onLedgerChange (cb: (list: TradeEntry[]) => void): () => void {
  const handler = (e: StorageEvent) => { if (e.key === KEY) cb(loadLedger()) }
  window.addEventListener('storage', handler)
  return () => { window.removeEventListener('storage', handler) }
}
