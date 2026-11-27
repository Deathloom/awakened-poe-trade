import type { RateLimiter } from "./RateLimiter";
// Deathloom fork (S4): object-hash is gone; same canonical-JSON key as the PoE1 cache
import { cacheKey } from "@/web/price-check/trade/Cache";

const CACHE_TTL = 300;

export class Cache {
  private cached = new Map<string, unknown>();
  private currency = "";

  get<T = unknown>(key: unknown): T | undefined {
    const _key = cacheKey(key);
    return this.cached.get(_key) as T | undefined;
  }

  set<T = unknown>(key: unknown, value: T, ttl: number): void {
    const _key = cacheKey(key);
    this.cached.set(_key, value);

    setTimeout(() => {
      this.cached.delete(_key);
    }, ttl * 1000);
  }

  purgeIfDifferentCurrency(currency: string | undefined) {
    if (!currency || this.currency === currency) return;
    this.currency = currency;
    this.cached.clear();
  }

  static deriveTtl(...limits: RateLimiter[]): number {
    return limits.length ? CACHE_TTL : 0;
  }
}
