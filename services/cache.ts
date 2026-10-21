/**
 * TerraData Multi-layer Cache Service
 * 
 * Provides:
 * 1. Ultra-fast in-memory cache for 0ms lookups during navigation.
 * 2. Persistent localStorage cache across sessions with TTL (Time To Live).
 * 3. In-flight request deduplication (prevents redundant concurrent calls).
 * 4. Automatic quota management and cleanup of expired entries.
 * 5. Coordinate normalization for GPS / Geolocation hits.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const MEMORY_CACHE = new Map<string, CacheEntry<any>>();
const IN_FLIGHT_REQUESTS = new Map<string, Promise<any>>();

const STORAGE_PREFIX = 'td_cache_v1_';
const MAX_MEMORY_ITEMS = 250;

export const CACHE_TTL = {
  WEATHER: 15 * 60 * 1000,          // 15 minutes (weather changes throughout day)
  AIR_QUALITY: 30 * 60 * 1000,      // 30 minutes
  CITY_SEARCH: 24 * 60 * 60 * 1000, // 24 hours (city names & coords don't change)
  CITY_SUMMARY: 24 * 60 * 60 * 1000,// 24 hours (Wikipedia summaries & skyline photos)
  POIS: 24 * 60 * 60 * 1000,        // 24 hours (monuments, museums, parks)
  NEARBY_CITIES: 24 * 60 * 60 * 1000,// 24 hours (neighboring municipalities)
  REVERSE_GEO: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Normalizes coordinates to 3 decimal places (~110m accuracy) to maximize cache hits.
 */
export function normalizeCoords(lat: number, lon: number): string {
  return `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
}

class CacheService {
  /**
   * Retrieves an item from memory or localStorage if not expired.
   */
  get<T>(key: string): T | null {
    const now = Date.now();

    // 1. Check in-memory cache first
    const memItem = MEMORY_CACHE.get(key);
    if (memItem) {
      if (memItem.expiresAt > now) {
        return memItem.value as T;
      }
      MEMORY_CACHE.delete(key);
    }

    // 2. Check localStorage
    if (typeof window === 'undefined') return null;

    try {
      const storageKey = STORAGE_PREFIX + key;
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      if (entry && entry.expiresAt > now) {
        // Hydrate memory cache
        MEMORY_CACHE.set(key, entry);
        return entry.value;
      }

      // Expired: remove
      localStorage.removeItem(storageKey);
    } catch {
      // Storage parsing or access error
    }

    return null;
  }

  /**
   * Stores an item in memory and localStorage with a given TTL.
   */
  set<T>(key: string, value: T, ttlMs: number): void {
    if (value === null || value === undefined) return;

    const expiresAt = Date.now() + ttlMs;
    const entry: CacheEntry<T> = { value, expiresAt };

    // Evict oldest memory items if capacity exceeded
    if (MEMORY_CACHE.size >= MAX_MEMORY_ITEMS) {
      const firstKey = MEMORY_CACHE.keys().next().value;
      if (firstKey) MEMORY_CACHE.delete(firstKey);
    }

    MEMORY_CACHE.set(key, entry);

    if (typeof window === 'undefined') return;

    try {
      const storageKey = STORAGE_PREFIX + key;
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch {
      // Quota exceeded: prune expired entries and retry once
      this.pruneExpired();
      try {
        const storageKey = STORAGE_PREFIX + key;
        localStorage.setItem(storageKey, JSON.stringify(entry));
      } catch {
        // If still failing, keep in memory only
      }
    }
  }

  /**
   * Wraps an async fetcher with caching and in-flight request deduplication.
   */
  async fetchWithCache<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>,
    validator?: (data: T) => boolean
  ): Promise<T> {
    // 1. Cache hit?
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // 2. In-flight deduplication: if same key is already being requested, share the promise
    if (IN_FLIGHT_REQUESTS.has(key)) {
      return IN_FLIGHT_REQUESTS.get(key) as Promise<T>;
    }

    const promise = (async () => {
      try {
        const result = await fetcher();
        const isValid = validator ? validator(result) : Boolean(result);
        if (isValid) {
          this.set(key, result, ttlMs);
        }
        return result;
      } finally {
        IN_FLIGHT_REQUESTS.delete(key);
      }
    })();

    IN_FLIGHT_REQUESTS.set(key, promise);
    return promise;
  }

  /**
   * Prunes expired entries from localStorage to maintain healthy storage limits.
   */
  pruneExpired(): void {
    if (typeof window === 'undefined') return;
    try {
      const now = Date.now();
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              const entry = JSON.parse(raw);
              if (!entry.expiresAt || entry.expiresAt <= now) {
                keysToRemove.push(k);
              }
            }
          } catch {
            keysToRemove.push(k);
          }
        }
      }

      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Clears all TerraData cache entries.
   */
  clearAll(): void {
    MEMORY_CACHE.clear();
    IN_FLIGHT_REQUESTS.clear();

    if (typeof window === 'undefined') return;
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {
      // Ignore
    }
  }
}

export const Cache = new CacheService();
