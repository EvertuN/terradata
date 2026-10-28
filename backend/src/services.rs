use std::{collections::HashSet, sync::Arc};

use crate::{
    cache::get_or_fetch,
    citydb::ScoredCity,
    error::ApiError,
    models::{
        AirQualityData, City, CityDashboard, CitySummary, NearbyCity, PointOfInterest, WeatherData,
    },
    state::AppState,
    util::{city_key, normalize_city_name, normalize_coords},
};

/// Inputs for one aggregate dashboard request. A struct keeps the handler and
/// service signatures readable and avoids positional-argument mistakes.
pub struct DashboardRequest<'a> {
    pub lat: f64,
    pub lon: f64,
    pub city_name: &'a str,
    pub admin1: &'a str,
    pub country: &'a str,
    pub country_code: &'a str,
    pub limit: usize,
}

impl AppState {
    /// Local fuzzy search first. Open-Meteo is only called when the embedded
    /// database cannot produce a confident answer, which removes most autocomplete
    /// traffic from the upstream API.
    pub async fn search_cities(&self, query: &str, limit: usize) -> Vec<City> {
        let query = query.trim();
        let limit = limit.clamp(1, 20);
        if query.chars().count() < 2 {
            return Vec::new();
        }

        let normalized = normalize_city_name(query);
        if normalized.is_empty() {
            return Vec::new();
        }

        let key = format!("search:{normalized}:{limit}");
        if let Some(cached) = self.cache.search.get(&key).await {
            return (*cached).clone();
        }

        let local = self.citydb.search(query, 8);
        let local_is_confident = local.len() >= 3
            || local
                .first()
                .map(|item| item.score >= 520.0)
                .unwrap_or(false);

        let cache = self.cache.search.clone();
        let negative = self.cache.negative.clone();
        let upstream = self.upstream.clone();
        let query_owned = query.to_string();
        let normalized_for_fetch = normalized.clone();
        let local_for_fetch = local;

        let result = get_or_fetch(&cache, &negative, key, async move {
            if local_is_confident {
                let cities = local_for_fetch
                    .into_iter()
                    .take(limit)
                    .map(|item| item.city)
                    .collect::<Vec<_>>();
                return Ok(cities);
            }

            let open_meteo = match upstream.geocode_search(&query_owned, 10).await {
                Ok(cities) => cities,
                Err(error) => {
                    tracing::warn!(error = %error, query = %query_owned, "open-meteo geocoding failed");
                    Vec::new()
                }
            };

            let merged = merge_candidates(
                local_for_fetch,
                open_meteo,
                &normalized_for_fetch,
                limit,
            );
            if merged.is_empty() {
                Err(ApiError::NotFound("no city found".to_string()))
            } else {
                Ok(merged)
            }
        })
        .await;

        result.map(|cities| (*cities).clone()).unwrap_or_default()
    }

    pub async fn weather(&self, lat: f64, lon: f64) -> Option<Arc<WeatherData>> {
        let (lat, lon, coords) = normalize_coords(lat, lon);
        let cache = self.cache.weather.clone();
        let negative = self.cache.negative.clone();
        let upstream = self.upstream.clone();

        get_or_fetch(&cache, &negative, format!("weather:{coords}"), async move {
            upstream.forecast(lat, lon).await
        })
        .await
    }

    pub async fn air_quality(&self, lat: f64, lon: f64) -> Option<Arc<AirQualityData>> {
        let (lat, lon, coords) = normalize_coords(lat, lon);
        let cache = self.cache.air_quality.clone();
        let negative = self.cache.negative.clone();
        let upstream = self.upstream.clone();

        get_or_fetch(&cache, &negative, format!("air:{coords}"), async move {
            upstream.air_quality(lat, lon).await
        })
        .await
    }

    pub async fn summary(&self, city_name: &str, fallback_name: &str) -> Option<Arc<CitySummary>> {
        if city_name.trim().is_empty() {
            return None;
        }

        let key = format!(
            "wiki:{}:{}",
            normalize_city_name(city_name),
            normalize_city_name(fallback_name)
        );
        let cache = self.cache.summary.clone();
        let negative = self.cache.negative.clone();
        let upstream = self.upstream.clone();
        let city_name = city_name.to_string();
        let fallback_name = fallback_name.to_string();

        get_or_fetch(&cache, &negative, key, async move {
            upstream.summary(&city_name, &fallback_name).await
        })
        .await
    }

    pub async fn pois(
        &self,
        lat: f64,
        lon: f64,
        limit: usize,
        city_name: &str,
        country_code: &str,
    ) -> Arc<Vec<PointOfInterest>> {
        let (lat, lon, coords) = normalize_coords(lat, lon);
        let limit = limit.clamp(1, 24);
        let key = format!(
            "pois:{coords}:{}:{limit}:{}",
            normalize_city_name(city_name),
            country_code.to_ascii_lowercase()
        );
        let cache = self.cache.pois.clone();
        let negative = self.cache.negative.clone();
        let upstream = self.upstream.clone();
        let city_name = city_name.to_string();
        let country_code = country_code.to_string();

        get_or_fetch(&cache, &negative, key, async move {
            upstream
                .pois(lat, lon, limit, &city_name, &country_code)
                .await
        })
        .await
        .unwrap_or_else(|| Arc::new(Vec::new()))
    }

    pub async fn nearby(
        &self,
        lat: f64,
        lon: f64,
        city_name: &str,
        admin1: &str,
        country: &str,
        country_code: &str,
    ) -> Arc<Vec<NearbyCity>> {
        let (lat, lon, coords) = normalize_coords(lat, lon);
        let key = format!(
            "nearby:{coords}:{}:{}:{}:{}",
            normalize_city_name(city_name),
            normalize_city_name(admin1),
            normalize_city_name(country),
            country_code.to_ascii_lowercase()
        );
        let cache = self.cache.nearby.clone();
        let negative = self.cache.negative.clone();
        let upstream = self.upstream.clone();
        let citydb = self.citydb.clone();
        let city_name = city_name.to_string();
        let admin1 = admin1.to_string();
        let country = country.to_string();
        let country_code = country_code.to_string();

        get_or_fetch(&cache, &negative, key, async move {
            let mut cities = citydb.nearest(lat, lon, 4.0, 140.0, &city_name, 8);

            if cities.len() < 3 && upstream.enable_geodb {
                match upstream
                    .geodb_nearby(lat, lon, &city_name, &admin1, &country, &country_code)
                    .await
                {
                    Ok(items) => append_unique(&mut cities, items, 8),
                    Err(error) => tracing::warn!(error = %error, "geodb nearby failed"),
                }
            }

            // The embedded database is Brazil-first, with a small set of
            // global cities. For a foreign city this still gives a useful
            // offline fallback (e.g. Paris -> Brussels/London/Amsterdam)
            // without spending an external API call.
            if cities.len() < 3 {
                let global = citydb.nearest(lat, lon, 4.0, 600.0, &city_name, 8);
                append_unique(&mut cities, global, 8);
            }

            // For foreign cities, Wikidata is the slowest and least reliable
            // source. If the offline global-city fallback already found
            // something, keep it instead of waiting for another query.
            let needs_wikidata = if country_code.eq_ignore_ascii_case("br") {
                cities.len() < 3
            } else {
                cities.is_empty()
            };
            if needs_wikidata {
                match upstream
                    .wikidata_nearby(lat, lon, &city_name, &admin1, &country, &country_code)
                    .await
                {
                    Ok(items) => append_unique(&mut cities, items, 8),
                    Err(error) => tracing::warn!(error = %error, "wikidata nearby failed"),
                }
            }

            if cities.len() < 3 && !admin1.is_empty() {
                let extra = citydb.by_admin1(&admin1, lat, lon, &city_name, 8);
                append_unique(&mut cities, extra, 8);
            }

            cities.sort_by_key(|city| city.distance_km);
            cities.truncate(8);

            if cities.is_empty() {
                Err(ApiError::NotFound("no nearby city found".to_string()))
            } else {
                Ok(cities)
            }
        })
        .await
        .unwrap_or_else(|| Arc::new(Vec::new()))
    }

    /// Nominatim is strictly rate-limited upstream. When it is unavailable we
    /// still return a usable city using the embedded database, so GPS never fails
    /// just because a public API is having a bad day.
    pub async fn reverse_geocode(&self, lat: f64, lon: f64, timezone: &str) -> Option<City> {
        let timezone = if timezone.trim().is_empty() {
            "UTC"
        } else {
            timezone
        };
        let (_, _, coords) = normalize_coords(lat, lon);
        let key = format!("reverse:{coords}:{timezone}");

        if let Some(cached) = self.cache.reverse.get(&key).await {
            return Some((*cached).clone());
        }

        if self.cache.negative.get(&key).await.is_none() {
            if let Some(upstream) = self.reverse_from_upstream(lat, lon, timezone, &key).await {
                return Some(upstream);
            }
        }

        let nearest = self.citydb.nearest(lat, lon, 0.0, 50.0, "", 1);
        if let Some(nearest) = nearest.into_iter().next() {
            return Some(City {
                id: (lat * 1000.0 + lon * 1000.0).round() as i64,
                name: nearest.name,
                latitude: lat,
                longitude: lon,
                elevation: 0.0,
                country: nearest.country,
                country_code: nearest.country_code,
                admin1: nearest.region,
                timezone: timezone.to_string(),
                population: 0,
                is_capital: None,
                is_fuzzy: None,
                fuzzy_matched_from: None,
            });
        }

        Some(City {
            id: (lat * 1000.0 + lon * 1000.0).round() as i64,
            name: "Local Atual".to_string(),
            latitude: lat,
            longitude: lon,
            elevation: 0.0,
            country: String::new(),
            country_code: String::new(),
            admin1: String::new(),
            timezone: timezone.to_string(),
            population: 0,
            is_capital: None,
            is_fuzzy: None,
            fuzzy_matched_from: None,
        })
    }

    async fn reverse_from_upstream(
        &self,
        lat: f64,
        lon: f64,
        timezone: &str,
        key: &str,
    ) -> Option<City> {
        match self.upstream.reverse_geocode(lat, lon, timezone).await {
            Ok(Some(city)) => {
                self.cache
                    .reverse
                    .insert(key.to_string(), Arc::new(city.clone()))
                    .await;
                Some(city)
            }
            Ok(None) => {
                self.cache.negative.insert(key.to_string(), ()).await;
                None
            }
            Err(error) => {
                tracing::warn!(error = %error, "nominatim reverse geocoding failed");
                self.cache.negative.insert(key.to_string(), ()).await;
                None
            }
        }
    }

    /// One request from the browser, five upstream calls in parallel on the server.
    pub async fn dashboard(&self, request: DashboardRequest<'_>) -> CityDashboard {
        let DashboardRequest {
            lat,
            lon,
            city_name,
            admin1,
            country,
            country_code,
            limit,
        } = request;

        let (weather, air_quality, summary, pois, nearby_cities) = tokio::join!(
            self.weather(lat, lon),
            self.air_quality(lat, lon),
            self.summary(city_name, admin1),
            self.pois(lat, lon, limit, city_name, country_code),
            self.nearby(lat, lon, city_name, admin1, country, country_code),
        );

        CityDashboard {
            weather,
            air_quality,
            summary,
            pois,
            nearby_cities,
        }
    }
}

fn merge_candidates(
    local: Vec<ScoredCity>,
    open_meteo: Vec<City>,
    query_normalized: &str,
    limit: usize,
) -> Vec<City> {
    let mut seen = HashSet::new();
    let mut candidates: Vec<(f64, City)> = Vec::new();

    for item in local {
        let key = city_key(&item.city.name, &item.city.admin1, &item.city.country_code);
        if !seen.insert(key) {
            continue;
        }

        let mut relevance = if item.score >= 1000.0 {
            2000.0
        } else {
            item.score
        };
        if item.city.country_code == "br" {
            relevance += 200.0;
        }
        if item.city.is_capital == Some(true) {
            relevance += 50.0;
        }

        candidates.push((relevance, item.city));
    }

    for city in open_meteo {
        let key = city_key(&city.name, &city.admin1, &city.country_code);
        if !seen.insert(key) {
            continue;
        }

        let city_normalized = normalize_city_name(&city.name);
        let mut relevance = 300.0;

        if city_normalized == query_normalized {
            if city.country_code == "br" {
                relevance = 2000.0;
            } else if city.population > 20_000
                || city.id == 2_988_507
                || city.timezone.starts_with("Europe/")
                || city.timezone.starts_with("America/New_York")
            {
                relevance = 1900.0;
            } else {
                relevance = 800.0;
            }
        } else if city_normalized.starts_with(query_normalized) {
            let ratio = query_normalized.len() as f64 / city_normalized.len() as f64;
            if city.country_code == "br" {
                relevance = 780.0 + ratio * 100.0;
            } else if city.population > 50_000 {
                relevance = 720.0 + ratio * 80.0;
            } else {
                relevance = 500.0 + ratio * 50.0;
            }
        }

        if city.country_code == "br" {
            relevance += 80.0;
        }
        // A major city can be returned under a translated name (e.g. Kyoto ->
        // "Quioto"). Population is the strongest signal that it outranks a
        // same-name village, airport or neighborhood.
        if city.population > 1_000_000 {
            relevance += 600.0;
        } else if city.population > 100_000 {
            relevance += 250.0;
        } else if city.population > 20_000 {
            relevance += 100.0;
        }

        candidates.push((relevance, city));
    }

    candidates.sort_by(|left, right| {
        right
            .0
            .total_cmp(&left.0)
            .then_with(|| right.1.population.cmp(&left.1.population))
    });
    candidates
        .into_iter()
        .take(limit)
        .map(|(_, city)| city)
        .collect()
}

fn append_unique(target: &mut Vec<NearbyCity>, items: Vec<NearbyCity>, limit: usize) {
    let mut seen: HashSet<String> = target
        .iter()
        .map(|city| normalize_city_name(&city.name))
        .collect();

    for city in items {
        if target.len() >= limit {
            break;
        }
        if seen.insert(normalize_city_name(&city.name)) {
            target.push(city);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn city(name: &str, population: i64, country_code: &str) -> City {
        City {
            id: population.max(1),
            name: name.to_string(),
            country_code: country_code.to_string(),
            population,
            ..City::default()
        }
    }

    #[test]
    fn population_outranks_a_same_name_village() {
        let open_meteo = vec![city("Kyoto", 0, "tz"), city("Quioto", 1_463_723, "jp")];

        let merged = merge_candidates(Vec::new(), open_meteo, "kyoto", 2);

        assert_eq!(merged[0].name, "Quioto");
    }
}
