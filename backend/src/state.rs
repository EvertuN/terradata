use std::{sync::Arc, time::Instant};

use crate::{
    cache::AppCache, citydb::CityDb, config::Config, error::ApiError, rate_limit::IpRateLimiter,
    upstream::Upstream,
};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub upstream: Arc<Upstream>,
    pub cache: Arc<AppCache>,
    pub citydb: Arc<CityDb>,
    pub limiter: Arc<IpRateLimiter>,
    pub started: Instant,
}

impl AppState {
    pub fn new(config: Config, citydb: CityDb) -> Result<Self, ApiError> {
        let upstream = Upstream::new(&config)?;
        let cache = AppCache::new(&config.ttls);
        let limiter = IpRateLimiter::new(config.per_ip_burst, config.per_ip_per_minute);

        Ok(Self {
            config: Arc::new(config),
            upstream: Arc::new(upstream),
            cache: Arc::new(cache),
            citydb: Arc::new(citydb),
            limiter: Arc::new(limiter),
            started: Instant::now(),
        })
    }
}
