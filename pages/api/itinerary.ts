import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { generateItinerary } from '../../worker/services/itinerary';
import {
  checkRateLimit,
  validateBotHeaders,
  validateItineraryPayload,
  getQuickItineraryCacheKey,
  getQuickItineraryFromMemory,
  setQuickItineraryToMemory,
  sanitizeErrorMessage,
} from '../../worker/utils/security';

function parseEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          env[key] = val.replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch {
    // Ignore read errors
  }
  return env;
}

function getEnvConfig(): { apiKey?: string; terradataLink?: string } {
  let apiKey = process.env.OPENROUTER_API_KEY;
  let terradataLink = process.env.TERRADATA_LINK;

  if (!apiKey || !terradataLink) {
    const envFile = parseEnvFile(path.resolve(process.cwd(), '.env'));
    apiKey = apiKey || envFile.OPENROUTER_API_KEY;
    terradataLink = terradataLink || envFile.TERRADATA_LINK;
  }

  return { apiKey, terradataLink };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 1. Enforce POST method only
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 2. Bot & Scraper Protection: Validate User-Agent and Content-Type
  const botValidation = validateBotHeaders({
    userAgent: (req.headers['user-agent'] as string) || null,
    contentType: (req.headers['content-type'] as string) || null,
  });

  if (!botValidation.allowed) {
    return res.status(botValidation.status || 403).json({
      error: botValidation.error || 'Acesso negado.',
    });
  }

  // 3. Token Exhaustion & Wallet DoS Protection: Rate limiting (5 req / min per IP)
  const clientIp =
    (req.headers['cf-connecting-ip'] as string) ||
    (req.headers['x-real-ip'] as string) ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1';

  const rateLimit = checkRateLimit(clientIp);
  res.setHeader('RateLimit-Limit', '5');
  res.setHeader('RateLimit-Remaining', String(rateLimit.remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil(rateLimit.resetAt / 1000)));

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    return res.status(429).json({
      error: 'Muitas requisições. Aguarde um instante antes de gerar outro roteiro.',
    });
  }

  // 4. API Key Verification (Guaranteed never to leak to client in responses)
  const { apiKey, terradataLink } = getEnvConfig();
  if (!apiKey) {
    console.error('[Next.js /api/itinerary] OPENROUTER_API_KEY missing in server environment.');
    return res.status(503).json({
      error: 'Serviço de roteiros indisponível no momento.',
    });
  }

  // 5. Honeypot & Payload Schema Verification
  const payloadValidation = validateItineraryPayload(req.body);
  if (!payloadValidation.valid || !payloadValidation.options) {
    return res.status(payloadValidation.status || 400).json({
      error: payloadValidation.error || 'Requisição inválida.',
    });
  }

  const options = payloadValidation.options;

  // 6. Fast Quick-Itinerary Cache (2 Hours TTL): avoid hitting OpenRouter if recently generated
  if (options.mode === 'quick') {
    const cacheKey = getQuickItineraryCacheKey(options.cityName, options.weather?.temperature);
    const cachedItinerary = getQuickItineraryFromMemory(cacheKey);

    if (cachedItinerary) {
      res.setHeader('X-TerraData-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, max-age=7200');
      return res.status(200).json(cachedItinerary);
    }
  }

  // 7. Generate Itinerary via OpenRouter AI with sanitized preferences and prompt protection
  try {
    const itinerary = await generateItinerary(apiKey, {
      ...options,
      referer: terradataLink,
    });

    if (options.mode === 'quick') {
      const cacheKey = getQuickItineraryCacheKey(options.cityName, options.weather?.temperature);
      setQuickItineraryToMemory(cacheKey, itinerary);
      res.setHeader('X-TerraData-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=7200');
    } else {
      res.setHeader('Cache-Control', 'no-store');
    }

    return res.status(200).json(itinerary);
  } catch (err) {
    const rawMessage = err instanceof Error ? err.message : 'Erro ao gerar roteiro.';
    // Security guarantee: Sanitize error message to prevent credential or token leaks
    const safeMessage = sanitizeErrorMessage(rawMessage, apiKey);
    console.error('[Next.js /api/itinerary] Safe Error:', safeMessage);
    return res.status(500).json({ error: safeMessage });
  }
}
