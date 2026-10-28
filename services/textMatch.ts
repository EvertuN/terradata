/**
 * Pure string-matching helpers (no city database dependency).
 *
 * Kept in a separate module so that `services/api.ts` can import
 * `normalizeCityName` without pulling the ~400 KB city database into the
 * initial bundle. The database itself is loaded lazily by `fuzzySearch.ts`.
 */

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
 * Calculates Jaro Similarity between two strings.
 * Uses typed arrays to avoid per-call array allocations.
 */
export function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const l1 = s1.length;
  const l2 = s2.length;
  if (l1 === 0 || l2 === 0) return 0;

  const matchDist = Math.max(0, Math.floor(Math.max(l1, l2) / 2) - 1);
  const s1Matches = new Uint8Array(l1);
  const s2Matches = new Uint8Array(l2);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < l1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, l2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = 1;
      s2Matches[j] = 1;
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
 * Standard Levenshtein Distance for edit distance calculation.
 * Two-row dynamic programming: O(min(m, n)) memory instead of O(m * n).
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    const code = s1.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = code === s2.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1;
      const ins = curr[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      curr[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[n];
}
