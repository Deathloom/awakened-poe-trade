// Deathloom fork (Gerhard 17 Nov 2026): the passive and atlas tree maps no longer
// follow allocations by themselves (27 Nov 2026: nor start from them). You step along the build's order with
// back / forward buttons (1 or 5 passives). Pure logic (unit tested).

export function clampStep (pos: number, delta: number, len: number): number {
  return Math.max(0, Math.min(len, Math.round(pos) + delta))
}

// a short stable key for a build's order (FNV-1a over the ids)
export function orderKey (prefix: string, ids: number[]): string {
  let h = 0x811c9dc5
  for (const id of ids) {
    h ^= id & 0xffff; h = Math.imul(h, 0x01000193)
    h ^= id >>> 16; h = Math.imul(h, 0x01000193)
  }
  return `${prefix}:${ids.length}:${(h >>> 0).toString(36)}`
}
