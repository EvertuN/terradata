import { City } from '../types';

export interface SavedCity {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  admin1: string;
  timezone: string;
  population: number;
  savedAt: number;
}

const STORAGE_KEY = 'terradata_favorites_v1';
const LISTENERS: Array<() => void> = [];

export const FavoritesService = {
  getFavorites(): SavedCity[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.warn('Error reading favorites:', e);
    }
    return [];
  },

  isFavorite(cityId: number | undefined): boolean {
    if (!cityId || typeof window === 'undefined') return false;
    const favorites = this.getFavorites();
    return favorites.some((f) => f.id === cityId);
  },

  saveFavorite(city: City): boolean {
    if (typeof window === 'undefined' || !city || !city.name) return false;
    const favorites = this.getFavorites();
    const index = favorites.findIndex((f) => f.id === city.id);
    if (index >= 0) return true;

    const newFav: SavedCity = {
      id: city.id,
      name: city.name,
      latitude: city.latitude,
      longitude: city.longitude,
      country: city.country,
      countryCode: city.countryCode,
      admin1: city.admin1,
      timezone: city.timezone || 'UTC',
      population: city.population || 0,
      savedAt: Date.now(),
    };

    const updated = [newFav, ...favorites].slice(0, 20);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      this.notify();
      return true;
    } catch (e) {
      console.error('Error saving favorite:', e);
      return false;
    }
  },

  removeFavorite(cityId: number): boolean {
    if (typeof window === 'undefined') return false;
    const favorites = this.getFavorites();
    const updated = favorites.filter((f) => f.id !== cityId);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      this.notify();
      return true;
    } catch (e) {
      console.error('Error removing favorite:', e);
      return false;
    }
  },

  toggleFavorite(city: City): boolean {
    if (this.isFavorite(city.id)) {
      this.removeFavorite(city.id);
      return false;
    } else {
      this.saveFavorite(city);
      return true;
    }
  },

  subscribe(listener: () => void): () => void {
    LISTENERS.push(listener);
    return () => {
      const idx = LISTENERS.indexOf(listener);
      if (idx >= 0) LISTENERS.splice(idx, 1);
    };
  },

  notify(): void {
    LISTENERS.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('Favorite listener error:', err);
      }
    });
  },
};
