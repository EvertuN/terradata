/**
 * Cloudflare Edge Cache Helper (caches.default)
 * 
 * Implements high-performance Edge caching with stale-while-revalidate support.
 * Canonicalizes URLs (coordinate rounding, lowercase queries, sorted params)
 * to maximize Cache HIT ratio across geographically distributed PoPs.
 */

export const EDGE_CACHE_CONTROL = {
  CITY: 'public, max-age=900, s-maxage=900, stale-while-revalidate=86400',
  POIS: 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400',
  SEARCH: 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
};

/**
 * Creates a canonical Request object for Cloudflare Cache API matching.
 * Sorts query parameters and rounds coordinates to 3 decimals (~110m).
 */
export function buildCanonicalCacheRequest(rawUrl: string, endpoint: 'city' | 'pois' | 'search'): Request {
  const parsed = new URL(rawUrl);
  const cleanParams = new URLSearchParams();

  if (endpoint === 'city') {
    const lat = Number(parsed.searchParams.get('lat') || '0').toFixed(3);
    const lon = Number(parsed.searchParams.get('lon') || '0').toFixed(3);
    const name = (parsed.searchParams.get('name') || '').toLowerCase().trim();
    cleanParams.set('endpoint', 'city');
    cleanParams.set('lat', lat);
    cleanParams.set('lon', lon);
    cleanParams.set('name', name);
  } else if (endpoint === 'pois') {
    const lat = Number(parsed.searchParams.get('lat') || '0').toFixed(3);
    const lon = Number(parsed.searchParams.get('lon') || '0').toFixed(3);
    const limit = parsed.searchParams.get('limit') || '12';
    cleanParams.set('endpoint', 'pois');
    cleanParams.set('lat', lat);
    cleanParams.set('lon', lon);
    cleanParams.set('limit', limit);
  } else if (endpoint === 'search') {
    const q = (parsed.searchParams.get('q') || '').toLowerCase().trim();
    cleanParams.set('endpoint', 'search');
    cleanParams.set('q', q);
  }

  cleanParams.sort();
  parsed.search = cleanParams.toString();

  return new Request(parsed.toString(), {
    method: 'GET',
    headers: { 'Accept': 'application/json' },
  });
}

/**
 * Checks Cloudflare Edge Cache for an existing cached Response.
 */
export async function matchEdgeCache(cacheRequest: Request): Promise<Response | null> {
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const match = await caches.default.match(cacheRequest);
      if (match) {
        return match;
      }
    }
  } catch (err) {
    console.warn('[EdgeCache] Error on cache match:', err);
  }
  return null;
}

/**
 * Stores a Response into Cloudflare Edge Cache.
 * Executes in the background via executionCtx.waitUntil if provided.
 */
export function putEdgeCache(
  cacheRequest: Request,
  response: Response,
  executionCtx?: { waitUntil?: (p: Promise<any>) => void }
): void {
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      // Must clone response before putting into cache
      const responseToCache = response.clone();
      const putPromise = caches.default.put(cacheRequest, responseToCache).catch((err) => {
        console.warn('[EdgeCache] Error storing into cache:', err);
      });

      if (executionCtx && typeof executionCtx.waitUntil === 'function') {
        executionCtx.waitUntil(putPromise);
      }
    }
  } catch (err) {
    console.warn('[EdgeCache] Error on putEdgeCache:', err);
  }
}
