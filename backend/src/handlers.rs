use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::{
    error::ApiError,
    models::{
        AirQualityData, City, CityDashboard, CitySummary, NearbyCity, PointOfInterest, WeatherData,
    },
    state::AppState,
    util::valid_coords,
};

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    #[serde(alias = "query")]
    q: String,
    #[serde(default)]
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct CoordinatesQuery {
    lat: f64,
    lon: f64,
}

#[derive(Debug, Deserialize)]
pub struct ReverseQuery {
    lat: f64,
    lon: f64,
    #[serde(default)]
    tz: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SummaryQuery {
    name: String,
    #[serde(default, alias = "fallbackName")]
    fallback: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PoisQuery {
    lat: f64,
    lon: f64,
    #[serde(default)]
    limit: Option<usize>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    #[allow(dead_code)]
    admin1: Option<String>,
    #[serde(default, alias = "countryCode")]
    country_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct NearbyQuery {
    lat: f64,
    lon: f64,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    admin1: Option<String>,
    #[serde(default)]
    country: Option<String>,
    #[serde(default, alias = "countryCode")]
    country_code: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DashboardQuery {
    lat: f64,
    lon: f64,
    name: String,
    #[serde(default)]
    admin1: Option<String>,
    #[serde(default)]
    country: Option<String>,
    #[serde(default, alias = "countryCode")]
    country_code: Option<String>,
    #[serde(default)]
    limit: Option<usize>,
}

pub async fn search(
    State(state): State<AppState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<City>>, ApiError> {
    let trimmed = query.q.trim();
    if trimmed.is_empty() {
        return Ok(Json(Vec::new()));
    }
    if trimmed.chars().count() > 80 {
        return Err(ApiError::BadRequest("query is too long".to_string()));
    }

    let limit = query.limit.unwrap_or(10).clamp(1, 20);
    Ok(Json(state.search_cities(trimmed, limit).await))
}

pub async fn weather(
    State(state): State<AppState>,
    Query(query): Query<CoordinatesQuery>,
) -> Result<Json<Option<Arc<WeatherData>>>, ApiError> {
    validate_coords(query.lat, query.lon)?;
    Ok(Json(state.weather(query.lat, query.lon).await))
}

pub async fn air_quality(
    State(state): State<AppState>,
    Query(query): Query<CoordinatesQuery>,
) -> Result<Json<Option<Arc<AirQualityData>>>, ApiError> {
    validate_coords(query.lat, query.lon)?;
    Ok(Json(state.air_quality(query.lat, query.lon).await))
}

pub async fn reverse(
    State(state): State<AppState>,
    Query(query): Query<ReverseQuery>,
) -> Result<Json<Option<City>>, ApiError> {
    validate_coords(query.lat, query.lon)?;
    let timezone = validate_timezone(query.tz.as_deref())?;
    Ok(Json(
        state.reverse_geocode(query.lat, query.lon, timezone).await,
    ))
}

pub async fn summary(
    State(state): State<AppState>,
    Query(query): Query<SummaryQuery>,
) -> Result<Json<Option<Arc<CitySummary>>>, ApiError> {
    let name = validate_name(&query.name)?;
    let fallback = query.fallback.as_deref().unwrap_or("").trim();
    if fallback.chars().count() > 160 {
        return Err(ApiError::BadRequest("fallback is too long".to_string()));
    }
    Ok(Json(state.summary(name, fallback).await))
}

pub async fn pois(
    State(state): State<AppState>,
    Query(query): Query<PoisQuery>,
) -> Result<Json<Arc<Vec<PointOfInterest>>>, ApiError> {
    validate_coords(query.lat, query.lon)?;
    let limit = query.limit.unwrap_or(12).clamp(1, 24);
    let name = query.name.as_deref().unwrap_or("").trim();
    let country_code = query.country_code.as_deref().unwrap_or("").trim();
    Ok(Json(
        state
            .pois(query.lat, query.lon, limit, name, country_code)
            .await,
    ))
}

pub async fn nearby(
    State(state): State<AppState>,
    Query(query): Query<NearbyQuery>,
) -> Result<Json<Arc<Vec<NearbyCity>>>, ApiError> {
    validate_coords(query.lat, query.lon)?;
    let name = query.name.as_deref().unwrap_or("").trim();
    let admin1 = query.admin1.as_deref().unwrap_or("").trim();
    let country = query.country.as_deref().unwrap_or("").trim();
    let country_code = query.country_code.as_deref().unwrap_or("").trim();
    Ok(Json(
        state
            .nearby(query.lat, query.lon, name, admin1, country, country_code)
            .await,
    ))
}

pub async fn dashboard(
    State(state): State<AppState>,
    Query(query): Query<DashboardQuery>,
) -> Result<Json<CityDashboard>, ApiError> {
    validate_coords(query.lat, query.lon)?;
    let name = validate_name(&query.name)?;
    let admin1 = query.admin1.as_deref().unwrap_or("").trim();
    let country = query.country.as_deref().unwrap_or("").trim();
    let country_code = query.country_code.as_deref().unwrap_or("").trim();
    let limit = query.limit.unwrap_or(12).clamp(1, 24);

    Ok(Json(
        state
            .dashboard(crate::services::DashboardRequest {
                lat: query.lat,
                lon: query.lon,
                city_name: name,
                admin1,
                country,
                country_code,
                limit,
            })
            .await,
    ))
}

pub async fn health(State(state): State<AppState>) -> Json<Value> {
    Json(json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "cities": state.citydb.len(),
        "uptimeSeconds": state.started.elapsed().as_secs(),
        "cache": {
            "search": state.cache.search.entry_count(),
            "reverse": state.cache.reverse.entry_count(),
            "weather": state.cache.weather.entry_count(),
            "airQuality": state.cache.air_quality.entry_count(),
            "summary": state.cache.summary.entry_count(),
            "pois": state.cache.pois.entry_count(),
            "nearby": state.cache.nearby.entry_count(),
            "negative": state.cache.negative.entry_count(),
        },
        "limits": {
            "perIpBurst": state.config.per_ip_burst,
            "perIpPerMinute": state.config.per_ip_per_minute,
            "upstreamConcurrency": state.config.upstream_concurrency,
            "clientsTracked": state.limiter.size(),
            "geodbEnabled": state.config.enable_geodb,
        }
    }))
}

pub async fn api_not_found() -> Response {
    (StatusCode::NOT_FOUND, Json(json!({ "error": "not found" }))).into_response()
}

fn validate_coords(lat: f64, lon: f64) -> Result<(), ApiError> {
    if valid_coords(lat, lon) {
        Ok(())
    } else {
        Err(ApiError::BadRequest(
            "lat must be between -90 and 90 and lon between -180 and 180".to_string(),
        ))
    }
}

fn validate_name(name: &str) -> Result<&str, ApiError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name is required".to_string()));
    }
    if name.chars().count() > 160 {
        return Err(ApiError::BadRequest("name is too long".to_string()));
    }
    Ok(name)
}

fn validate_timezone(timezone: Option<&str>) -> Result<&str, ApiError> {
    let timezone = timezone.unwrap_or("UTC").trim();
    if timezone.is_empty() {
        Ok("UTC")
    } else if timezone.chars().count() > 64 {
        Err(ApiError::BadRequest("invalid timezone".to_string()))
    } else {
        Ok(timezone)
    }
}
