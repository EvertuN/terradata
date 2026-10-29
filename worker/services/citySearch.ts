import { City } from '../../types';
import { normalizeCityName } from '../../services/textMatch';
import { searchLocalFuzzyCities } from '../../services/fuzzySearch';
import { timeoutSignal } from '../utils/timeout';

interface ScoredCandidate {
  city: City;
  relevance: number;
}

/**
 * Searches cities on the Cloudflare Edge, aggregating Open-Meteo Geocoding
 * and the pre-indexed Brazilian & World cities database with fuzzy tolerance.
 */
export async function searchCitiesBff(query: string, limit = 10): Promise<City[]> {
  const rawQuery = (query || '').trim();
  if (rawQuery.length < 2) return [];

  const normalized = normalizeCityName(rawQuery);
  const encoded = encodeURIComponent(rawQuery);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=10&language=pt&format=json`;

  // 1. Parallel fetch from Open-Meteo with strict 3s timeout
  const remoteRequest: Promise<City[]> = fetch(url, {
    signal: timeoutSignal(3000),
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'TerraDataEdgeBFF/1.0 (https://github.com/EvertuN/terradata)',
    },
  })
    .then(async (res) => {
      if (!res.ok) return [];
      const data = (await res.json()) as any;
      if (!data || !Array.isArray(data.results)) return [];
      return data.results.map((c: any) => ({
        id: c.id,
        name: c.name,
        latitude: c.latitude,
        longitude: c.longitude,
        elevation: c.elevation || 0,
        country: c.country || '',
        countryCode: (c.country_code || '').toLowerCase(),
        admin1: c.admin1 || '',
        timezone: c.timezone || 'UTC',
        population: c.population || 0,
      }));
    })
    .catch((err) => {
      console.warn('[CitySearch] Open-Meteo upstream error on Edge:', err);
      return [];
    });

  // 2. Local fuzzy search across all 5.5k Brazilian municipalities + top world capitals
  const localMatches = searchLocalFuzzyCities(rawQuery, 8);

  // 3. Await remote results
  const openMeteoCities = await remoteRequest;

  // 4. Score and merge candidates with relevance ranking
  const candidates: ScoredCandidate[] = [];
  const seenKeys = new Set<string>();

  const getCityKey = (c: City) =>
    `${normalizeCityName(c.name)}|${(c.admin1 || '').toLowerCase()}|${(c.countryCode || '').toLowerCase()}`;

  // Add local database matches
  for (const item of localMatches) {
    const key = getCityKey(item.city);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      let rel = item.score;

      if (item.score >= 1000) {
        rel = 2000;
      } else {
        if (item.city.countryCode === 'br') rel += 200;
        if (item.city.isCapital) rel += 50;
      }

      candidates.push({ city: item.city, relevance: rel });
    }
  }

  // Add Open-Meteo results
  for (const c of openMeteoCities) {
    const key = getCityKey(c);
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      const cNorm = normalizeCityName(c.name);
      let rel = 300;

      if (cNorm === normalized) {
        if (c.countryCode === 'br') {
          rel = 2000;
        } else if (
          c.population > 20000 ||
          c.id === 2988507 /* Paris */ ||
          c.timezone.startsWith('Europe/') ||
          c.timezone.startsWith('America/New_York')
        ) {
          rel = 1900;
        } else {
          rel = 800;
        }
      } else if (cNorm.startsWith(normalized)) {
        const ratio = normalized.length / cNorm.length;
        if (c.countryCode === 'br') {
          rel = 780 + ratio * 100;
        } else if (c.population > 50000) {
          rel = 720 + ratio * 80;
        } else {
          rel = 500 + ratio * 50;
        }
      }

      if (c.countryCode === 'br') rel += 80;
      if (c.population > 1000000) rel += 80;
      else if (c.population > 100000) rel += 40;

      candidates.push({ city: c, relevance: rel });
    }
  }

  // Sort descending by relevance
  candidates.sort((a, b) => b.relevance - a.relevance);

  return candidates.slice(0, limit).map((c) => c.city);
}
