import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WorkerEnv, CityBundleResponse } from './types';
import {
  EDGE_CACHE_CONTROL,
  buildCanonicalCacheRequest,
  matchEdgeCache,
  putEdgeCache,
} from './utils/cache';
import { fetchWeather } from './services/weather';
import { fetchAirQuality } from './services/airQuality';
import { fetchCitySummary } from './services/wiki';
import { fetchPois } from './services/pois';
import { searchCitiesBff } from './services/citySearch';

const app = new Hono<{ Bindings: WorkerEnv }>();

// 1. CORS Configuration
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Accept', 'Authorization'],
    maxAge: 86400,
  })
);

// 2. High-precision Timing Middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const dur = Date.now() - start;
  c.header('X-Response-Time', `${dur}ms`);
  c.header('Server-Timing', `edge;dur=${dur}`);
});

// 3. Health Check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'terradata-edge-bff',
    runtime: 'cloudflare-workers-hono',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/city
 * Aggregates Open-Meteo Weather, Open-Meteo Air Quality, and Wikipedia Summary
 * in a single ultra-fast network round-trip.
 * Cached at Cloudflare Edge: 15 min fresh, 24h stale-while-revalidate.
 */
app.get('/api/city', async (c) => {
  const url = c.req.url;
  const latStr = c.req.query('lat');
  const lonStr = c.req.query('lon');
  const name = (c.req.query('name') || '').trim();
  const admin1 = c.req.query('admin1') || '';
  const country = c.req.query('country') || '';

  if (!latStr || !lonStr || !name) {
    return c.json({ error: 'Missing required parameters: lat, lon, and name' }, 400);
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return c.json({ error: 'Invalid latitude or longitude format' }, 400);
  }

  // 1. Check Cloudflare Edge Cache
  const cacheReq = buildCanonicalCacheRequest(url, 'city');
  const cached = await matchEdgeCache(cacheReq);
  if (cached) {
    const hitHeaders = new Headers(cached.headers);
    hitHeaders.set('X-TerraData-Cache', 'HIT');
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: hitHeaders,
    });
  }

  // 2. Parallel upstream aggregation across Cloudflare's high-speed backbone
  const [weather, airQuality, summary] = await Promise.all([
    fetchWeather(lat, lon).catch((err) => {
      console.warn('[BFF /api/city] Weather error:', err);
      return null;
    }),
    fetchAirQuality(lat, lon).catch((err) => {
      console.warn('[BFF /api/city] AirQuality error:', err);
      return null;
    }),
    fetchCitySummary(name, admin1).catch((err) => {
      console.warn('[BFF /api/city] Summary error:', err);
      return {
        title: name,
        description: 'Polo cultural e econômico regional.',
        extract: `${name} é um dos destinos de grande relevância na região.`,
        thumbnail: null,
        bannerImage: null,
        url: `https://pt.wikipedia.org/wiki/${encodeURIComponent(name)}`,
      };
    }),
  ]);

  const payload: CityBundleResponse = {
    city: {
      name,
      admin1,
      country,
    },
    weather,
    airQuality,
    summary,
    cachedAt: new Date().toISOString(),
  };

  const response = c.json(payload, 200, {
    'Cache-Control': EDGE_CACHE_CONTROL.CITY,
    'X-TerraData-Cache': 'MISS',
  });

  // 3. Asynchronously persist to Cloudflare Edge Cache
  putEdgeCache(cacheReq, response, c.executionCtx);

  return response;
});

/**
 * GET /api/pois
 * Queries Points of Interest with adaptive Wikidata SPARQL, Wikipedia fallback,
 * and guaranteed anchors.
 * Cached at Cloudflare Edge for 7 days.
 */
app.get('/api/pois', async (c) => {
  const url = c.req.url;
  const latStr = c.req.query('lat');
  const lonStr = c.req.query('lon');
  const name = c.req.query('name') || '';
  const admin1 = c.req.query('admin1') || '';
  const limitStr = c.req.query('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 12;

  if (!latStr || !lonStr) {
    return c.json({ error: 'Missing required parameters: lat and lon' }, 400);
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return c.json({ error: 'Invalid coordinates' }, 400);
  }

  // 1. Check Cloudflare Edge Cache
  const cacheReq = buildCanonicalCacheRequest(url, 'pois');
  const cached = await matchEdgeCache(cacheReq);
  if (cached) {
    const hitHeaders = new Headers(cached.headers);
    hitHeaders.set('X-TerraData-Cache', 'HIT');
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: hitHeaders,
    });
  }

  // 2. Fetch POIs
  const pois = await fetchPois(lat, lon, limit, name, admin1);

  const response = c.json(pois, 200, {
    'Cache-Control': EDGE_CACHE_CONTROL.POIS,
    'X-TerraData-Cache': 'MISS',
  });

  // 3. Asynchronously persist to Cloudflare Edge Cache
  putEdgeCache(cacheReq, response, c.executionCtx);

  return response;
});

/**
 * GET /api/search
 * Fuzzy search across 5.5k Brazilian municipalities + world capitals + Open-Meteo.
 * Cached at Cloudflare Edge for 24 hours.
 */
app.get('/api/search', async (c) => {
  const url = c.req.url;
  const q = (c.req.query('q') || '').trim();
  const limitStr = c.req.query('limit');
  const limit = limitStr ? parseInt(limitStr, 10) : 10;

  if (q.length < 2) {
    return c.json([], 200, {
      'Cache-Control': 'public, max-age=3600',
    });
  }

  // 1. Check Cloudflare Edge Cache
  const cacheReq = buildCanonicalCacheRequest(url, 'search');
  const cached = await matchEdgeCache(cacheReq);
  if (cached) {
    const hitHeaders = new Headers(cached.headers);
    hitHeaders.set('X-TerraData-Cache', 'HIT');
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers: hitHeaders,
    });
  }

  // 2. Execute Fuzzy Search
  const results = await searchCitiesBff(q, limit);

  const response = c.json(results, 200, {
    'Cache-Control': EDGE_CACHE_CONTROL.SEARCH,
    'X-TerraData-Cache': 'MISS',
  });

  // 3. Asynchronously persist to Cloudflare Edge Cache
  putEdgeCache(cacheReq, response, c.executionCtx);

  return response;
});

// 4. Fallback for Static Assets (Next.js export in ./out)
app.get('*', async (c) => {
  if (c.env?.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not Found', 404);
});

// 5. Global Error Handler
app.onError((err, c) => {
  console.error('[Worker Fatal Error]:', err);
  return c.json(
    {
      error: 'Internal Edge BFF Error',
      message: err.message || 'An unexpected error occurred on the Edge',
    },
    500
  );
});

export default app;
