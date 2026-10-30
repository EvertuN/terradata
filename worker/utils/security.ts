import { AIItinerary, ItineraryDuration, ItineraryTransport } from '../../types/index';

/**
 * TerraData Application Security & Rate Limiting Module
 * 
 * Provides defense-in-depth against:
 * 1. Bot abuse, automated scraping, and honeypot traps.
 * 2. Prompt injection, jailbreaking, and delimiter breakouts.
 * 3. Token exhaustion, wallet denial-of-service, and loop attacks.
 * 4. API key exfiltration and credential leakage.
 * 5. Multi-tier caching for rapid itineraries (Edge + Memory cooldowns).
 */

// ============================================================================
// 1. PROMPT INJECTION & JAILBREAKING DEFENSES
// ============================================================================

/**
 * Advanced multi-stage prompt injection filter.
 * Normalizes unicode (NFKC), removes invisible/homoglyph characters, strips
 * delimiters and control characters, neutralizes command override patterns in
 * English and Portuguese, and strictly caps text to 100 characters.
 */
export function sanitizePreferences(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  // 1. Normalize Unicode (NFKC) to defeat homoglyphs, fullwidth chars, and decomposed characters
  let s = raw.normalize('NFKC');

  // 2. Strip zero-width, invisible characters and non-standard whitespace
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0\u2000-\u200A\u202F\u205F]/g, ' ');

  // 3. Strip ASCII & Unicode control characters (including null bytes, escapes, line feeds)
  s = s.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // 4. Strip prompt delimiters, code fences, quotes, and structural tokens
  s = s.replace(/[<>[\]{}\\`"';|~^$]/g, '');

  // 5. Neutralize LLM Chat delimiters and system token spoofs
  s = s.replace(/(?:<\|im_start\|>|<\|im_end\|>|<\|system\|>|<\|user\|>|<\|assistant\|>|\[INST\]|\[\/INST\]|<<SYS>>|<\/<<SYS>>|\[SYSTEM\])/gi, '');
  s = s.replace(/^(?:system|assistant|human|user|ai)\s*:\s*/gi, '');

  // 6. Neutralize instruction override phrases (English & Portuguese)
  const injectionPatterns = [
    // Override commands
    /ignore\s+(?:previous|all|above|system|prior|other|these)?\s*(?:instructions?|directions?|prompts?|rules?|guidelines?)/gi,
    /disregard\s+(?:all|any|previous|above|system)?\s*(?:instructions?|rules?|directions?)/gi,
    /desconsidere\s+(?:todas?\s+as?|as?|quaisquer)?\s*(?:instruções|regras|diretrizes|mensagens?)(?:\s+anteriores)?/gi,
    /esqueça\s+(?:tudo|todas?\s+as?\s+instruções|o\s+que\s+foi\s+dito|as\s+regras)/gi,
    /ignorar?\s+(?:todas?\s+as?|as?)\s*(?:instruções|regras|diretrizes)/gi,
    /stop\s+following\s+rules/gi,
    /override\s+(?:system|prompt|instructions?)/gi,
    /reset\s+(?:system|instructions?)/gi,

    // Persona & Roleplay hijacking
    /\b(?:you\s+are\s+now|you\s+must\s+act\s+as|act\s+as|pretend\s+(?:to\s+be|you\s+are)|roleplay\s+as)\b/gi,
    /\b(?:você\s+agora\s+é|você\s+deve\s+agir\s+como|aja\s+como|finja\s+ser|finja\s+que\s+é|comporte-se\s+como)\b/gi,
    /\b(?:dan\s+mode|jailbreak|developer\s+mode|modo\s+desenvolvedor|modo\s+dan|unrestricted\s+mode)\b/gi,

    // System prompt & Key exfiltration
    /\b(?:system\s*prompt|system\s*message|prompt\s*do\s*sistema|instruções\s*do\s*sistema)\b/gi,
    /\b(?:output|reveal|print|show|display|echo|repeat|repita|mostre|revele|diga)\s+(?:the\s+|your\s+|o\s+|a\s+|sua\s+)?(?:system\s+prompt|prompt|instructions?|instruções|api\s*keys?|secrets?|tokens?|chaves?)\b/gi,
    /\b(?:api\s*keys?|secret\s*keys?|access\s*tokens?|bearer\s*token|chaves?\s*(?:de\s*api|secreta)?)\b/gi,
    /\b(?:qual\s+a\s+(?:sua\s+)?api\s*key|qual\s+o\s+seu\s+prompt)\b/gi,
    /\b(?:repeat\s+after\s+me|echo\s+back|repita\s+o\s+prompt)\b/gi,
  ];

  for (const pattern of injectionPatterns) {
    s = s.replace(pattern, '');
  }

  // 7. Collapse repeated whitespace and trim
  s = s.replace(/\s+/g, ' ').trim();

  // 8. Strict hard limit: maximum 100 characters
  return s.slice(0, 100);
}

/**
 * Sanitizes location names (city, admin1, country) to prevent header or prompt poisoning.
 */
export function sanitizeLocationName(raw: string | undefined | null, maxLength = 80): string {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.normalize('NFKC');
  // Allow latin letters, accented characters (Portuguese/international), numbers, spaces, dots, commas, hyphens, and apostrophes
  s = s.replace(/[^a-zA-Z0-9\u00C0-\u024F\s.,'-]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s.slice(0, maxLength);
}

/**
 * Strips secrets, API keys, and authorization tokens from error messages
 * before sending to client responses.
 */
export function sanitizeErrorMessage(message: string, secretKey?: string): string {
  let clean = message || 'Erro ao processar solicitação.';

  // Strip known secret key if provided
  if (secretKey && secretKey.length > 5) {
    clean = clean.split(secretKey.trim()).join('[REDACTED]');
  }

  // Strip generic Bearer tokens
  clean = clean.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, 'Bearer [REDACTED]');

  // Strip OpenRouter or generic sk-* API keys
  clean = clean.replace(/sk-[a-zA-Z0-9_\-]{16,}/gi, 'sk-[REDACTED]');
  clean = clean.replace(/sk-or-[a-zA-Z0-9_\-]{16,}/gi, 'sk-or-[REDACTED]');

  // Strip sensitive internal URLs or environment paths
  clean = clean.replace(/https?:\/\/openrouter\.ai\/api\/[^\s]+/gi, 'https://openrouter.ai/api/[REDACTED]');

  return clean;
}

// ============================================================================
// 2. BOT & SCRAPER DEFENSES
// ============================================================================

const SUSPICIOUS_USER_AGENTS = [
  'curl/',
  'python-requests',
  'httpx',
  'sqlmap',
  'nikto',
  'masscan',
  'scrapy',
  'go-http-client',
  'zgrab',
  'acunetix',
  'wpscan',
  'dirbuster',
  'postmanruntime',
  'aiohttp',
  'petalbot',
  'censys',
];

export interface BotValidationResult {
  allowed: boolean;
  status?: number;
  error?: string;
}

/**
 * Validates incoming request headers against automated bot scrapers and malformed types.
 */
export function validateBotHeaders(headers: {
  userAgent?: string | null;
  contentType?: string | null;
}): BotValidationResult {
  const ua = (headers.userAgent || '').trim();
  const ct = (headers.contentType || '').toLowerCase().trim();

  // 1. Require a non-empty User-Agent header (minimum 3 characters)
  if (!ua || ua.length < 3) {
    return {
      allowed: false,
      status: 403,
      error: 'Acesso bloqueado: User-Agent ausente ou inválido.',
    };
  }

  // 2. Block known malicious CLI scrapers / scanner tools
  const uaLower = ua.toLowerCase();
  for (const suspicious of SUSPICIOUS_USER_AGENTS) {
    if (uaLower.startsWith(suspicious) || uaLower.includes(` ${suspicious}`)) {
      return {
        allowed: false,
        status: 403,
        error: 'Acesso bloqueado para clientes automatizados.',
      };
    }
  }

  // 3. Strictly require Content-Type: application/json for POST payloads
  if (!ct.includes('application/json')) {
    return {
      allowed: false,
      status: 415,
      error: 'Content-Type deve ser application/json.',
    };
  }

  return { allowed: true };
}

// ============================================================================
// 3. HONEYPOT & PAYLOAD SCHEMA VERIFICATION
// ============================================================================

export interface ValidatedItineraryOptions {
  cityName: string;
  admin1?: string;
  country?: string;
  weather?: {
    temperature?: number;
    apparentTemperature?: number;
    condition?: string;
  } | null;
  currentTime?: string;
  mode: 'quick' | 'custom';
  preferences: string;
  duration: ItineraryDuration;
  transport: ItineraryTransport | 'Geral';
}

export interface PayloadValidationResult {
  valid: boolean;
  status?: number;
  error?: string;
  options?: ValidatedItineraryOptions;
}

const ALLOWED_DURATIONS: ItineraryDuration[] = ['Meio dia', '1 dia', '2 dias', '3 dias'];
const ALLOWED_TRANSPORTS: (ItineraryTransport | 'Geral')[] = [
  'Carro',
  'Moto',
  'A pé',
  'Bicicleta',
  'Transporte público',
  'Geral',
];

/**
 * Inspects payload structure, drops honeypot-triggered bot requests, and sanitizes fields.
 */
export function validateItineraryPayload(body: unknown): PayloadValidationResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, status: 400, error: 'Payload JSON inválido.' };
  }

  const data = body as Record<string, unknown>;

  // 1. Honeypot Verification: Automated spam bots often fill out invisible fields
  const honeypots = ['website', 'email_confirm', 'hp_check', 'bot_trap', '_honey', 'company_url'];
  for (const hp of honeypots) {
    const val = data[hp];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return {
        valid: false,
        status: 400,
        error: 'Requisição inválida.',
      };
    }
  }

  // 2. City name validation
  const rawCity = typeof data.cityName === 'string' ? data.cityName : '';
  const cityName = sanitizeLocationName(rawCity, 80);
  if (!cityName || cityName.length < 2) {
    return { valid: false, status: 400, error: 'Cidade não identificada.' };
  }

  // 3. Location context
  const admin1 = typeof data.admin1 === 'string' ? sanitizeLocationName(data.admin1, 50) : undefined;
  const country = typeof data.country === 'string' ? sanitizeLocationName(data.country, 50) : undefined;
  const currentTime = typeof data.currentTime === 'string' ? data.currentTime.slice(0, 30) : undefined;

  // 4. Mode validation
  const mode = data.mode === 'quick' ? 'quick' : 'custom';

  // 5. Preferences (hardened sanitization + 100 char limit)
  const preferences = typeof data.preferences === 'string' ? sanitizePreferences(data.preferences) : '';

  // 6. Duration validation
  let duration: ItineraryDuration = '1 dia';
  if (typeof data.duration === 'string' && ALLOWED_DURATIONS.includes(data.duration as ItineraryDuration)) {
    duration = data.duration as ItineraryDuration;
  }

  // 7. Transport validation
  let transport: ItineraryTransport | 'Geral' = mode === 'quick' ? 'Geral' : 'Carro';
  if (typeof data.transport === 'string' && ALLOWED_TRANSPORTS.includes(data.transport as any)) {
    transport = data.transport as ItineraryTransport | 'Geral';
  }

  // 8. Weather verification
  let weather: ValidatedItineraryOptions['weather'] = null;
  if (data.weather && typeof data.weather === 'object') {
    const w = data.weather as Record<string, unknown>;
    const temp = typeof w.temperature === 'number' && !isNaN(w.temperature) ? Math.round(w.temperature) : undefined;
    const appTemp = typeof w.apparentTemperature === 'number' && !isNaN(w.apparentTemperature) ? Math.round(w.apparentTemperature) : undefined;
    const cond = typeof w.condition === 'string' ? w.condition.slice(0, 50) : undefined;

    // Reject absurd temperatures that indicate corrupted/manipulated input
    if (temp !== undefined && (temp < -70 || temp > 65)) {
      return { valid: false, status: 400, error: 'Dados meteorológicos inconsistentes.' };
    }

    weather = {
      temperature: temp,
      apparentTemperature: appTemp,
      condition: cond,
    };
  }

  return {
    valid: true,
    options: {
      cityName,
      admin1,
      country,
      weather,
      currentTime,
      mode,
      preferences,
      duration,
      transport,
    },
  };
}

// ============================================================================
// 4. TOKEN EXHAUSTION & RATE LIMITING (5 requests / min per IP)
// ============================================================================

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;    // Max 5 requests/min per IP
const RATE_LIMIT_STORE = new Map<string, RateLimitRecord>();

/**
 * Checks rate limit for a client IP.
 * Maximum 5 itinerary generation requests per minute per IP.
 */
export function checkRateLimit(clientIp: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const key = clientIp || 'unknown_ip';

  // Periodic store cleanup if growing large
  if (RATE_LIMIT_STORE.size > 5000) {
    RATE_LIMIT_STORE.forEach((entry, ip) => {
      if (now > entry.resetAt) {
        RATE_LIMIT_STORE.delete(ip);
      }
    });
  }

  const record = RATE_LIMIT_STORE.get(key);

  if (!record || now > record.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
      retryAfterSeconds,
    };
  }

  record.count += 1;
  const remaining = MAX_REQUESTS_PER_WINDOW - record.count;
  return {
    allowed: true,
    remaining,
    resetAt: record.resetAt,
    retryAfterSeconds: 0,
  };
}

// ============================================================================
// 5. QUICK ITINERARY CACHE (2 Hours TTL by City & Temperature Band)
// ============================================================================

/** 2 hours TTL in milliseconds */
export const QUICK_ITINERARY_TTL_MS = 2 * 60 * 60 * 1000;

interface MemoryCacheEntry {
  itinerary: AIItinerary;
  expiresAt: number;
}

const QUICK_ITINERARY_CACHE = new Map<string, MemoryCacheEntry>();

/**
 * Normalizes temperature into a 4-degree band to maximize cache hits.
 * e.g., 21.4°C -> '20_24C'
 */
export function getTemperatureBand(temp: number | undefined | null): string {
  if (temp === undefined || temp === null || isNaN(temp)) return 'std';
  const base = Math.floor(temp / 4) * 4;
  return `${base}_${base + 4}C`;
}

/**
 * Computes a deterministic cache key for quick itineraries.
 */
export function getQuickItineraryCacheKey(cityName: string, temp: number | undefined | null): string {
  const normalizedCity = cityName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const tempBand = getTemperatureBand(temp);
  return `quick_itinerary:${normalizedCity}:${tempBand}`;
}

/**
 * Retrieves a quick itinerary from in-memory cache if not expired.
 */
export function getQuickItineraryFromMemory(cacheKey: string): AIItinerary | null {
  const entry = QUICK_ITINERARY_CACHE.get(cacheKey);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    QUICK_ITINERARY_CACHE.delete(cacheKey);
    return null;
  }

  return entry.itinerary;
}

/**
 * Stores a quick itinerary in memory with a 2-hour TTL.
 */
export function setQuickItineraryToMemory(cacheKey: string, itinerary: AIItinerary): void {
  // Prune expired or limit capacity
  if (QUICK_ITINERARY_CACHE.size > 2000) {
    const now = Date.now();
    QUICK_ITINERARY_CACHE.forEach((v, k) => {
      if (now > v.expiresAt) QUICK_ITINERARY_CACHE.delete(k);
    });
  }

  QUICK_ITINERARY_CACHE.set(cacheKey, {
    itinerary,
    expiresAt: Date.now() + QUICK_ITINERARY_TTL_MS,
  });
}
