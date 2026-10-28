use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct City {
    pub id: i64,
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    #[serde(default)]
    pub elevation: f64,
    #[serde(default)]
    pub country: String,
    #[serde(default)]
    pub country_code: String,
    #[serde(default)]
    pub admin1: String,
    #[serde(default = "default_timezone")]
    pub timezone: String,
    #[serde(default)]
    pub population: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_capital: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_fuzzy: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fuzzy_matched_from: Option<String>,
}

fn default_timezone() -> String {
    "UTC".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentWeather {
    pub temperature: i32,
    pub apparent_temperature: i32,
    pub humidity: i32,
    pub precipitation: f64,
    pub weather_code: i32,
    pub wind_speed: i32,
    pub wind_direction: f64,
    pub surface_pressure: i32,
    pub time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyForecast {
    pub date: String,
    pub weather_code: i32,
    pub temp_max: i32,
    pub temp_min: i32,
    pub sunrise: String,
    pub sunset: String,
    pub uv_index_max: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HourlyForecast {
    pub times: Vec<String>,
    pub temperatures: Vec<i32>,
    pub precipitation_probabilities: Vec<f64>,
    pub weather_codes: Vec<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherData {
    pub current: CurrentWeather,
    pub daily: Vec<DailyForecast>,
    pub hourly: HourlyForecast,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AirQualityStatus {
    pub label: String,
    pub color: String,
    pub recommendation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AirQualityData {
    pub european_aqi: f64,
    pub us_aqi: f64,
    pub pm10: f64,
    pub pm25: f64,
    pub nitrogen_dioxide: f64,
    pub ozone: f64,
    pub status: AirQualityStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CitySummary {
    pub title: String,
    pub description: String,
    pub extract: String,
    pub thumbnail: Option<String>,
    pub banner_image: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointOfInterest {
    pub page_id: Value,
    pub title: String,
    pub lat: f64,
    pub lon: f64,
    pub dist: i64,
    pub dist_formatted: String,
    pub thumbnail: Option<String>,
    pub extract: String,
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rating: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reviews_count: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub maps_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NearbyCity {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<i64>,
    pub name: String,
    pub region: String,
    pub country: String,
    pub country_code: String,
    pub latitude: f64,
    pub longitude: f64,
    pub population: Option<i64>,
    pub distance_km: i32,
    pub direction: String,
}

/// One round-trip dashboard payload. This replaces five browser requests and lets
/// the backend coalesce/cache all upstream calls in parallel.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CityDashboard {
    pub weather: Option<Arc<WeatherData>>,
    pub air_quality: Option<Arc<AirQualityData>>,
    pub summary: Option<Arc<CitySummary>>,
    pub pois: Arc<Vec<PointOfInterest>>,
    pub nearby_cities: Arc<Vec<NearbyCity>>,
}
