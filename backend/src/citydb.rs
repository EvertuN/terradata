use std::collections::HashSet;

use anyhow::{Context, Result};
use serde::Deserialize;

use crate::{
    models::{City, NearbyCity},
    util::{bearing, haversine_km, normalize_city_name},
};

const CITIES_JSON: &str = include_str!("../data/cities.json");
const FUZZY_THRESHOLD: f64 = 420.0;
const EXACT_SCORE: f64 = 1000.0;

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RawCity {
    id: i64,
    name: String,
    #[serde(default)]
    alt_name: Option<String>,
    #[serde(default)]
    admin1: String,
    #[serde(default)]
    country: String,
    #[serde(default)]
    country_code: String,
    latitude: f64,
    longitude: f64,
    #[serde(default)]
    timezone: String,
    #[serde(default)]
    elevation: f64,
    #[serde(default)]
    population: i64,
    #[serde(default)]
    is_capital: bool,
}

#[derive(Debug, Clone)]
struct IndexedCity {
    city: City,
    normalized: String,
    alt_normalized: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ScoredCity {
    pub city: City,
    pub score: f64,
}

/// Immutable in-memory city index. 5.6k municipalities plus major world cities
/// are parsed once at boot and normalized once, so every keystroke is a pure CPU
/// lookup with zero upstream calls.
pub struct CityDb {
    cities: Vec<IndexedCity>,
}

impl CityDb {
    pub fn load() -> Result<Self> {
        let raw: Vec<RawCity> =
            serde_json::from_str(CITIES_JSON).context("failed to parse embedded cities.json")?;

        let cities: Vec<IndexedCity> = raw
            .into_iter()
            .map(|raw| {
                let normalized = normalize_city_name(&raw.name);
                let alt_normalized = raw
                    .alt_name
                    .as_deref()
                    .map(normalize_city_name)
                    .filter(|value| !value.is_empty());

                IndexedCity {
                    city: City {
                        id: raw.id,
                        name: raw.name,
                        latitude: raw.latitude,
                        longitude: raw.longitude,
                        elevation: raw.elevation,
                        country: raw.country,
                        country_code: raw.country_code.to_ascii_lowercase(),
                        admin1: raw.admin1,
                        timezone: if raw.timezone.is_empty() {
                            "UTC".to_string()
                        } else {
                            raw.timezone
                        },
                        population: raw.population,
                        is_capital: Some(raw.is_capital),
                        is_fuzzy: None,
                        fuzzy_matched_from: None,
                    },
                    normalized,
                    alt_normalized,
                }
            })
            .collect();

        if cities.len() < 1_000 {
            anyhow::bail!(
                "embedded city database is suspiciously small: {}",
                cities.len()
            );
        }

        Ok(Self { cities })
    }

    pub fn len(&self) -> usize {
        self.cities.len()
    }

    pub fn search(&self, query: &str, max_results: usize) -> Vec<ScoredCity> {
        let query_normalized = normalize_city_name(query);
        if query_normalized.len() < 2 {
            return Vec::new();
        }

        let mut results = Vec::new();
        for item in &self.cities {
            let mut best: Option<(f64, bool)> = None;

            if let Some(score) = match_score(&query_normalized, &item.normalized) {
                best = Some(score);
            }
            if let Some(alt) = item.alt_normalized.as_deref() {
                if let Some(score) = match_score(&query_normalized, alt) {
                    if best.map(|(current, _)| score.0 > current).unwrap_or(true) {
                        best = Some(score);
                    }
                }
            }

            let Some((mut score, fuzzy)) = best else {
                continue;
            };
            if score < FUZZY_THRESHOLD {
                continue;
            }
            if item.city.is_capital == Some(true) {
                score += 20.0;
            }

            let mut city = item.city.clone();
            city.is_fuzzy = Some(fuzzy);
            city.fuzzy_matched_from = fuzzy.then(|| query.trim().to_string());
            results.push(ScoredCity { city, score });
        }

        results.sort_by(|a, b| {
            b.score
                .total_cmp(&a.score)
                .then_with(|| b.city.population.cmp(&a.city.population))
        });
        results.truncate(max_results);
        results
    }

    /// Free, offline nearby-city resolution. This is the first source before any
    /// external API is even considered.
    pub fn nearest(
        &self,
        lat: f64,
        lon: f64,
        min_km: f64,
        max_km: f64,
        exclude_name: &str,
        limit: usize,
    ) -> Vec<NearbyCity> {
        let exclude = normalize_city_name(exclude_name);
        let mut seen = HashSet::new();
        let mut candidates = Vec::new();

        for item in &self.cities {
            if item.normalized == exclude {
                continue;
            }
            let distance_km = haversine_km(lat, lon, item.city.latitude, item.city.longitude);
            if distance_km < min_km || distance_km > max_km {
                continue;
            }
            if !seen.insert(item.normalized.clone()) {
                continue;
            }

            candidates.push(NearbyCity {
                id: Some(item.city.id),
                name: item.city.name.clone(),
                region: item.city.admin1.clone(),
                country: item.city.country.clone(),
                country_code: item.city.country_code.clone(),
                latitude: item.city.latitude,
                longitude: item.city.longitude,
                population: (item.city.population > 0).then_some(item.city.population),
                distance_km: distance_km.round() as i32,
                direction: bearing(lat, lon, item.city.latitude, item.city.longitude),
            });
        }

        candidates.sort_by_key(|city| city.distance_km);
        candidates.truncate(limit);
        candidates
    }

    /// Offline fallback for places where the nearest municipality list is sparse.
    pub fn by_admin1(
        &self,
        admin1: &str,
        lat: f64,
        lon: f64,
        exclude_name: &str,
        limit: usize,
    ) -> Vec<NearbyCity> {
        let admin1 = normalize_city_name(admin1);
        if admin1.is_empty() {
            return Vec::new();
        }

        let exclude = normalize_city_name(exclude_name);
        let mut seen = HashSet::new();
        let mut candidates = Vec::new();

        for item in &self.cities {
            if item.normalized == exclude
                || normalize_city_name(&item.city.admin1) != admin1
                || !seen.insert(item.normalized.clone())
            {
                continue;
            }

            let distance_km = haversine_km(lat, lon, item.city.latitude, item.city.longitude);
            if !(4.0..=180.0).contains(&distance_km) {
                continue;
            }

            candidates.push(NearbyCity {
                id: Some(item.city.id),
                name: item.city.name.clone(),
                region: item.city.admin1.clone(),
                country: item.city.country.clone(),
                country_code: item.city.country_code.clone(),
                latitude: item.city.latitude,
                longitude: item.city.longitude,
                population: (item.city.population > 0).then_some(item.city.population),
                distance_km: distance_km.round() as i32,
                direction: bearing(lat, lon, item.city.latitude, item.city.longitude),
            });
        }

        candidates.sort_by_key(|city| city.distance_km);
        candidates.truncate(limit);
        candidates
    }
}

fn match_score(query: &str, target: &str) -> Option<(f64, bool)> {
    if query.is_empty() || target.is_empty() {
        return None;
    }

    if target == query {
        return Some((EXACT_SCORE, false));
    }

    let ratio = query.len() as f64 / target.len() as f64;

    if target.starts_with(query) {
        return Some((800.0 + ratio * 100.0, false));
    }

    if target.split(' ').any(|word| word.starts_with(query)) {
        return Some((700.0 + ratio * 80.0, false));
    }

    if query.len() >= 3 && is_subsequence(query, target) {
        let bonus = if query.as_bytes()[0] == target.as_bytes()[0] {
            60.0
        } else {
            0.0
        };
        return Some((520.0 + ratio * 150.0 + bonus, true));
    }

    let jaro = jaro_winkler(query, target);
    if jaro >= 0.82 {
        return Some((jaro * 560.0, true));
    }

    if query.len() >= 4 {
        let max_len = query.len().max(target.len());
        let distance = levenshtein(query, target);
        if distance <= 2 || (max_len >= 8 && distance <= 3) {
            return Some(((1.0 - distance as f64 / max_len as f64) * 500.0, true));
        }
    }

    None
}

fn is_subsequence(needle: &str, haystack: &str) -> bool {
    let needle = needle.as_bytes();
    let haystack = haystack.as_bytes();
    let mut index = 0;

    for byte in haystack {
        if index < needle.len() && needle[index] == *byte {
            index += 1;
        }
        if index == needle.len() {
            return true;
        }
    }

    false
}

fn jaro_winkler(left: &str, right: &str) -> f64 {
    let left = left.as_bytes();
    let right = right.as_bytes();
    let jaro = jaro(left, right);

    let mut prefix = 0;
    for index in 0..4.min(left.len()).min(right.len()) {
        if left[index] == right[index] {
            prefix += 1;
        } else {
            break;
        }
    }

    jaro + prefix as f64 * 0.1 * (1.0 - jaro)
}

fn jaro(left: &[u8], right: &[u8]) -> f64 {
    if left == right {
        return 1.0;
    }
    if left.is_empty() || right.is_empty() {
        return 0.0;
    }

    let match_distance = (left.len().max(right.len()) / 2).saturating_sub(1);
    let mut left_matches = vec![false; left.len()];
    let mut right_matches = vec![false; right.len()];
    let mut matches = 0usize;

    for (left_index, left_byte) in left.iter().enumerate() {
        let start = left_index.saturating_sub(match_distance);
        let end = (left_index + match_distance + 1).min(right.len());

        for right_index in start..end {
            if right_matches[right_index] || *left_byte != right[right_index] {
                continue;
            }
            left_matches[left_index] = true;
            right_matches[right_index] = true;
            matches += 1;
            break;
        }
    }

    if matches == 0 {
        return 0.0;
    }

    let mut transpositions = 0usize;
    let mut right_index = 0usize;
    for (left_index, matched) in left_matches.iter().enumerate() {
        if !matched {
            continue;
        }
        while !right_matches[right_index] {
            right_index += 1;
        }
        if left[left_index] != right[right_index] {
            transpositions += 1;
        }
        right_index += 1;
    }

    let matches = matches as f64;
    (matches / left.len() as f64
        + matches / right.len() as f64
        + (matches - transpositions as f64 / 2.0) / matches)
        / 3.0
}

fn levenshtein(left: &str, right: &str) -> usize {
    let left = left.as_bytes();
    let right = right.as_bytes();

    if left.is_empty() {
        return right.len();
    }
    if right.is_empty() {
        return left.len();
    }

    let mut previous: Vec<usize> = (0..=right.len()).collect();
    let mut current = vec![0usize; right.len() + 1];

    for (left_index, left_byte) in left.iter().enumerate() {
        current[0] = left_index + 1;
        for (right_index, right_byte) in right.iter().enumerate() {
            let cost = usize::from(left_byte != right_byte);
            current[right_index + 1] = (previous[right_index + 1] + 1)
                .min(current[right_index] + 1)
                .min(previous[right_index] + cost);
        }
        std::mem::swap(&mut previous, &mut current);
    }

    previous[right.len()]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn db() -> CityDb {
        CityDb::load().expect("embedded city database must load")
    }

    #[test]
    fn loads_the_brazilian_municipalities() {
        assert!(db().len() >= 5_500);
    }

    #[test]
    fn finds_exact_and_accented_cities() {
        let results = db().search("São Paulo", 5);
        assert!(results.iter().any(|item| item.city.name == "São Paulo"));
    }

    #[test]
    fn tolerates_typos() {
        let results = db().search("Florianopois", 5);
        assert!(results
            .iter()
            .any(|item| item.city.name.starts_with("Florian")));
    }

    #[test]
    fn tolerates_subsequence_queries() {
        let results = db().search("Arque", 5);
        assert!(results
            .iter()
            .any(|item| item.city.name.starts_with("Ariquemes")));
    }

    #[test]
    fn finds_nearby_municipalities_without_network() {
        let results = db().nearest(-23.55, -46.63, 4.0, 140.0, "São Paulo", 8);
        assert!(!results.is_empty());
        assert!(results.iter().all(|city| city.name != "São Paulo"));
    }
}
