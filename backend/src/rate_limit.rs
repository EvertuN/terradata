use std::{
    net::{IpAddr, Ipv4Addr},
    time::{Duration, Instant},
};

use dashmap::DashMap;

/// Per-client token bucket. This is the first line of defense: a single browser
/// cannot burn through the shared upstream quotas by spamming autocomplete.
pub struct IpRateLimiter {
    buckets: DashMap<IpAddr, Bucket>,
    capacity: f64,
    refill_per_second: f64,
}

struct Bucket {
    tokens: f64,
    last_seen: Instant,
}

pub struct RateDecision {
    pub allowed: bool,
    pub retry_after: u64,
    pub remaining: u32,
}

impl IpRateLimiter {
    pub fn new(burst: u32, per_minute: u32) -> Self {
        let capacity = burst.max(1) as f64;
        let per_minute = per_minute.max(1) as f64;

        Self {
            buckets: DashMap::new(),
            capacity,
            refill_per_second: per_minute / 60.0,
        }
    }

    pub fn check(&self, ip: IpAddr) -> RateDecision {
        let now = Instant::now();
        let mut bucket = self.buckets.entry(ip).or_insert_with(|| Bucket {
            tokens: self.capacity,
            last_seen: now,
        });

        let elapsed = now.duration_since(bucket.last_seen).as_secs_f64();
        bucket.tokens = (bucket.tokens + elapsed * self.refill_per_second).min(self.capacity);
        bucket.last_seen = now;

        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            RateDecision {
                allowed: true,
                retry_after: 0,
                remaining: bucket.tokens.floor() as u32,
            }
        } else {
            let wait = (1.0 - bucket.tokens) / self.refill_per_second;
            RateDecision {
                allowed: false,
                retry_after: wait.ceil().max(1.0) as u64,
                remaining: 0,
            }
        }
    }

    pub fn prune(&self) {
        let stale_after = Duration::from_secs(10 * 60);
        self.buckets
            .retain(|_, bucket| bucket.last_seen.elapsed() < stale_after);
    }

    pub fn size(&self) -> usize {
        self.buckets.len()
    }
}

pub fn client_ip(
    headers: &axum::http::HeaderMap,
    remote: Option<std::net::SocketAddr>,
    trust_proxy: bool,
) -> IpAddr {
    if trust_proxy {
        // CDN/proxy-specific headers first (Cloudflare, Fly.io), then the
        // standard forwarding chain.
        for header in ["cf-connecting-ip", "fly-client-ip"] {
            if let Some(ip) = headers
                .get(header)
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.trim().parse::<IpAddr>().ok())
            {
                return ip;
            }
        }

        if let Some(forwarded) = headers
            .get("x-forwarded-for")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(',').next())
            .and_then(|value| value.trim().parse::<IpAddr>().ok())
        {
            return forwarded;
        }

        if let Some(real_ip) = headers
            .get("x-real-ip")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.trim().parse::<IpAddr>().ok())
        {
            return real_ip;
        }
    }

    remote
        .map(|socket| socket.ip())
        .unwrap_or(IpAddr::V4(Ipv4Addr::LOCALHOST))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_burst_then_refills() {
        let limiter = IpRateLimiter::new(2, 60);
        let ip = IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1));

        assert!(limiter.check(ip).allowed);
        assert!(limiter.check(ip).allowed);
        assert!(!limiter.check(ip).allowed);
    }
}
