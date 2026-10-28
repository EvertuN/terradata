import {
  AirQualityData,
  City,
  CityDashboard,
  CitySummary,
  NearbyCity,
  PointOfInterest,
  WeatherData,
} from '../types';
import { Cache, CACHE_TTL, normalizeCoords } from './cache';
import { normalizeCityName, searchLocalFuzzyCities } from './fuzzySearch';

/**
 * Thin browser client for the Rust API.
 *
 * All upstream calls (Open-Meteo, Wikipedia, Wikidata, Nominatim) happen on the
 * server. This file only knows how to talk to our own `/api` endpoints. It keeps
 * the localStorage layer so navigation between cities stays instant, and keeps a
 * local fuzzy-search fallback so autocomplete still works if the API is briefly
 * unreachable.
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
const DEFAULT_TIMEOUT_MS = 12_000;

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function fetchJson<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T | null> {
  if (typeof window === 'undefined') return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const response = await fetch(apiUrl(path), {
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });

    if (!response.ok) {
      if (response.status !== 404) {
        console.warn(`TerraData API ${path} -> HTTP ${response.status}`);
      }
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    if ((error as Error)?.name !== 'AbortError') {
      console.warn(`TerraData API ${path} failed:`, error);
    }
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function queryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

function currentTimezone(): string {
  if (typeof Intl === 'undefined') return 'UTC';
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export const ApiService = {
  /**
   * City autocomplete. The server runs the 5,601-city fuzzy index first and
   * only calls Open-Meteo when it cannot answer confidently.
   */
  async searchCities(query: string): Promise<City[]> {
    const raw = query.trim();
    if (raw.length < 2) return [];

    const normalized = normalizeCityName(raw);
    const cacheKey = `search_${normalized}`;

    return Cache.fetchWithCache<City[]>(
      cacheKey,
      CACHE_TTL.CITY_SEARCH,
      async () => {
        const data = await fetchJson<City[]>(
          `/api/cities/search?${queryString({ q: raw, limit: 10 })}`,
          8_000
        );

        if (data === null) {
          return searchLocalFuzzyCities(raw, 10).map((item) => item.city);
        }

        return data;
      },
      (results) => Array.isArray(results) && results.length > 0
    );
  },

  /**
   * Reverse geocode via the server. The backend falls back to the embedded city
   * database if Nominatim is unavailable, so this rarely returns null.
   */
  async reverseGeocode(lat: number, lon: number): Promise<City | null> {
    const coordsKey = normalizeCoords(lat, lon);
    const cacheKey = `revgeo_${coordsKey}`;
    const timezone = currentTimezone();

    return Cache.fetchWithCache<City | null>(
      cacheKey,
      CACHE_TTL.REVERSE_GEO,
      () =>
        fetchJson<City>(
          `/api/geocode/reverse?${queryString({ lat, lon, tz: timezone })}`,
          10_000
        ),
      (result) => Boolean(result && result.name)
    );
  },

  async getWeather(lat: number, lon: number): Promise<WeatherData | null> {
    const cacheKey = `weather_${normalizeCoords(lat, lon)}`;

    return Cache.fetchWithCache<WeatherData | null>(
      cacheKey,
      CACHE_TTL.WEATHER,
      () => fetchJson<WeatherData>(`/api/weather?${queryString({ lat, lon })}`),
      (data) => Boolean(data && data.current)
    );
  },

  async getAirQuality(lat: number, lon: number): Promise<AirQualityData | null> {
    const cacheKey = `air_${normalizeCoords(lat, lon)}`;

    return Cache.fetchWithCache<AirQualityData | null>(
      cacheKey,
      CACHE_TTL.AIR_QUALITY,
      () => fetchJson<AirQualityData>(`/api/air-quality?${queryString({ lat, lon })}`),
      (data) => Boolean(data && data.status)
    );
  },

  async getCitySummary(cityName: string, fallbackName = ''): Promise<CitySummary | null> {
    const cacheKey = `wiki_${normalizeCityName(cityName)}_${normalizeCityName(fallbackName)}`;

    return Cache.fetchWithCache<CitySummary | null>(
      cacheKey,
      CACHE_TTL.CITY_SUMMARY,
      () =>
        fetchJson<CitySummary>(
          `/api/cities/summary?${queryString({ name: cityName, fallback: fallbackName })}`
        ),
      (data) => Boolean(data && data.title)
    );
  },

  async getNearbyPOIs(
    lat: number,
    lon: number,
    limit = 12,
    cityName = '',
    admin1 = '',
    countryCode = ''
  ): Promise<PointOfInterest[]> {
    const cacheKey = `pois_${normalizeCoords(lat, lon)}_${normalizeCityName(
      cityName
    )}_${limit}_${countryCode.toLowerCase()}`;

    return Cache.fetchWithCache<PointOfInterest[]>(
      cacheKey,
      CACHE_TTL.POIS,
      async () => {
        const data = await fetchJson<PointOfInterest[]>(
          `/api/pois?${queryString({
            lat,
            lon,
            limit,
            name: cityName,
            admin1,
            countryCode,
          })}`
        );
        return data ?? [];
      },
      (data) => Array.isArray(data) && data.length > 0
    );
  },

  async getNearbyCities(
    lat: number,
    lon: number,
    cityName = '',
    admin1 = '',
    country = '',
    countryCode = ''
  ): Promise<NearbyCity[]> {
    const cacheKey = `nearby_${normalizeCoords(lat, lon)}_${normalizeCityName(
      cityName
    )}_${normalizeCityName(admin1)}_${normalizeCityName(country)}_${countryCode.toLowerCase()}`;

    return Cache.fetchWithCache<NearbyCity[]>(
      cacheKey,
      CACHE_TTL.NEARBY_CITIES,
      async () => {
        const data = await fetchJson<NearbyCity[]>(
          `/api/cities/nearby?${queryString({
            lat,
            lon,
            name: cityName,
            admin1,
            country,
            countryCode,
          })}`
        );
        return data ?? [];
      },
      (data) => Array.isArray(data) && data.length > 0
    );
  },

  /**
   * Single aggregate call used by the dashboard. One browser request replaces
   * five parallel requests; the server still fetches upstream data in parallel,
   * but with cache, coalescing and per-host budgets.
   */
  async getCityDashboard(
    lat: number,
    lon: number,
    cityName: string,
    admin1 = '',
    country = '',
    countryCode = ''
  ): Promise<CityDashboard | null> {
    const name = cityName.trim() || 'Local Atual';
    const cacheKey = `dashboard_${normalizeCoords(lat, lon)}_${normalizeCityName(
      name
    )}_${normalizeCityName(admin1)}_${countryCode.toLowerCase()}`;

    return Cache.fetchWithCache<CityDashboard | null>(
      cacheKey,
      CACHE_TTL.DASHBOARD,
      () =>
        fetchJson<CityDashboard>(
          `/api/city?${queryString({
            lat,
            lon,
            name,
            admin1,
            country,
            countryCode,
            limit: 12,
          })}`,
          15_000
        ),
      (data) =>
        Boolean(
          data &&
            (data.weather ||
              data.airQuality ||
              data.summary ||
              (data.pois && data.pois.length > 0) ||
              (data.nearbyCities && data.nearbyCities.length > 0))
        )
    );
  },

  getWeatherMeta(code: number) {
    const codes: Record<number, { label: string; icon: string; color: string }> = {
      0: { label: 'Céu Limpo', icon: 'Sun', color: '#f59e0b' },
      1: { label: 'Predominantemente Ensolarado', icon: 'Sun', color: '#f59e0b' },
      2: { label: 'Parcialmente Nublado', icon: 'CloudSun', color: '#60a5fa' },
      3: { label: 'Nublado', icon: 'Cloud', color: '#94a3b8' },
      45: { label: 'Nevoeiro', icon: 'CloudFog', color: '#94a3b8' },
      48: { label: 'Nevoeiro com Geada', icon: 'CloudFog', color: '#94a3b8' },
      51: { label: 'Chuvisco Leve', icon: 'CloudDrizzle', color: '#38bdf8' },
      53: { label: 'Chuvisco Moderado', icon: 'CloudDrizzle', color: '#38bdf8' },
      55: { label: 'Chuvisco Denso', icon: 'CloudDrizzle', color: '#0284c7' },
      61: { label: 'Chuva Leve', icon: 'CloudRain', color: '#38bdf8' },
      63: { label: 'Chuva Moderada', icon: 'CloudRain', color: '#2563eb' },
      65: { label: 'Chuva Forte', icon: 'CloudRain', color: '#1d4ed8' },
      71: { label: 'Neve Fraca', icon: 'Snowflake', color: '#bae6fd' },
      73: { label: 'Neve Moderada', icon: 'Snowflake', color: '#bae6fd' },
      75: { label: 'Nevasca Intensa', icon: 'Snowflake', color: '#93c5fd' },
      80: { label: 'Pancadas de Chuva', icon: 'CloudRain', color: '#38bdf8' },
      81: { label: 'Pancadas Moderadas', icon: 'CloudRain', color: '#2563eb' },
      82: { label: 'Tempestade de Chuva', icon: 'CloudLightning', color: '#1e40af' },
      95: { label: 'Tempestade com Trovoadas', icon: 'CloudLightning', color: '#eab308' },
      96: { label: 'Tempestade com Granizo', icon: 'CloudLightning', color: '#f59e0b' },
      99: { label: 'Tempestade Severa', icon: 'CloudLightning', color: '#ef4444' },
    };

    return codes[code] || { label: 'Tempo Instável', icon: 'Cloud', color: '#94a3b8' };
  },

  formatNumber(val: number | null | undefined): string {
    if (val === null || val === undefined || isNaN(val)) return 'N/D';
    return new Intl.NumberFormat('pt-BR').format(val);
  },
};
