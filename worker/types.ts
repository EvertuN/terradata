import { City, WeatherData, AirQualityData, CitySummary, PointOfInterest } from '../types';

// Augment standard CacheStorage interface so TypeScript knows about Cloudflare Workers caches.default
declare global {
  interface CacheStorage {
    default?: Cache;
  }
}

export interface WorkerEnv {
  ASSETS?: {
    fetch: (request: Request | string) => Promise<Response>;
  };
}

export interface CityBundleResponse {
  city: {
    name: string;
    admin1: string;
    country: string;
  };
  weather: WeatherData | null;
  airQuality: AirQualityData | null;
  summary: CitySummary;
  cachedAt: string;
}
