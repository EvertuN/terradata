import { City } from '../types';
import { getIndexedCities, IndexedCity } from './cityDatabase';
import {
  normalizeCityName,
  isSubsequence,
  jaroSimilarity,
  jaroWinkler,
  levenshteinDistance,
} from './textMatch';

// Re-export for backwards compatibility (pure helpers live in textMatch.ts).
export { normalizeCityName, isSubsequence, jaroSimilarity, jaroWinkler, levenshteinDistance };

export interface FuzzyMatchItem {
  city: City;
  score: number;
  isFuzzy: boolean;
  matchType: 'exact' | 'prefix' | 'word' | 'subsequence' | 'jaro_winkler' | 'levenshtein';
}

interface IndexedEntry {
  item: IndexedCity;
  norm: string;
  altNorm: string | null;
}

interface TargetScore {
  score: number;
  type: FuzzyMatchItem['matchType'];
  fuzzy: boolean;
}

/**
 * Normalized names are precomputed once per session instead of being
 * re-normalized for all 5.5k cities on every keystroke.
 */
let _searchIndex: IndexedEntry[] | null = null;

function getSearchIndex(): IndexedEntry[] {
  if (_searchIndex) return _searchIndex;

  const indexed = getIndexedCities();
  const result = new Array<IndexedEntry>(indexed.length);

  for (let i = 0; i < indexed.length; i++) {
    const item = indexed[i];
    result[i] = {
      item,
      norm: normalizeCityName(item.name),
      altNorm: item.altName ? normalizeCityName(item.altName) : null,
    };
  }

  _searchIndex = result;
  return result;
}

/**
 * Loads and indexes the local city database ahead of the first search
 * (called when the search input receives focus).
 */
export function warmupCitySearch(): void {
  getSearchIndex();
}

/**
 * Scores a single normalized city name against the normalized query.
 * Order mirrors the original implementation: exact -> prefix -> word ->
 * subsequence -> Jaro-Winkler -> Levenshtein.
 */
function scoreTarget(qNorm: string, target: string): TargetScore {
  if (target === qNorm) {
    return { score: 1000, type: 'exact', fuzzy: false };
  }

  if (target.startsWith(qNorm)) {
    return { score: 800 + (qNorm.length / target.length) * 100, type: 'prefix', fuzzy: false };
  }

  // Any word starts with the query (e.g. "horizonte" -> "belo horizonte").
  // Normalized names use single spaces, so an indexOf check avoids allocating
  // an array with split() for every city.
  if (target.indexOf(' ' + qNorm) !== -1) {
    return { score: 700 + (qNorm.length / target.length) * 80, type: 'word', fuzzy: false };
  }

  if (qNorm.length >= 3 && isSubsequence(qNorm, target)) {
    const ratio = qNorm.length / target.length;
    const startsWithSame = qNorm[0] === target[0];
    return {
      score: 520 + ratio * 150 + (startsWithSame ? 60 : 0),
      type: 'subsequence',
      fuzzy: true,
    };
  }

  const jw = jaroWinkler(qNorm, target);
  if (jw >= 0.82) {
    return { score: jw * 560, type: 'jaro_winkler', fuzzy: true };
  }

  // A length difference greater than 3 can never satisfy lev <= 3.
  if (qNorm.length >= 4 && Math.abs(qNorm.length - target.length) <= 3) {
    const maxLen = Math.max(qNorm.length, target.length);
    const lev = levenshteinDistance(qNorm, target);
    if (lev <= 2 || (maxLen >= 8 && lev <= 3)) {
      return { score: (1 - lev / maxLen) * 500, type: 'levenshtein', fuzzy: true };
    }
  }

  return { score: 0, type: 'levenshtein', fuzzy: true };
}

/**
 * Search local city database with typo tolerance and fuzzy matching.
 * Matches exact, prefix, subsequence (e.g. "arque" -> "ariquemes"),
 * Jaro-Winkler, and Levenshtein distance.
 */
export function searchLocalFuzzyCities(query: string, maxResults: number = 8): FuzzyMatchItem[] {
  const qNorm = normalizeCityName(query);
  if (!qNorm || qNorm.length < 2) return [];

  const indexed = getSearchIndex();
  const results: FuzzyMatchItem[] = [];

  for (let i = 0; i < indexed.length; i++) {
    const { item, norm, altNorm } = indexed[i];

    const best = scoreTarget(qNorm, norm);
    let bestScore = best.score;
    let matchType = best.type;
    let isFuzzy = best.fuzzy;

    if (altNorm) {
      const alt = scoreTarget(qNorm, altNorm);
      if (alt.score > bestScore) {
        bestScore = alt.score;
        matchType = alt.type;
        isFuzzy = alt.fuzzy;
      }
    }

    // Constant bonus, applied once instead of once per target.
    if (item.isCapital) bestScore += 20;

    if (bestScore >= 420) {
      const city: City = {
        id: item.id,
        name: item.name,
        latitude: item.latitude,
        longitude: item.longitude,
        elevation: item.elevation,
        country: item.country,
        countryCode: item.countryCode,
        admin1: item.admin1,
        timezone: item.timezone,
        population: item.population,
        isCapital: item.isCapital,
        isFuzzy,
        fuzzyMatchedFrom: isFuzzy ? query.trim() : undefined,
      };

      results.push({
        city,
        score: bestScore,
        isFuzzy,
        matchType,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}
