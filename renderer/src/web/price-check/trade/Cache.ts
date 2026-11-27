import type { RateLimiter } from './RateLimiter'

const CACHE_TTL = 300

// Deathloom fork (S4): the key is the request as canonical JSON (object keys
// sorted, like object-hash did) instead of an object-hash SHA-1, which pulled
// 33 kB into the main bundle for this one cache. A full string can't collide,
// and the keys are small search bodies or id lists.
export function cacheKey (key: unknown): string {
  return JSON.stringify(key, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(v).sort()) sorted[k] = (v as Record<string, unknown>)[k]
      return sorted
    }
    return v
  }) ?? 'undefined'
}

export class Cache {
  private cached = new Map<string, unknown>()

  get<T = unknown> (key: unknown): T | undefined {
    return this.cached.get(cacheKey(key)) as T | undefined
  }

  set<T = unknown> (key: unknown, value: T, ttl: number): void {
    const _key = cacheKey(key)
    this.cached.set(_key, value)

    setTimeout(() => {
      this.cached.delete(_key)
    }, ttl * 1000)
  }

  static deriveTtl (...limits: RateLimiter[]): number {
    return (limits.length) ? CACHE_TTL : 0
  }
}
