import { PointOfInterest } from '../../types';
import { timeoutSignal } from '../utils/timeout';

export type PlaceCategory =
  | 'Restaurante'
  | 'Café & Padaria'
  | 'Bar & Vida Noturna'
  | 'Lanches & Sorveteria'
  | 'Shopping & Comércio'
  | 'Cultura & Parque';

export interface GroundedPlace {
  name: string;
  category: PlaceCategory;
  address?: string;
  lat?: number;
  lon?: number;
}

interface PlacesCacheEntry {
  places: GroundedPlace[];
  expiresAt: number;
}

const PLACES_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const PLACES_CACHE = new Map<string, PlacesCacheEntry>();

const GENERIC_PLACE_NAMES = new Set([
  'restaurante',
  'lanchonete',
  'café',
  'cafe',
  'cafeteria',
  'padaria',
  'bar',
  'pub',
  'shopping',
  'supermercado',
  'mercado',
  'praça',
  'praca',
  'parque',
  'museu',
  'teatro',
  'igreja',
  'refeitório',
  'refeitorio',
  'cantina',
  'pizzaria',
  'churrascaria',
  'sorveteria',
]);

function isValidPlaceName(name: string, cityName: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 3) return false;
  if (/^\d+$/.test(trimmed)) return false;

  const lower = trimmed.toLowerCase();
  if (GENERIC_PLACE_NAMES.has(lower)) return false;
  if (cityName && lower === cityName.trim().toLowerCase()) return false;

  return true;
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Resolves approximate coordinates for a city when not provided by the caller.
 */
async function resolveCityCoordinates(
  cityName: string,
  admin1?: string
): Promise<{ lat: number; lon: number } | null> {
  try {
    const query = admin1 ? `${cityName} ${admin1}` : cityName;
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      query
    )}&count=3&language=pt&format=json`;
    const res = await fetch(url, {
      signal: timeoutSignal(2000),
      headers: { 'User-Agent': 'TerraDataEdgeBFF/1.0 (https://terradata.app)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ latitude: number; longitude: number; name: string }>;
    };
    const first = data.results?.[0];
    if (first && typeof first.latitude === 'number' && typeof first.longitude === 'number') {
      return { lat: first.latitude, lon: first.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

interface NominatimV2Result {
  name?: string;
  lat?: string;
  lon?: string;
  extratags?: Record<string, string> | null;
  address?: {
    road?: string;
    house_number?: string;
    suburb?: string;
    neighbourhood?: string;
  };
}

function formatOsmAddress(addr?: NominatimV2Result['address']): string | undefined {
  if (!addr) return undefined;
  const street = addr.road
    ? addr.house_number
      ? `${addr.road}, ${addr.house_number}`
      : addr.road
    : undefined;
  const district = addr.suburb || addr.neighbourhood;
  const parts = [street, district].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : undefined;
}

function hasFreshBusinessSignals(
  category: PlaceCategory,
  tags?: Record<string, string> | null
): boolean {
  if (!tags) {
    // Malls and parks/museums are durable civic landmarks even with minimal tags
    return category === 'Shopping & Comércio' || category === 'Cultura & Parque';
  }
  const tagKeys = Object.keys(tags);
  // Reject explicitly closed / disused OSM nodes
  if (tagKeys.some((k) => /^(disused|abandoned|was|closed):/i.test(k))) {
    return false;
  }
  if (category === 'Shopping & Comércio' || category === 'Cultura & Parque') {
    return true;
  }
  // For restaurants/cafes/bars in OSM, require active contact/schedule/check_date signals
  // so stale 2016-2019 abandoned nodes are excluded
  return Boolean(
    tags.opening_hours ||
      tags.website ||
      tags['contact:website'] ||
      tags['contact:instagram'] ||
      tags.phone ||
      tags['contact:phone'] ||
      tags['check_date']
  );
}

async function queryNominatimTag(
  tagQuery: string,
  viewbox: string,
  category: PlaceCategory,
  cityName: string,
  limit = 12
): Promise<GroundedPlace[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      tagQuery
    )}&format=jsonv2&extratags=1&addressdetails=1&viewbox=${viewbox}&bounded=1&limit=${limit}`;

    const res = await fetch(url, {
      signal: timeoutSignal(2500),
      headers: {
        'User-Agent': 'TerraDataApp/1.0 (https://terradata.app)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    if (!res.ok) return [];
    const items = (await res.json()) as NominatimV2Result[];
    if (!Array.isArray(items)) return [];

    const results: GroundedPlace[] = [];
    for (const item of items) {
      const name = (item.name || '').trim();
      if (!isValidPlaceName(name, cityName)) continue;
      if (!hasFreshBusinessSignals(category, item.extratags)) continue;

      const lat = item.lat ? parseFloat(item.lat) : undefined;
      const lon = item.lon ? parseFloat(item.lon) : undefined;

      results.push({
        name,
        category,
        address: formatOsmAddress(item.address),
        lat: lat !== undefined && !isNaN(lat) ? lat : undefined,
        lon: lon !== undefined && !isNaN(lon) ? lon : undefined,
      });
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Fallback discovery of verified active OSM places (filtering out stale untagged entries)
 * used when the primary live OpenRouter Web Search plugin is unavailable.
 */
export async function fetchLocalEstablishments(options: {
  cityName: string;
  admin1?: string;
  lat?: number;
  lon?: number;
}): Promise<GroundedPlace[]> {
  let { lat, lon } = options;
  const { cityName, admin1 } = options;

  if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
    const resolved = await resolveCityCoordinates(cityName, admin1);
    if (!resolved) return [];
    lat = resolved.lat;
    lon = resolved.lon;
  }

  const cacheKey = `v2_${lat.toFixed(2)}_${lon.toFixed(2)}`;
  const cached = PLACES_CACHE.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.places;
  }

  const d = 0.09;
  const viewbox = `${(lon - d).toFixed(4)},${(lat + d).toFixed(4)},${(lon + d).toFixed(4)},${(lat - d).toFixed(4)}`;

  const [restaurants, bars] = await Promise.all([
    queryNominatimTag('[amenity=restaurant]', viewbox, 'Restaurante', cityName, 14),
    queryNominatimTag('[amenity=bar]', viewbox, 'Bar & Vida Noturna', cityName, 10),
  ]);

  const [cafes, malls] = await Promise.all([
    queryNominatimTag('[amenity=cafe]', viewbox, 'Café & Padaria', cityName, 10),
    queryNominatimTag('[shop=mall]', viewbox, 'Shopping & Comércio', cityName, 6),
  ]);

  const combined = [...restaurants, ...cafes, ...bars, ...malls];
  const uniqueMap = new Map<string, GroundedPlace>();
  for (const place of combined) {
    const key = place.name.toLowerCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, place);
    }
  }

  const deduped = Array.from(uniqueMap.values());

  if (deduped.length > 0) {
    if (PLACES_CACHE.size > 1000) {
      const now = Date.now();
      PLACES_CACHE.forEach((v, k) => {
        if (now >= v.expiresAt) PLACES_CACHE.delete(k);
      });
    }
    PLACES_CACHE.set(cacheKey, {
      places: deduped,
      expiresAt: Date.now() + PLACES_CACHE_TTL_MS,
    });
  }

  return deduped;
}

/**
 * Formats a shuffled directory of fallback verified places + nearby POIs.
 */
export function buildGroundedPlacesContext(options: {
  establishments: GroundedPlace[];
  nearbyPois?: Array<Pick<PointOfInterest, 'title' | 'category'>>;
  excludeTitles?: string[];
  styles?: string[];
}): string {
  const { establishments, nearbyPois = [], excludeTitles = [] } = options;
  const excludedSet = new Set(excludeTitles.map((t) => t.trim().toLowerCase()));

  const isExcluded = (name: string) => {
    const lower = name.trim().toLowerCase();
    if (excludedSet.has(lower)) return true;
    for (const ex of excludedSet) {
      if (ex.length > 4 && (lower.includes(ex) || ex.includes(lower))) {
        return true;
      }
    }
    return false;
  };

  const lines: string[] = [];

  const filteredEst = shuffleArray(establishments.filter((e) => !isExcluded(e.name))).slice(0, 12);
  if (filteredEst.length > 0) {
    lines.push(
      `- Estabelecimentos verificados: ${filteredEst
        .map((e) => (e.address ? `${e.name} (${e.category} · ${e.address})` : `${e.name} (${e.category})`))
        .join(' | ')}`
    );
  }

  const filteredPois = shuffleArray(
    nearbyPois.filter((p) => (p.title || '').trim().length >= 3 && !isExcluded(p.title))
  ).slice(0, 8);
  if (filteredPois.length > 0) {
    lines.push(
      `- Parques, Praças, Museus & Atrações: ${filteredPois
        .map((p) => (p.category ? `${p.title} (${p.category})` : p.title))
        .join(' | ')}`
    );
  }

  return lines.join('\n');
}
