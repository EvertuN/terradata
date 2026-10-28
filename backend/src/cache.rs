use std::{future::Future, sync::Arc, time::Duration};

use moka::future::Cache;

use crate::{config::CacheTtls, error::ApiError};

/// All hot data lives in-process. No Redis, no database, no disk writes: the
/// cheapest cache is the one you do not have to operate.
#[derive(Clone)]
pub struct AppCache {
    pub search: Cache<String, Arc<Vec<crate::models::City>>>,
    pub reverse: Cache<String, Arc<crate::models::City>>,
    pub weather: Cache<String, Arc<crate::models::WeatherData>>,
    pub air_quality: Cache<String, Arc<crate::models::AirQualityData>>,
    pub summary: Cache<String, Arc<crate::models::CitySummary>>,
    pub pois: Cache<String, Arc<Vec<crate::models::PointOfInterest>>>,
    pub nearby: Cache<String, Arc<Vec<crate::models::NearbyCity>>>,
    pub negative: Cache<String, ()>,
}

impl AppCache {
    pub fn new(ttls: &CacheTtls) -> Self {
        Self {
            search: cache(2_000, ttls.search),
            reverse: cache(2_000, ttls.reverse),
            weather: cache(2_000, ttls.weather),
            air_quality: cache(1_000, ttls.air_quality),
            summary: cache(1_000, ttls.summary),
            pois: cache(1_000, ttls.pois),
            nearby: cache(1_000, ttls.nearby),
            negative: cache(10_000, ttls.negative),
        }
    }
}

fn cache<V>(capacity: u64, ttl: Duration) -> Cache<String, V>
where
    V: Clone + Send + Sync + 'static,
{
    Cache::builder()
        .max_capacity(capacity)
        .time_to_live(ttl)
        .time_to_idle(ttl)
        .build()
}

/// Cache-aside helper with three protections:
/// 1. Moka coalesces concurrent misses for the same key (one upstream call).
/// 2. Negative results are cached for 30s so a flaky upstream is not hammered.
/// 3. Errors never poison the positive cache.
pub async fn get_or_fetch<T, F>(
    cache: &Cache<String, Arc<T>>,
    negative: &Cache<String, ()>,
    key: String,
    fetch: F,
) -> Option<Arc<T>>
where
    T: Send + Sync + 'static,
    F: Future<Output = Result<T, ApiError>> + Send + 'static,
{
    if negative.get(&key).await.is_some() {
        return None;
    }

    let negative = negative.clone();
    let negative_key = key.clone();

    match cache
        .try_get_with(key, async move {
            match fetch.await {
                Ok(value) => Ok(Arc::new(value)),
                Err(error) => {
                    negative.insert(negative_key, ()).await;
                    Err(error)
                }
            }
        })
        .await
    {
        Ok(value) => Some(value),
        Err(error) => {
            tracing::warn!(error = %error, "upstream fetch failed; serving miss");
            None
        }
    }
}
