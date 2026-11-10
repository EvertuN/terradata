import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WorkerEnv, CityBundleResponse } from './types';
import {
  EDGE_CACHE_CONTROL,
  buildCanonicalCacheRequest,
  buildCanonicalQuickItineraryRequest,
  matchEdgeCache,
  putEdgeCache,
} from './utils/cache';
import {
  checkRateLimit,
  validateBotHeaders,
  validateItineraryPayload,
  getTemperatureBand,
  getQuickItineraryCacheKey,
  getQuickItineraryFromMemory,
  setQuickItineraryToMemory,
  sanitizeErrorMessage,
} from './utils/security';
import { fetchWeather } from './services/weather';
import { fetchAirQuality } from './services/airQuality';
import { fetchCitySummary } from './services/wiki';
import { fetchPois } from './services/pois';
import { searchCitiesBff } from './services/citySearch';
import { generateItinerary } from './services/itinerary';
import { AIItinerary } from '../types';

const app = new Hono<{ Bindings: WorkerEnv }>();

// 1. CORS Configuration
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
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

// 2.1 Edge Security Shield: Block Scanners & Hidden/Sensitive Files (.env, .git, etc.)
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  const pathname = url.pathname;

  // Explicitly allow legitimate standard paths (e.g. /.well-known/security.txt, ACME challenges)
  if (pathname === '/.well-known' || pathname.startsWith('/.well-known/')) {
    return next();
  }

  // Detect hidden path segments (e.g. /.env, /.git, /sub/.hidden)
  const segments = pathname.split('/').filter(Boolean);
  const hasHiddenSegment = segments.some((seg) => seg.startsWith('.') && seg.length > 1);

  // Detect directory traversal attempts
  const hasTraversal = pathname.includes('..') || pathname.includes('%2e%2e') || pathname.includes('%2E%2E');

  // Detect sensitive file extensions commonly targeted by scanners
  const isSensitiveFile = /\.(env|git|svn|htaccess|htpasswd|ini|conf|config|bak|backup|old|save|sql|log|swp|DS_Store|yml|yaml|pem|key|crt)$/i.test(pathname);

  if (pathname.startsWith('/.') || hasHiddenSegment || hasTraversal || isSensitiveFile) {
    return c.text('Not Found', 404, {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });
  }

  await next();
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

/**
 * POST /api/itinerary
 * Generates an intelligent tourist itinerary using OpenRouter AI.
 * Incorporates real-time weather and time context.
 * 
 * Hardened with:
 * - Bot & automated scraper defenses (header inspection & tool rejection)
 * - Rate limiting (max 5 req/min per IP, HTTP 429)
 * - Honeypot traps & strict payload validation
 * - 2-tier caching for Quick itineraries (Cloudflare Edge Cache + in-memory cooldowns)
 * - Strict API key leakage prevention
 */
app.post('/api/itinerary', async (c) => {
  // 1. Bot & Scraper Protection: Validate User-Agent and Content-Type
  const botValidation = validateBotHeaders({
    userAgent: c.req.header('user-agent'),
    contentType: c.req.header('content-type'),
  });

  if (!botValidation.allowed) {
    return c.json(
      { error: botValidation.error || 'Acesso negado.' },
      (botValidation.status || 403) as any
    );
  }

  // 2. Token Exhaustion & Wallet DoS Protection: Rate limiting (5 req / min per IP)
  const clientIp =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-real-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
    'anonymous_ip';

  const rateLimit = checkRateLimit(clientIp);
  c.header('RateLimit-Limit', '5');
  c.header('RateLimit-Remaining', String(rateLimit.remaining));
  c.header('RateLimit-Reset', String(Math.ceil(rateLimit.resetAt / 1000)));

  if (!rateLimit.allowed) {
    c.header('Retry-After', String(rateLimit.retryAfterSeconds));
    return c.json(
      { error: 'Muitas requisições. Aguarde um instante antes de gerar outro roteiro.' },
      429
    );
  }

  // 3. API Key Verification (Guaranteed never to leak to client in responses)
  const apiKey = c.env?.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[BFF /api/itinerary] OPENROUTER_API_KEY not configured.');
    return c.json({ error: 'Serviço de roteiros indisponível no momento.' }, 503);
  }

  // 4. Honeypot & Payload Schema Verification
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Requisição inválida.' }, 400);
  }

  const payloadValidation = validateItineraryPayload(rawBody);
  if (!payloadValidation.valid || !payloadValidation.options) {
    return c.json(
      { error: payloadValidation.error || 'Requisição inválida.' },
      (payloadValidation.status || 400) as any
    );
  }

  const options = payloadValidation.options;

  // 5. Fast Quick-Itinerary Cache (2 Hours TTL): avoid hitting OpenRouter if recently generated
  if (options.mode === 'quick') {
    // 5a. Check In-Memory Cache first (0ms lookup)
    const memKey = getQuickItineraryCacheKey(options.cityName, options.weather?.temperature);
    const memCached = getQuickItineraryFromMemory(memKey);
    if (memCached) {
      return c.json(memCached, 200, {
        'Cache-Control': EDGE_CACHE_CONTROL.ITINERARY_QUICK,
        'X-TerraData-Cache': 'HIT-MEMORY',
      });
    }

    // 5b. Check Cloudflare Edge Cache (caches.default across global Edge PoPs)
    const tempBand = getTemperatureBand(options.weather?.temperature);
    const cacheReq = buildCanonicalQuickItineraryRequest(c.req.url, options.cityName, tempBand);
    const edgeCached = await matchEdgeCache(cacheReq);
    if (edgeCached) {
      try {
        const cachedJson = (await edgeCached.json()) as AIItinerary;
        setQuickItineraryToMemory(memKey, cachedJson);
        return c.json(cachedJson, 200, {
          'Cache-Control': EDGE_CACHE_CONTROL.ITINERARY_QUICK,
          'X-TerraData-Cache': 'HIT-EDGE',
        });
      } catch {
        // Fallback to generation if cache corrupted
      }
    }
  }

  // 6. Generate Itinerary via OpenRouter AI with sanitized preferences and prompt protection
  try {
    const itinerary = await generateItinerary(apiKey, {
      ...options,
      referer: c.env?.TERRADATA_LINK,
    });

    if (options.mode === 'quick') {
      const memKey = getQuickItineraryCacheKey(options.cityName, options.weather?.temperature);
      setQuickItineraryToMemory(memKey, itinerary);

      const tempBand = getTemperatureBand(options.weather?.temperature);
      const cacheReq = buildCanonicalQuickItineraryRequest(c.req.url, options.cityName, tempBand);
      const edgeResponse = new Response(JSON.stringify(itinerary), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': EDGE_CACHE_CONTROL.ITINERARY_QUICK,
          'X-TerraData-Cache': 'HIT-EDGE',
        },
      });
      putEdgeCache(cacheReq, edgeResponse, c.executionCtx);

      return c.json(itinerary, 200, {
        'Cache-Control': EDGE_CACHE_CONTROL.ITINERARY_QUICK,
        'X-TerraData-Cache': 'MISS',
      });
    }

    return c.json(itinerary, 200, {
      'Cache-Control': 'no-store',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao gerar roteiro.';
    // Security guarantee: Strip API key or authorization tokens from error response
    const safeMessage = sanitizeErrorMessage(message, apiKey);
    console.error('[BFF /api/itinerary] Error:', safeMessage);
    return c.json({ error: safeMessage }, 500);
  }
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
