import { City } from '../types';
import { getIndexedCities, IndexedCity } from './cityDatabase';

/**
 * Normalizes a string for fuzzy comparison:
 * - Decomposes unicode accents (e.g. "São" -> "sao")
 * - Lowercases
 * - Strips non-alphanumeric chars
 */
export function normalizeCityName(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if string `sub` is a subsequence of `target`.
 * For example, "arque" is a subsequence of "ariquemes".
 */
export function isSubsequence(sub: string, target: string): boolean {
  if (!sub || !target) return false;
  let i = 0;
  let j = 0;
  while (i < sub.length && j < target.length) {
    if (sub[i] === target[j]) {
      i++;
    }
    j++;
  }
  return i === sub.length;
}

/**
 * Calculates Jaro Similarity between two strings
 */
export function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const l1 = s1.length;
  const l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0;

  const matchDist = Math.max(0, Math.floor(Math.max(l1, l2) / 2) - 1);
  const s1Matches = new Array(l1).fill(false);
  const s2Matches = new Array(l2).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < l1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, l2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < l1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return ((matches / l1) + (matches / l2) + ((matches - transpositions / 2) / matches)) / 3;
}

/**
 * Calculates Jaro-Winkler Similarity with standard prefix scaling
 */
export function jaroWinkler(s1: string, s2: string): number {
  const jaro = jaroSimilarity(s1, s2);
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Standard Levenshtein Distance for edit distance calculation
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      if (s1[i - 1] === s2[j - 1]) {
        d[i][j] = d[i - 1][j - 1];
      } else {
        d[i][j] = Math.min(
          d[i - 1][j] + 1,      // deletion
          d[i][j - 1] + 1,      // insertion
          d[i - 1][j - 1] + 1   // substitution
        );
      }
    }
  }
  return d[m][n];
}

export interface FuzzyMatchItem {
  city: City;
  score: number;
  isFuzzy: boolean;
  matchType: 'exact' | 'prefix' | 'word' | 'subsequence' | 'jaro_winkler' | 'levenshtein';
}

/**
 * Search local city database with typo tolerance and fuzzy matching.
 * Matches exact, prefix, subsequence (e.g. "arque" -> "ariquemes"),
 * Jaro-Winkler, and Levenshtein distance.
 */
export function searchLocalFuzzyCities(query: string, maxResults: number = 8): FuzzyMatchItem[] {
  const qNorm = normalizeCityName(query);
  if (!qNorm || qNorm.length < 2) return [];

  const indexed = getIndexedCities();
  const results: FuzzyMatchItem[] = [];

  for (let i = 0; i < indexed.length; i++) {
    const item = indexed[i];
    const tNorm = normalizeCityName(item.name);
    const altNorm = item.altName ? normalizeCityName(item.altName) : null;

    let bestScore = 0;
    let matchType: FuzzyMatchItem['matchType'] = 'levenshtein';
    let isFuzzy = true;

    const targets = [tNorm, altNorm].filter(Boolean) as string[];

    for (const target of targets) {
      let score = 0;
      let type: FuzzyMatchItem['matchType'] = 'levenshtein';
      let fuzzy = true;

      // 1. Exact match
      if (target === qNorm) {
        score = 1000;
        type = 'exact';
        fuzzy = false;
      }
      // 2. Exact prefix match (e.g. "ariq" -> "ariquemes")
      else if (target.startsWith(qNorm)) {
        score = 800 + (qNorm.length / target.length) * 100;
        type = 'prefix';
        fuzzy = false;
      }
      // 3. Word starts with query (e.g. "horizonte" -> "belo horizonte")
      else if (target.split(' ').some(w => w.startsWith(qNorm))) {
        score = 700 + (qNorm.length / target.length) * 80;
        type = 'word';
        fuzzy = false;
      }
      // 4. Subsequence match (e.g. "arque" -> "ariquemes", "sao pao" -> "sao paulo")
      else if (qNorm.length >= 3 && isSubsequence(qNorm, target)) {
        const ratio = qNorm.length / target.length;
        const startsWithSame = qNorm[0] === target[0];
        score = 520 + ratio * 150 + (startsWithSame ? 60 : 0);
        type = 'subsequence';
        fuzzy = true;
      }
      // 5. Jaro-Winkler Similarity (handles typos, omissions, transpositions)
      else {
        const jw = jaroWinkler(qNorm, target);
        if (jw >= 0.82) {
          score = jw * 560;
          type = 'jaro_winkler';
          fuzzy = true;
        } else if (qNorm.length >= 4) {
          const maxLen = Math.max(qNorm.length, target.length);
          const lev = levenshteinDistance(qNorm, target);
          if (lev <= 2 || (maxLen >= 8 && lev <= 3)) {
            score = (1 - lev / maxLen) * 500;
            type = 'levenshtein';
            fuzzy = true;
          }
        }
      }

      // Tie-breakers: state capital bonus, query ratio bonus
      if (item.isCapital) score += 20;

      if (score > bestScore) {
        bestScore = score;
        matchType = type;
        isFuzzy = fuzzy;
      }
    }

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
        fuzzyMatchedFrom: isFuzzy ? query.trim() : undefined
      };

      results.push({
        city,
        score: bestScore,
        isFuzzy,
        matchType
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, maxResults);
}
