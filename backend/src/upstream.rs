use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
    time::{Duration, Instant},
};

use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::{Mutex, OwnedSemaphorePermit, Semaphore};

use crate::{
    config::Config,
    error::ApiError,
    models::{
        AirQualityData, AirQualityStatus, City, CitySummary, CurrentWeather, DailyForecast,
        HourlyForecast, NearbyCity, PointOfInterest, WeatherData,
    },
    util::{
        bearing, format_distance, haversine_km, is_bad_image, normalize_city_name, parse_wkt_point,
        round_1, round_i32,
    },
};

const MAX_BODY_BYTES: usize = 4 * 1024 * 1024;
const MAX_RETRIES: usize = 2;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
enum Host {
    OpenMeteo,
    OpenMeteoAir,
    Wikidata,
    Wikimedia,
    Nominatim,
    GeoDb,
}

pub struct Upstream {
    client: reqwest::Client,
    global: Arc<Semaphore>,
    hosts: Arc<HashMap<Host, Arc<HostLimiter>>>,
    pub enable_geodb: bool,
}

impl Upstream {
    pub fn new(config: &Config) -> Result<Self, ApiError> {
        let client = reqwest::Client::builder()
            .user_agent(config.user_agent.clone())
            .connect_timeout(config.connect_timeout)
            .timeout(config.request_timeout)
            .pool_max_idle_per_host(8)
            .tcp_keepalive(Duration::from_secs(30))
            .gzip(true)
            .brotli(true)
            .build()
            .map_err(|error| ApiError::Internal(error.to_string()))?;

        let mut hosts = HashMap::new();
        // Conservative per-host budgets. They protect public/free APIs from a
        // traffic spike far more effectively than a single global limit.
        hosts.insert(Host::OpenMeteo, Arc::new(HostLimiter::new(8, 300, 0)));
        hosts.insert(Host::OpenMeteoAir, Arc::new(HostLimiter::new(4, 120, 0)));
        hosts.insert(Host::Wikidata, Arc::new(HostLimiter::new(4, 30, 0)));
        hosts.insert(Host::Wikimedia, Arc::new(HostLimiter::new(6, 120, 0)));
        hosts.insert(Host::Nominatim, Arc::new(HostLimiter::new(1, 60, 1)));
        hosts.insert(Host::GeoDb, Arc::new(HostLimiter::new(2, 20, 0)));

        Ok(Self {
            client,
            global: Arc::new(Semaphore::new(config.upstream_concurrency.max(1))),
            hosts: Arc::new(hosts),
            enable_geodb: config.enable_geodb,
        })
    }

    async fn fetch_json(
        &self,
        host: Host,
        url: &str,
        timeout: Duration,
    ) -> Result<Value, ApiError> {
        self.fetch_json_with_retries(host, url, timeout, MAX_RETRIES)
            .await
    }

    async fn fetch_json_with_retries(
        &self,
        host: Host,
        url: &str,
        timeout: Duration,
        max_retries: usize,
    ) -> Result<Value, ApiError> {
        let limiter = self
            .hosts
            .get(&host)
            .cloned()
            .ok_or_else(|| ApiError::Internal("missing host limiter".to_string()))?;

        let mut attempt = 0usize;
        loop {
            let _host_permit = limiter.acquire().await?;
            let _global_permit = self
                .global
                .clone()
                .acquire_owned()
                .await
                .map_err(|_| ApiError::Internal("upstream semaphore closed".to_string()))?;

            let response = self.client.get(url).timeout(timeout).send().await;

            match response {
                Ok(response) => {
                    let status = response.status();
                    if status.is_success() {
                        let bytes = response
                            .bytes()
                            .await
                            .map_err(|error| ApiError::Upstream(error.to_string()))?;
                        if bytes.len() > MAX_BODY_BYTES {
                            return Err(ApiError::Decode(
                                "upstream response too large".to_string(),
                            ));
                        }
                        return serde_json::from_slice(&bytes).map_err(|error| {
                            ApiError::Decode(format!("invalid JSON from {url}: {error}"))
                        });
                    }

                    if (status.as_u16() == 429 || status.is_server_error()) && attempt < max_retries
                    {
                        let delay = retry_after(&response).unwrap_or_else(|| backoff(attempt));
                        attempt += 1;
                        tracing::warn!(
                            host = ?host,
                            status = status.as_u16(),
                            attempt,
                            "upstream throttled/failed; retrying"
                        );
                        tokio::time::sleep(delay).await;
                        continue;
                    }

                    return Err(ApiError::UpstreamStatus(status.as_u16()));
                }
                Err(error) => {
                    let retryable = error.is_timeout() || error.is_connect() || error.is_request();
                    if retryable && attempt < max_retries {
                        let delay = backoff(attempt);
                        attempt += 1;
                        tracing::warn!(
                            host = ?host,
                            attempt,
                            error = %error,
                            "upstream transport error; retrying"
                        );
                        tokio::time::sleep(delay).await;
                        continue;
                    }
                    return Err(ApiError::Upstream(error.to_string()));
                }
            }
        }
    }

    pub async fn geocode_search(&self, query: &str, count: usize) -> Result<Vec<City>, ApiError> {
        let url = format!(
            "https://geocoding-api.open-meteo.com/v1/search?name={}&count={}&language=pt&format=json",
            urlencoding::encode(query),
            count.clamp(1, 20)
        );
        let value = self
            .fetch_json(Host::OpenMeteo, &url, Duration::from_secs(6))
            .await?;
        let response: OpenMeteoGeocode =
            serde_json::from_value(value).map_err(|error| decode("geocoding", error))?;

        Ok(response
            .results
            .unwrap_or_default()
            .into_iter()
            .filter_map(|city| {
                let name = city.name?;
                // Open-Meteo returns airports, heliports, palaces and other
                // landmarks for name matches. Keep populated places only.
                if !is_populated_place(city.feature_code.as_deref()) {
                    return None;
                }
                Some(City {
                    id: city.id.unwrap_or(0),
                    name,
                    latitude: city.latitude?,
                    longitude: city.longitude?,
                    elevation: city.elevation.unwrap_or(0.0),
                    country: city.country.unwrap_or_default(),
                    country_code: city.country_code.unwrap_or_default().to_ascii_lowercase(),
                    admin1: city.admin1.unwrap_or_default(),
                    timezone: city.timezone.unwrap_or_else(|| "UTC".to_string()),
                    population: city.population.unwrap_or(0),
                    is_capital: None,
                    is_fuzzy: None,
                    fuzzy_matched_from: None,
                })
            })
            .collect())
    }

    pub async fn forecast(&self, lat: f64, lon: f64) -> Result<WeatherData, ApiError> {
        let url = format!(
            "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}\
             &current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure\
             &hourly=temperature_2m,precipitation_probability,weather_code\
             &daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max\
             &timezone=auto"
        );
        let value = self
            .fetch_json(Host::OpenMeteo, &url, Duration::from_secs(7))
            .await?;
        let response: OpenMeteoForecast =
            serde_json::from_value(value).map_err(|error| decode("forecast", error))?;
        let current = response.current.ok_or_else(|| {
            ApiError::Decode("forecast response missing current block".to_string())
        })?;

        let mut daily = Vec::new();
        if let Some(block) = response.daily {
            for index in 0..block.time.len() {
                daily.push(DailyForecast {
                    date: block.time[index].clone(),
                    weather_code: opt_i32(&block.weather_code, index),
                    temp_max: round_i32(opt_f64(&block.temperature_2m_max, index)),
                    temp_min: round_i32(opt_f64(&block.temperature_2m_min, index)),
                    sunrise: opt_string(&block.sunrise, index),
                    sunset: opt_string(&block.sunset, index),
                    uv_index_max: opt_f64(&block.uv_index_max, index),
                });
            }
        }

        let hourly = response.hourly.unwrap_or_default();
        let hours = hourly.time.len().min(24);

        Ok(WeatherData {
            current: CurrentWeather {
                temperature: round_i32(current.temperature_2m.unwrap_or(0.0)),
                apparent_temperature: round_i32(current.apparent_temperature.unwrap_or(0.0)),
                humidity: round_i32(current.relative_humidity_2m.unwrap_or(0.0)),
                precipitation: current.precipitation.unwrap_or(0.0),
                weather_code: current.weather_code.unwrap_or(0),
                wind_speed: round_i32(current.wind_speed_10m.unwrap_or(0.0)),
                wind_direction: current.wind_direction_10m.unwrap_or(0.0),
                surface_pressure: round_i32(current.surface_pressure.unwrap_or(1013.0)),
                time: current.time.unwrap_or_default(),
            },
            daily,
            hourly: HourlyForecast {
                times: hourly.time.iter().take(hours).cloned().collect(),
                temperatures: (0..hours)
                    .map(|index| round_i32(opt_f64(&hourly.temperature_2m, index)))
                    .collect(),
                precipitation_probabilities: (0..hours)
                    .map(|index| opt_f64(&hourly.precipitation_probability, index))
                    .collect(),
                weather_codes: (0..hours)
                    .map(|index| opt_i32(&hourly.weather_code, index))
                    .collect(),
            },
        })
    }

    pub async fn air_quality(&self, lat: f64, lon: f64) -> Result<AirQualityData, ApiError> {
        let url = format!(
            "https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}\
             &current=european_aqi,us_aqi,pm10,pm2_5,nitrogen_dioxide,ozone"
        );
        let value = self
            .fetch_json(Host::OpenMeteoAir, &url, Duration::from_secs(6))
            .await?;
        let response: OpenMeteoAir =
            serde_json::from_value(value).map_err(|error| decode("air quality", error))?;
        let current = response
            .current
            .ok_or_else(|| ApiError::Decode("air quality response missing current".to_string()))?;

        let european_aqi = current.european_aqi.unwrap_or(0.0);
        let us_aqi = current.us_aqi.unwrap_or(0.0);
        let reference = if us_aqi > 0.0 { us_aqi } else { european_aqi };

        let status = if reference > 150.0 {
            AirQualityStatus {
                label: "Insalubre".to_string(),
                color: "#ef4444".to_string(),
                recommendation:
                    "Evite atividades ao ar livre. Pessoas sensíveis devem permanecer em locais fechados."
                        .to_string(),
            }
        } else if reference > 100.0 {
            AirQualityStatus {
                label: "Moderada / Sensível".to_string(),
                color: "#f97316".to_string(),
                recommendation:
                    "Grupos sensíveis podem sentir desconforto. Reduza esforços prolongados ao ar livre."
                        .to_string(),
            }
        } else if reference > 50.0 {
            AirQualityStatus {
                label: "Aceitável".to_string(),
                color: "#eab308".to_string(),
                recommendation:
                    "Qualidade do ar aceitável; pequenos grupos sensíveis podem ter leve irritação."
                        .to_string(),
            }
        } else {
            AirQualityStatus {
                label: "Excelente".to_string(),
                color: "#10b981".to_string(),
                recommendation: "Qualidade do ar ideal para todas as atividades ao ar livre."
                    .to_string(),
            }
        };

        Ok(AirQualityData {
            european_aqi: round_1(european_aqi),
            us_aqi: round_1(us_aqi),
            pm10: round_1(current.pm10.unwrap_or(0.0)),
            pm25: round_1(current.pm2_5.unwrap_or(0.0)),
            nitrogen_dioxide: round_1(current.nitrogen_dioxide.unwrap_or(0.0)),
            ozone: round_1(current.ozone.unwrap_or(0.0)),
            status,
        })
    }

    pub async fn reverse_geocode(
        &self,
        lat: f64,
        lon: f64,
        timezone: &str,
    ) -> Result<Option<City>, ApiError> {
        let url = format!(
            "https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lon}&format=json&accept-language=pt"
        );

        match self
            .fetch_json(Host::Nominatim, &url, Duration::from_secs(8))
            .await
        {
            Ok(value) => {
                let address = value.get("address").cloned().unwrap_or_else(|| json!({}));
                let name = ["city", "town", "municipality", "village", "county"]
                    .iter()
                    .find_map(|key| address.get(*key).and_then(Value::as_str))
                    .unwrap_or("Local Atual");

                Ok(Some(City {
                    id: (lat * 1000.0 + lon * 1000.0).round() as i64,
                    name: name.to_string(),
                    latitude: lat,
                    longitude: lon,
                    elevation: 0.0,
                    country: address
                        .get("country")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_string(),
                    country_code: address
                        .get("country_code")
                        .and_then(Value::as_str)
                        .unwrap_or("")
                        .to_ascii_lowercase(),
                    admin1: address
                        .get("state")
                        .and_then(Value::as_str)
                        .or_else(|| address.get("region").and_then(Value::as_str))
                        .unwrap_or("")
                        .to_string(),
                    timezone: timezone.to_string(),
                    population: 0,
                    is_capital: None,
                    is_fuzzy: None,
                    fuzzy_matched_from: None,
                }))
            }
            Err(ApiError::UpstreamStatus(404)) => Ok(None),
            Err(error) => Err(error),
        }
    }

    async fn wiki_summary(
        &self,
        language: &str,
        title: &str,
    ) -> Result<Option<WikiSummaryDto>, ApiError> {
        if title.trim().is_empty() {
            return Ok(None);
        }

        let url = format!(
            "https://{language}.wikipedia.org/api/rest_v1/page/summary/{}",
            urlencoding::encode(title)
        );

        match self
            .fetch_json(Host::Wikimedia, &url, Duration::from_secs(6))
            .await
        {
            Ok(value) => {
                if value.get("type").and_then(Value::as_str) == Some("disambiguation") {
                    return Ok(None);
                }
                let summary: WikiSummaryDto =
                    serde_json::from_value(value).map_err(|error| decode("wikipedia", error))?;
                Ok(Some(summary))
            }
            Err(ApiError::UpstreamStatus(404)) => Ok(None),
            Err(error) => Err(error),
        }
    }

    async fn commons_image(&self, city_name: &str) -> Result<Option<String>, ApiError> {
        let url = format!(
            "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch={}&gsrlimit=3&prop=pageimages%7Cimageinfo&iiprop=url&pithumbsize=1200&format=json&origin=*",
            urlencoding::encode(&format!("{city_name} city skyline panorama"))
        );
        let value = self
            .fetch_json(Host::Wikimedia, &url, Duration::from_secs(6))
            .await?;

        let Some(pages) = value.pointer("/query/pages").and_then(Value::as_object) else {
            return Ok(None);
        };

        for page in pages.values() {
            let candidate = page
                .pointer("/thumbnail/source")
                .and_then(Value::as_str)
                .or_else(|| page.pointer("/imageinfo/0/url").and_then(Value::as_str));
            if let Some(candidate) = candidate {
                if !is_bad_image(candidate) {
                    return Ok(Some(candidate.to_string()));
                }
            }
        }

        Ok(None)
    }

    pub async fn summary(
        &self,
        city_name: &str,
        fallback_name: &str,
    ) -> Result<CitySummary, ApiError> {
        let mut data = self.wiki_summary("pt", city_name).await?;
        if data.is_none() && !fallback_name.trim().is_empty() {
            data = self.wiki_summary("pt", fallback_name).await?;
        }

        let mut best_image = data.as_ref().and_then(summary_image);

        if best_image.as_deref().map(is_bad_image).unwrap_or(true) {
            match self.wiki_summary("en", city_name).await {
                Ok(Some(english)) => {
                    if let Some(candidate) = summary_image(&english) {
                        if !is_bad_image(&candidate) {
                            best_image = Some(candidate);
                        }
                    }
                }
                Ok(None) => {}
                Err(error) => tracing::warn!(error = %error, "english wikipedia fallback failed"),
            }
        }

        if best_image.as_deref().map(is_bad_image).unwrap_or(true) {
            match self.commons_image(city_name).await {
                Ok(Some(candidate)) => best_image = Some(candidate),
                Ok(None) => {}
                Err(error) => tracing::warn!(error = %error, "commons image fallback failed"),
            }
        }

        if let Some(data) = data {
            let url = data
                .content_urls
                .as_ref()
                .and_then(|urls| urls.desktop.as_ref())
                .and_then(|desktop| desktop.page.clone())
                .unwrap_or_else(|| {
                    format!(
                        "https://pt.wikipedia.org/wiki/{}",
                        urlencoding::encode(city_name)
                    )
                });

            return Ok(CitySummary {
                title: if data.title.trim().is_empty() {
                    city_name.to_string()
                } else {
                    data.title
                },
                description: data
                    .description
                    .unwrap_or_else(|| "Polo cultural e econômico regional.".to_string()),
                extract: data.extract.unwrap_or_else(|| {
                    "Informações históricas e culturais detalhadas.".to_string()
                }),
                thumbnail: best_image.clone(),
                banner_image: best_image,
                url,
            });
        }

        Ok(CitySummary {
            title: city_name.to_string(),
            description: "Polo cultural e econômico regional".to_string(),
            extract: format!(
                "{city_name} é um dos destinos de grande relevância, abrigando importante patrimônio arquitetônico, infraestrutura turística e atrações memoráveis."
            ),
            thumbnail: best_image.clone(),
            banner_image: best_image,
            url: format!(
                "https://pt.wikipedia.org/wiki/{}",
                urlencoding::encode(city_name)
            ),
        })
    }

    async fn wikidata_pois(
        &self,
        lat: f64,
        lon: f64,
        radius: i32,
        limit: usize,
        city_name: &str,
        seen: &mut HashSet<String>,
    ) -> Result<Vec<PointOfInterest>, ApiError> {
        let sparql = format!(
            r#"
            SELECT DISTINCT ?place ?placeLabel ?placeDescription ?typeLabel ?image ?sitelinks ?coord WHERE {{
              SERVICE wikibase:around {{
                ?place wdt:P625 ?coord .
                bd:serviceParam wikibase:center "Point({lon} {lat})"^^geo:wktLiteral .
                bd:serviceParam wikibase:radius "{radius}" .
              }}
              ?place wdt:P31 ?type .
              VALUES ?type {{
                wd:Q570116 wd:Q33506 wd:Q4989906 wd:Q5003624 wd:Q22698
                wd:Q473972 wd:Q131645 wd:Q435666 wd:Q34038 wd:Q355304
                wd:Q839954 wd:Q1081138 wd:Q2977 wd:Q16970 wd:Q44539
                wd:Q174782 wd:Q13226383 wd:Q16560 wd:Q125191 wd:Q43229
                wd:Q179700 wd:Q8619 wd:Q24354 wd:Q1076498 wd:Q158438
                wd:Q46831 wd:Q1248784
              }}
              ?place wikibase:sitelinks ?sitelinks .
              OPTIONAL {{ ?place wdt:P18 ?image . }}
              SERVICE wikibase:label {{ bd:serviceParam wikibase:language "pt,en". }}
            }}
            ORDER BY DESC(?sitelinks)
            LIMIT {}
            "#,
            limit.saturating_mul(2).max(limit)
        );

        let url = format!(
            "https://query.wikidata.org/sparql?format=json&query={}",
            urlencoding::encode(&sparql)
        );
        let value = self
            .fetch_json_with_retries(Host::Wikidata, &url, Duration::from_secs(6), 0)
            .await?;

        let bindings = value
            .pointer("/results/bindings")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let current_city = normalize_city_name(city_name);
        let mut pois = Vec::new();

        for (index, binding) in bindings.iter().enumerate() {
            let Some(title) = binding
                .pointer("/placeLabel/value")
                .and_then(Value::as_str)
                .filter(|title| !title.is_empty())
            else {
                continue;
            };

            if is_unlabelled_qid(title) || normalize_city_name(title) == current_city {
                continue;
            }
            if !seen.insert(title.to_ascii_lowercase()) {
                continue;
            }

            let Some((poi_lat, poi_lon)) = binding
                .pointer("/coord/value")
                .and_then(Value::as_str)
                .and_then(parse_wkt_point)
            else {
                continue;
            };

            let sitelinks = binding
                .pointer("/sitelinks/value")
                .and_then(Value::as_str)
                .and_then(|value| value.parse::<i64>().ok())
                .unwrap_or(1);
            let distance_km = haversine_km(lat, lon, poi_lat, poi_lon);
            let (rating, reviews_count) = calculate_poi_reviews(sitelinks, pois.len());
            let category = map_poi_category(
                binding.pointer("/typeLabel/value").and_then(Value::as_str),
                sitelinks,
            );
            let description = binding
                .pointer("/placeDescription/value")
                .and_then(Value::as_str)
                .map(ToOwned::to_owned)
                .unwrap_or_else(|| format!("{category} de destaque e visitação na região."));
            let thumbnail = binding
                .pointer("/image/value")
                .and_then(Value::as_str)
                .map(|image| image.replace("http://", "https://"));
            let maps_url = format!(
                "https://www.google.com/maps/search/?api=1&query={}",
                urlencoding::encode(&format!(
                    "{title}{}",
                    if city_name.is_empty() {
                        String::new()
                    } else {
                        format!(" {city_name}")
                    }
                ))
            );
            let page_id = binding
                .pointer("/place/value")
                .and_then(Value::as_str)
                .map(|value| Value::String(value.to_string()))
                .unwrap_or_else(|| Value::String(format!("poi-{index}")));

            pois.push(PointOfInterest {
                page_id,
                title: title.to_string(),
                lat: poi_lat,
                lon: poi_lon,
                dist: (distance_km * 1000.0).round() as i64,
                dist_formatted: format_distance(distance_km),
                thumbnail,
                extract: description,
                url: maps_url.clone(),
                rating: Some(rating),
                reviews_count: Some(reviews_count),
                category: Some(category),
                maps_url: Some(maps_url),
            });

            if pois.len() >= limit {
                break;
            }
        }

        Ok(pois)
    }

    async fn wiki_geosearch(
        &self,
        lang: &str,
        lat: f64,
        lon: f64,
    ) -> Result<Vec<WikiGeoItem>, ApiError> {
        let url = format!(
            "https://{lang}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord={}&gsradius=10000&gslimit=10&format=json&origin=*",
            urlencoding::encode(&format!("{lat}|{lon}"))
        );

        // CirrusSearch occasionally answers HTTP 200 with
        // {"error":{"code":"cirrussearch-too-busy-error"}}. Retry those logical
        // errors; otherwise a busy moment silently falls through to a much
        // worse POI source.
        let mut last_error = None;
        for attempt in 0..3 {
            match self
                .fetch_json_with_retries(Host::Wikimedia, &url, Duration::from_secs(6), 0)
                .await
            {
                Ok(value) => {
                    if let Some(error) = value.get("error") {
                        last_error = Some(ApiError::Upstream(format!(
                            "wikipedia {lang} geosearch: {error}"
                        )));
                    } else {
                        let response: WikiGeoResponse = serde_json::from_value(value)
                            .map_err(|error| decode("wikipedia geosearch", error))?;
                        return Ok(response
                            .query
                            .map(|query| query.geosearch)
                            .unwrap_or_default());
                    }
                }
                Err(error) => last_error = Some(error),
            }

            if attempt < 2 {
                tokio::time::sleep(Duration::from_millis(350 * (attempt as u64 + 1))).await;
            }
        }

        Err(last_error.unwrap_or_else(|| {
            ApiError::Upstream(format!("wikipedia {lang} geosearch unavailable"))
        }))
    }

    async fn wiki_page_details(
        &self,
        lang: &str,
        page_ids: &[i64],
    ) -> Result<HashMap<i64, WikiPage>, ApiError> {
        if page_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let ids = page_ids
            .iter()
            .map(ToString::to_string)
            .collect::<Vec<_>>()
            .join("|");
        let url = format!(
            "https://{lang}.wikipedia.org/w/api.php?action=query&pageids={}&prop=pageimages%7Cextracts&pithumbsize=600&exintro=1&explaintext=1&exsentences=2&format=json&origin=*",
            urlencoding::encode(&ids)
        );
        let value = self
            .fetch_json(Host::Wikimedia, &url, Duration::from_secs(6))
            .await?;
        let response: WikiPagesResponse =
            serde_json::from_value(value).map_err(|error| decode("wikipedia pages", error))?;

        Ok(response
            .query
            .map(|query| {
                query
                    .pages
                    .into_iter()
                    .filter_map(|(key, mut page)| {
                        page.pageid = page.pageid.or_else(|| key.parse::<i64>().ok());
                        page.pageid.map(|id| (id, page))
                    })
                    .collect()
            })
            .unwrap_or_default())
    }

    async fn wiki_geosearch_pois(
        &self,
        lat: f64,
        lon: f64,
        city_name: &str,
        seen: &mut HashSet<String>,
        limit: usize,
    ) -> Vec<PointOfInterest> {
        let current_city = normalize_city_name(city_name);
        let mut pois = Vec::new();
        let mut seen_coords = HashSet::new();

        // Portuguese first (the UI is Portuguese), English as a safety net.
        // If a language is briefly overloaded, the other one usually has the
        // same landmarks.
        for lang in ["pt", "en"] {
            if pois.len() >= limit {
                break;
            }

            let items = match self.wiki_geosearch(lang, lat, lon).await {
                Ok(items) => items,
                Err(error) => {
                    tracing::warn!(language = lang, error = %error, "wikipedia geosearch failed");
                    continue;
                }
            };

            let valid: Vec<WikiGeoItem> = items
                .into_iter()
                .filter(|item| {
                    !item.title.is_empty()
                        && normalize_city_name(&item.title) != current_city
                        && !is_administrative_title(&item.title)
                        && !seen.contains(&item.title.to_ascii_lowercase())
                })
                .collect();

            if valid.is_empty() {
                continue;
            }

            let page_ids: Vec<i64> = valid.iter().map(|item| item.pageid).collect();
            let details = match self.wiki_page_details(lang, &page_ids).await {
                Ok(details) => details,
                Err(error) => {
                    tracing::warn!(language = lang, error = %error, "wikipedia page details failed");
                    HashMap::new()
                }
            };

            for item in valid {
                if pois.len() >= limit {
                    break;
                }
                if !seen.insert(item.title.to_ascii_lowercase()) {
                    continue;
                }
                // The same landmark can have different titles in pt/en.
                // Deduplicate by coordinates (~110 m).
                let coord_key = (
                    (item.lat * 1_000.0).round() as i64,
                    (item.lon * 1_000.0).round() as i64,
                );
                if !seen_coords.insert(coord_key) {
                    continue;
                }

                let page = details.get(&item.pageid);
                let distance_km = item.dist / 1000.0;
                let (rating, reviews_count) = calculate_poi_reviews(15, pois.len());
                let maps_url = google_maps_url(&item.title, city_name);
                let category = infer_poi_category(&item.title);

                pois.push(PointOfInterest {
                    page_id: Value::Number(item.pageid.into()),
                    title: item.title,
                    lat: item.lat,
                    lon: item.lon,
                    dist: item.dist.round() as i64,
                    dist_formatted: format_distance(distance_km),
                    thumbnail: page
                        .and_then(|page| page.thumbnail.as_ref())
                        .and_then(|image| image.source.clone())
                        .filter(|url| !is_bad_image(url)),
                    extract: page
                        .and_then(|page| page.extract.clone())
                        .unwrap_or_else(|| format!("{category} relevante na região.")),
                    url: maps_url.clone(),
                    rating: Some(rating),
                    reviews_count: Some(reviews_count),
                    category: Some(category.to_string()),
                    maps_url: Some(maps_url),
                });
            }

            if pois.len() >= 3 {
                break;
            }
        }

        pois
    }

    pub async fn pois(
        &self,
        lat: f64,
        lon: f64,
        limit: usize,
        city_name: &str,
        country_code: &str,
    ) -> Result<Vec<PointOfInterest>, ApiError> {
        let limit = limit.clamp(1, 24);
        let mut seen = HashSet::new();
        let brazilian = country_code.eq_ignore_ascii_case("br");
        let mut pois = Vec::new();

        // Wikidata is richer (categories, sitelinks, images) and works well for
        // Brazilian municipalities. For foreign cities it is slower and often
        // fails, so geosearch is the better primary source there.
        if brazilian {
            match self
                .wikidata_pois(lat, lon, 25, limit, city_name, &mut seen)
                .await
            {
                Ok(items) => pois.extend(items),
                Err(error) => tracing::warn!(error = %error, "wikidata POI lookup failed"),
            }
        }

        if pois.is_empty() {
            pois.extend(
                self.wiki_geosearch_pois(lat, lon, city_name, &mut seen, limit)
                    .await,
            );
        }

        // Last external fallback: for non-Brazilian cities whose Wikipedia
        // geosearch returned nothing, try Wikidata once before using anchors.
        if pois.is_empty() && !brazilian {
            match self
                .wikidata_pois(lat, lon, 25, limit, city_name, &mut seen)
                .await
            {
                Ok(items) => pois.extend(items),
                Err(error) => tracing::warn!(error = %error, "wikidata POI lookup failed"),
            }
        }

        // Guaranteed cultural anchors so small towns never render an empty section.
        if pois.is_empty() && !city_name.trim().is_empty() {
            pois.extend(cultural_anchors(lat, lon, city_name));
        }

        Ok(pois)
    }

    pub async fn geodb_nearby(
        &self,
        lat: f64,
        lon: f64,
        current_city: &str,
        admin1: &str,
        country: &str,
        country_code: &str,
    ) -> Result<Vec<NearbyCity>, ApiError> {
        if !self.enable_geodb {
            return Ok(Vec::new());
        }

        let lat_string = format!("{}{:.4}", if lat >= 0.0 { "+" } else { "" }, lat);
        let lon_string = format!("{}{:.4}", if lon >= 0.0 { "+" } else { "" }, lon);
        let current = normalize_city_name(current_city);
        let mut seen = HashSet::new();
        let mut cities = Vec::new();

        // The free tier allows at most 10 results per page and a 100 km radius.
        // Dense cities (e.g. Paris) can fill the first page with arrondissements,
        // which are filtered out below, so fetch a second page when needed.
        for offset in [0usize, 10] {
            let url = format!(
                "https://geodb-free-service.wirefreethought.com/v1/geo/locations/{lat_string}{lon_string}/nearbyCities?radius=100&limit=10&offset={offset}&types=CITY&distanceUnit=KM"
            );
            let value = match self
                .fetch_json(Host::GeoDb, &url, Duration::from_secs(6))
                .await
            {
                Ok(value) => value,
                Err(error) => {
                    if offset == 0 {
                        return Err(error);
                    }
                    tracing::warn!(error = %error, offset, "geodb nearby page failed");
                    break;
                }
            };
            let response: GeoDbResponse = match serde_json::from_value(value) {
                Ok(response) => response,
                Err(error) => {
                    if offset == 0 {
                        return Err(decode("geodb", error));
                    }
                    tracing::warn!(error = %error, offset, "geodb nearby page decode failed");
                    break;
                }
            };

            for item in response.data {
                let Some(name) = item.name.or(item.city) else {
                    continue;
                };
                let lower = name.to_ascii_lowercase();
                let normalized = normalize_city_name(&name);
                let distance = item.distance.unwrap_or(0.0);

                if normalized == current
                    || distance < 4.0
                    || lower.contains("district")
                    || lower.contains("arrondissement")
                    || lower.contains("bairro")
                    || lower.contains("greater ")
                    || !seen.insert(normalized)
                {
                    continue;
                }

                let (Some(latitude), Some(longitude)) = (item.latitude, item.longitude) else {
                    continue;
                };
                let code = item
                    .country_code
                    .map(|value| value.to_ascii_lowercase())
                    .filter(|value| !value.is_empty())
                    .unwrap_or_else(|| country_code.to_ascii_lowercase());

                cities.push(NearbyCity {
                    id: item.id,
                    name,
                    region: item.region.unwrap_or_else(|| admin1.to_string()),
                    country: item.country.unwrap_or_else(|| country.to_string()),
                    country_code: code,
                    latitude,
                    longitude,
                    population: item.population,
                    distance_km: distance.round() as i32,
                    direction: bearing(lat, lon, latitude, longitude),
                });

                if cities.len() >= 8 {
                    break;
                }
            }

            if cities.len() >= 3 {
                break;
            }
        }

        Ok(cities)
    }

    pub async fn wikidata_nearby(
        &self,
        lat: f64,
        lon: f64,
        current_city: &str,
        admin1: &str,
        country: &str,
        country_code: &str,
    ) -> Result<Vec<NearbyCity>, ApiError> {
        let sparql = format!(
            r#"
            SELECT DISTINCT ?city ?cityLabel ?pop ?coord WHERE {{
              SERVICE wikibase:around {{
                ?city wdt:P625 ?coord .
                bd:serviceParam wikibase:center "Point({lon} {lat})"^^geo:wktLiteral .
                bd:serviceParam wikibase:radius "120" .
              }}
              ?city wdt:P31 ?type .
              VALUES ?type {{ wd:Q515 wd:Q3184121 wd:Q15284 wd:Q486972 wd:Q3957 }}
              OPTIONAL {{ ?city wdt:P1082 ?pop . }}
              SERVICE wikibase:label {{ bd:serviceParam wikibase:language "pt,en". }}
            }}
            LIMIT 60
            "#
        );
        let url = format!(
            "https://query.wikidata.org/sparql?format=json&query={}",
            urlencoding::encode(&sparql)
        );
        let value = self
            .fetch_json_with_retries(Host::Wikidata, &url, Duration::from_secs(6), 0)
            .await?;
        let bindings = value
            .pointer("/results/bindings")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let current = normalize_city_name(current_city);
        let mut seen = HashSet::new();
        let mut cities = Vec::new();

        for binding in bindings {
            let Some(name) = binding
                .pointer("/cityLabel/value")
                .and_then(Value::as_str)
                .filter(|name| !name.is_empty())
            else {
                continue;
            };
            if is_unlabelled_qid(name) {
                continue;
            }

            let normalized = normalize_city_name(name);
            if normalized == current || !seen.insert(normalized) {
                continue;
            }

            let Some((city_lat, city_lon)) = binding
                .pointer("/coord/value")
                .and_then(Value::as_str)
                .and_then(parse_wkt_point)
            else {
                continue;
            };

            let distance_km = haversine_km(lat, lon, city_lat, city_lon);
            if !(4.0..=140.0).contains(&distance_km) {
                continue;
            }

            let population = binding
                .pointer("/pop/value")
                .and_then(Value::as_str)
                .and_then(|value| value.parse::<i64>().ok());

            cities.push(NearbyCity {
                id: None,
                name: name.to_string(),
                region: if admin1.is_empty() {
                    "Região Próxima".to_string()
                } else {
                    admin1.to_string()
                },
                country: if country.is_empty() {
                    "Brasil".to_string()
                } else {
                    country.to_string()
                },
                country_code: if country_code.is_empty() {
                    "br".to_string()
                } else {
                    country_code.to_ascii_lowercase()
                },
                latitude: city_lat,
                longitude: city_lon,
                population,
                distance_km: distance_km.round() as i32,
                direction: bearing(lat, lon, city_lat, city_lon),
            });

            if cities.len() >= 10 {
                break;
            }
        }

        Ok(cities)
    }
}

// ---------------------------------------------------------------------------
// Host-level limiter
// ---------------------------------------------------------------------------

struct HostLimiter {
    semaphore: Arc<Semaphore>,
    min_interval: Duration,
    last_request: Mutex<Option<Instant>>,
    budget: Mutex<TokenBudget>,
}

impl HostLimiter {
    fn new(max_concurrent: usize, per_minute: u32, min_interval_seconds: u64) -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(max_concurrent.max(1))),
            min_interval: Duration::from_secs(min_interval_seconds),
            last_request: Mutex::new(None),
            budget: Mutex::new(TokenBudget::new(per_minute)),
        }
    }

    async fn acquire(&self) -> Result<OwnedSemaphorePermit, ApiError> {
        let permit = self
            .semaphore
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| ApiError::Internal("host semaphore closed".to_string()))?;

        loop {
            let wait = { self.budget.lock().await.take() };
            match wait {
                None => break,
                Some(delay) => tokio::time::sleep(delay).await,
            }
        }

        if !self.min_interval.is_zero() {
            let mut last = self.last_request.lock().await;
            if let Some(previous) = *last {
                let elapsed = previous.elapsed();
                if elapsed < self.min_interval {
                    tokio::time::sleep(self.min_interval - elapsed).await;
                }
            }
            *last = Some(Instant::now());
        }

        Ok(permit)
    }
}

struct TokenBudget {
    tokens: f64,
    capacity: f64,
    refill_per_second: f64,
    last: Instant,
}

impl TokenBudget {
    fn new(per_minute: u32) -> Self {
        let per_minute = per_minute.max(1) as f64;
        Self {
            tokens: per_minute,
            capacity: per_minute,
            refill_per_second: per_minute / 60.0,
            last: Instant::now(),
        }
    }

    /// Returns `None` when a request is allowed, or how long to wait.
    fn take(&mut self) -> Option<Duration> {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last).as_secs_f64();
        self.last = now;
        self.tokens = (self.tokens + elapsed * self.refill_per_second).min(self.capacity);

        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            None
        } else {
            Some(Duration::from_secs_f64(
                (1.0 - self.tokens) / self.refill_per_second,
            ))
        }
    }
}

// ---------------------------------------------------------------------------
// Upstream DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Default)]
struct OpenMeteoGeocode {
    #[serde(default)]
    results: Option<Vec<OpenMeteoCity>>,
}

#[derive(Debug, Deserialize, Default)]
struct OpenMeteoCity {
    id: Option<i64>,
    name: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    elevation: Option<f64>,
    feature_code: Option<String>,
    country: Option<String>,
    country_code: Option<String>,
    admin1: Option<String>,
    timezone: Option<String>,
    population: Option<i64>,
}

#[derive(Debug, Deserialize, Default)]
struct OpenMeteoForecast {
    current: Option<OpenMeteoCurrent>,
    daily: Option<OpenMeteoDaily>,
    hourly: Option<OpenMeteoHourly>,
}

#[derive(Debug, Deserialize, Default)]
struct OpenMeteoCurrent {
    temperature_2m: Option<f64>,
    relative_humidity_2m: Option<f64>,
    apparent_temperature: Option<f64>,
    precipitation: Option<f64>,
    weather_code: Option<i32>,
    wind_speed_10m: Option<f64>,
    wind_direction_10m: Option<f64>,
    surface_pressure: Option<f64>,
    time: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct OpenMeteoDaily {
    #[serde(default)]
    time: Vec<String>,
    #[serde(default)]
    weather_code: Vec<Option<i32>>,
    #[serde(default)]
    temperature_2m_max: Vec<Option<f64>>,
    #[serde(default)]
    temperature_2m_min: Vec<Option<f64>>,
    #[serde(default)]
    sunrise: Vec<Option<String>>,
    #[serde(default)]
    sunset: Vec<Option<String>>,
    #[serde(default)]
    uv_index_max: Vec<Option<f64>>,
}

#[derive(Debug, Deserialize, Default)]
struct OpenMeteoHourly {
    #[serde(default)]
    time: Vec<String>,
    #[serde(default)]
    temperature_2m: Vec<Option<f64>>,
    #[serde(default)]
    precipitation_probability: Vec<Option<f64>>,
    #[serde(default)]
    weather_code: Vec<Option<i32>>,
}

#[derive(Debug, Deserialize, Default)]
struct OpenMeteoAir {
    current: Option<OpenMeteoAirCurrent>,
}

#[derive(Debug, Deserialize, Default)]
struct OpenMeteoAirCurrent {
    european_aqi: Option<f64>,
    us_aqi: Option<f64>,
    pm10: Option<f64>,
    pm2_5: Option<f64>,
    nitrogen_dioxide: Option<f64>,
    ozone: Option<f64>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct WikiSummaryDto {
    #[serde(default)]
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    extract: Option<String>,
    #[serde(default)]
    thumbnail: Option<WikiImage>,
    #[serde(default)]
    originalimage: Option<WikiImage>,
    #[serde(default)]
    content_urls: Option<WikiContentUrls>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct WikiImage {
    #[serde(default)]
    source: Option<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct WikiContentUrls {
    #[serde(default)]
    desktop: Option<WikiDesktopUrl>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct WikiDesktopUrl {
    #[serde(default)]
    page: Option<String>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct WikiGeoResponse {
    #[serde(default)]
    query: Option<WikiGeoQuery>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct WikiGeoQuery {
    #[serde(default)]
    geosearch: Vec<WikiGeoItem>,
}

#[derive(Debug, Deserialize, Default, Clone)]
struct WikiGeoItem {
    #[serde(default)]
    pageid: i64,
    #[serde(default)]
    title: String,
    #[serde(default)]
    lat: f64,
    #[serde(default)]
    lon: f64,
    #[serde(default)]
    dist: f64,
}

#[derive(Debug, Deserialize, Default)]
struct WikiPagesResponse {
    #[serde(default)]
    query: Option<WikiPagesQuery>,
}

#[derive(Debug, Deserialize, Default)]
struct WikiPagesQuery {
    #[serde(default)]
    pages: HashMap<String, WikiPage>,
}

#[derive(Debug, Deserialize, Default)]
struct WikiPage {
    #[serde(default)]
    pageid: Option<i64>,
    #[serde(default)]
    thumbnail: Option<WikiImage>,
    #[serde(default)]
    extract: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct GeoDbResponse {
    #[serde(default)]
    data: Vec<GeoDbCity>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct GeoDbCity {
    id: Option<i64>,
    name: Option<String>,
    city: Option<String>,
    region: Option<String>,
    country: Option<String>,
    country_code: Option<String>,
    latitude: Option<f64>,
    longitude: Option<f64>,
    population: Option<i64>,
    distance: Option<f64>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn summary_image(summary: &WikiSummaryDto) -> Option<String> {
    summary
        .originalimage
        .as_ref()
        .and_then(|image| image.source.clone())
        .or_else(|| {
            summary
                .thumbnail
                .as_ref()
                .and_then(|image| image.source.clone())
        })
}

fn opt_f64(values: &[Option<f64>], index: usize) -> f64 {
    values.get(index).copied().flatten().unwrap_or(0.0)
}

fn opt_i32(values: &[Option<i32>], index: usize) -> i32 {
    values.get(index).copied().flatten().unwrap_or(0)
}

fn opt_string(values: &[Option<String>], index: usize) -> String {
    values.get(index).cloned().flatten().unwrap_or_default()
}

fn decode(context: &str, error: impl std::fmt::Display) -> ApiError {
    ApiError::Decode(format!("{context}: {error}"))
}

fn retry_after(response: &reqwest::Response) -> Option<Duration> {
    response
        .headers()
        .get(reqwest::header::RETRY_AFTER)?
        .to_str()
        .ok()?
        .trim()
        .parse::<u64>()
        .ok()
        .map(|seconds| Duration::from_secs(seconds.min(5)))
}

fn backoff(attempt: usize) -> Duration {
    let base = 250u64.saturating_mul(1u64 << attempt.min(4));
    Duration::from_millis(base + fastrand::u64(0..150))
}

fn is_unlabelled_qid(value: &str) -> bool {
    value
        .strip_prefix('Q')
        .map(|rest| !rest.is_empty() && rest.chars().all(|ch| ch.is_ascii_digit()))
        .unwrap_or(false)
}

fn google_maps_url(title: &str, city_name: &str) -> String {
    let query = if city_name.is_empty() {
        title.to_string()
    } else {
        format!("{title} {city_name}")
    };
    format!(
        "https://www.google.com/maps/search/?api=1&query={}",
        urlencoding::encode(&query)
    )
}

fn is_populated_place(feature_code: Option<&str>) -> bool {
    feature_code.is_none_or(|code| code.starts_with("PPL"))
}

fn is_administrative_title(title: &str) -> bool {
    let title = normalize_city_name(title);
    [
        "prefecture",
        "prefeitura",
        "province",
        "provincia",
        "municipality",
        "municipio",
        "district of",
        "distrito de",
        "metropolitan region",
        "regiao metropolitana",
        "state of",
        "estado de",
        "governorate",
        "county of",
    ]
    .iter()
    .any(|needle| title.contains(needle))
}

fn infer_poi_category(title: &str) -> &'static str {
    let title = normalize_city_name(title);
    if title.contains("museu")
        || title.contains("museum")
        || title.contains("galeria")
        || title.contains("gallery")
    {
        "Museu & Cultura"
    } else if title.contains("parque")
        || title.contains("park")
        || title.contains("jardim")
        || title.contains("garden")
    {
        "Parque & Natureza"
    } else if title.contains("igreja")
        || title.contains("catedral")
        || title.contains("church")
        || title.contains("templo")
        || title.contains("temple")
        || title.contains("santuario")
        || title.contains("castelo")
        || title.contains("palacio")
        || title.contains("palace")
        || title.contains("castle")
        || title.contains("forte")
        || title.contains("fort")
    {
        "Patrimônio & Arquitetura"
    } else if title.contains("torre")
        || title.contains("tower")
        || title.contains("mirante")
        || title.contains("viewpoint")
    {
        "Mirante & Paisagem"
    } else if title.contains("universidade")
        || title.contains("university")
        || title.contains("instituto")
        || title.contains("institute")
    {
        "Educação & Ciência"
    } else if title.contains("teatro")
        || title.contains("theatre")
        || title.contains("theater")
        || title.contains("opera")
    {
        "Cultura & Entretenimento"
    } else if title.contains("mercado") || title.contains("market") || title.contains("shopping") {
        "Compras & Mercados"
    } else {
        "Ponto Turístico"
    }
}

fn calculate_poi_reviews(sitelinks: i64, index: usize) -> (f64, String) {
    if sitelinks >= 40 {
        (
            4.9,
            format!("{:.1}k avaliações", sitelinks as f64 * 380.0 / 1000.0),
        )
    } else if sitelinks >= 20 {
        (
            4.8,
            format!("{:.1}k avaliações", sitelinks as f64 * 240.0 / 1000.0),
        )
    } else if sitelinks >= 10 {
        (
            4.7,
            format!("{:.1}k avaliações", sitelinks as f64 * 180.0 / 1000.0),
        )
    } else {
        (
            ((4.6 + (index % 3) as f64 * 0.1) * 10.0).round() / 10.0,
            format!(
                "{} avaliações",
                380i64.max(sitelinks * 120 + index as i64 * 45)
            ),
        )
    }
}

fn map_poi_category(type_label: Option<&str>, sitelinks: i64) -> String {
    let Some(type_label) = type_label else {
        return if sitelinks > 25 {
            "Atração Icônica".to_string()
        } else {
            "Destaque Cultural".to_string()
        };
    };

    let label = type_label.to_lowercase();
    if label.contains("queda de água") || label.contains("cascata") || label.contains("cachoeira")
    {
        "Cachoeira & Natureza".to_string()
    } else if label.contains("museu") || label.contains("memorial") || label.contains("galeria") {
        "Museu & História".to_string()
    } else if label.contains("parque")
        || label.contains("reserva")
        || label.contains("botânico")
        || label.contains("ecol")
    {
        "Parque & Ecoturismo".to_string()
    } else if label.contains("igreja")
        || label.contains("catedral")
        || label.contains("santuário")
        || label.contains("templo")
        || label.contains("capela")
    {
        "Patrimônio & Arquitetura".to_string()
    } else if label.contains("praça") || label.contains("largo") {
        "Praça & Convivência".to_string()
    } else if label.contains("aeroporto") || label.contains("aeródromo") {
        "Transporte & Acesso".to_string()
    } else if label.contains("monumento")
        || label.contains("escultura")
        || label.contains("património")
    {
        "Monumento Histórico".to_string()
    } else if label.contains("teatro")
        || label.contains("centro cultural")
        || label.contains("cinema")
    {
        "Arte & Cultura".to_string()
    } else if label.contains("mirante")
        || label.contains("serra")
        || label.contains("cordilheira")
        || label.contains("montanha")
        || label.contains("morro")
    {
        "Mirante & Paisagem".to_string()
    } else if sitelinks > 25 {
        "Atração Icônica".to_string()
    } else {
        "Destaque Local".to_string()
    }
}

fn cultural_anchors(lat: f64, lon: f64, city_name: &str) -> Vec<PointOfInterest> {
    let anchors = [
        (
            format!("Centro Histórico & Praça Matriz de {city_name}"),
            "Centro Histórico",
            4.8,
            "3.4k avaliações",
            format!("Coração histórico e ponto de encontro tradicional de {city_name}, com arborização, áreas de convivência e eventos culturais."),
        ),
        (
            format!("Igreja Matriz e Santuário de {city_name}"),
            "Patrimônio & Arquitetura",
            4.9,
            "4.2k avaliações",
            "Templo de referência histórica e espiritual do município, destacando-se pela arquitetura típica e celebrações tradicionais.".to_string(),
        ),
        (
            format!("Parque Ecológico Municipal de {city_name}"),
            "Parque & Ecoturismo",
            4.7,
            "2.1k avaliações",
            "Área verde preservada com trilhas ecológicas, lazer ao ar livre e contato direto com a flora e fauna nativas.".to_string(),
        ),
        (
            format!("Mirante & Circuito Panorâmico de {city_name}"),
            "Mirante & Paisagem",
            4.8,
            "1.9k avaliações",
            "Ponto elevado com vista panorâmica privilegiada de toda a cidade e dos vales e relevos da região.".to_string(),
        ),
    ];

    anchors
        .into_iter()
        .enumerate()
        .map(
            |(index, (title, category, rating, reviews, extract))| PointOfInterest {
                page_id: json!(900_000 + index),
                title: title.clone(),
                lat: lat + index as f64 * 0.008,
                lon: lon + index as f64 * 0.008,
                dist: ((index as i64 + 1) * 1200),
                dist_formatted: format!("{:.1} km", (index + 1) as f64 * 1.2),
                thumbnail: None,
                extract,
                url: format!(
                    "https://www.google.com/search?q={}",
                    urlencoding::encode(&title)
                ),
                rating: Some(rating),
                reviews_count: Some(reviews.to_string()),
                category: Some(category.to_string()),
                maps_url: None,
            },
        )
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_poi_categories() {
        assert_eq!(
            map_poi_category(Some("museu de arte"), 10),
            "Museu & História"
        );
        assert_eq!(
            map_poi_category(Some("cachoeira"), 3),
            "Cachoeira & Natureza"
        );
        assert_eq!(map_poi_category(None, 30), "Atração Icônica");
    }

    #[test]
    fn calculates_google_style_reviews() {
        let (rating, reviews) = calculate_poi_reviews(40, 0);
        assert_eq!(rating, 4.9);
        assert_eq!(reviews, "15.2k avaliações");
    }

    #[test]
    fn recognizes_unlabelled_qids() {
        assert!(is_unlabelled_qid("Q12345"));
        assert!(!is_unlabelled_qid("Q123abc"));
    }

    #[test]
    fn keeps_only_populated_places_from_open_meteo() {
        assert!(is_populated_place(Some("PPL")));
        assert!(is_populated_place(Some("PPLA")));
        assert!(!is_populated_place(Some("AIRH")));
        assert!(!is_populated_place(Some("PRK")));
        assert!(is_populated_place(None));
    }

    #[test]
    fn classifies_pois_from_titles() {
        assert_eq!(infer_poi_category("Museu do Louvre"), "Museu & Cultura");
        assert_eq!(
            infer_poi_category("Catedral de Notre-Dame"),
            "Patrimônio & Arquitetura"
        );
        assert_eq!(infer_poi_category("Parque Ibirapuera"), "Parque & Natureza");
        assert_eq!(infer_poi_category("Rua Augusta"), "Ponto Turístico");
    }

    #[test]
    fn rejects_administrative_divisions_as_pois() {
        assert!(is_administrative_title("Kyoto Prefecture"));
        assert!(is_administrative_title("Província de Quioto"));
        assert!(is_administrative_title("Município de Ariquemes"));
        assert!(!is_administrative_title("Kyōto Gosho"));
        assert!(!is_administrative_title("Museu Regional"));
    }
}
