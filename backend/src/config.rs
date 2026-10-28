use std::{env, net::SocketAddr, path::PathBuf, time::Duration};

use anyhow::{Context, Result};

/// Runtime configuration, all via environment variables so deployments stay cheap
/// and stateless (no config server, no database).
#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub static_dir: PathBuf,
    pub cors_origins: Option<Vec<String>>,
    pub trust_proxy: bool,
    pub user_agent: String,
    pub request_timeout: Duration,
    pub connect_timeout: Duration,
    pub upstream_concurrency: usize,
    pub per_ip_burst: u32,
    pub per_ip_per_minute: u32,
    pub enable_geodb: bool,
    pub ttls: CacheTtls,
}

#[derive(Clone, Debug)]
pub struct CacheTtls {
    pub weather: Duration,
    pub air_quality: Duration,
    pub search: Duration,
    pub summary: Duration,
    pub pois: Duration,
    pub nearby: Duration,
    pub reverse: Duration,
    pub negative: Duration,
}

impl Default for CacheTtls {
    fn default() -> Self {
        Self {
            weather: Duration::from_secs(15 * 60),
            air_quality: Duration::from_secs(30 * 60),
            search: Duration::from_secs(24 * 60 * 60),
            summary: Duration::from_secs(24 * 60 * 60),
            pois: Duration::from_secs(24 * 60 * 60),
            nearby: Duration::from_secs(24 * 60 * 60),
            reverse: Duration::from_secs(24 * 60 * 60),
            negative: Duration::from_secs(30),
        }
    }
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let ttls = CacheTtls::default();

        Ok(Self {
            host: env_string("HOST", "0.0.0.0"),
            port: env_parse("PORT", 8080)?,
            static_dir: PathBuf::from(env_string("STATIC_DIR", "./out")),
            cors_origins: parse_cors(env_string(
                "CORS_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080",
            )),
            trust_proxy: env_parse("TRUST_PROXY", false)?,
            user_agent: env_string(
                "USER_AGENT",
                "TerraData/2.0 (+https://github.com/EvertuN/terradata)",
            ),
            request_timeout: Duration::from_millis(env_parse("REQUEST_TIMEOUT_MS", 8_000)?),
            connect_timeout: Duration::from_millis(env_parse("CONNECT_TIMEOUT_MS", 4_000)?),
            upstream_concurrency: env_parse("UPSTREAM_CONCURRENCY", 24)?,
            per_ip_burst: env_parse("PER_IP_BURST", 30)?,
            per_ip_per_minute: env_parse("PER_IP_PER_MINUTE", 180)?,
            enable_geodb: env_parse("ENABLE_GEODB", false)?,
            ttls,
        })
    }

    pub fn socket_addr(&self) -> Result<SocketAddr> {
        format!("{}:{}", self.host, self.port)
            .parse()
            .with_context(|| format!("invalid bind address {}:{}", self.host, self.port))
    }

    pub fn bind_description(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

fn env_string(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_parse<T>(key: &str, default: T) -> Result<T>
where
    T: std::str::FromStr,
    T::Err: std::fmt::Display,
{
    match env::var(key) {
        Ok(value) if !value.trim().is_empty() => value
            .parse::<T>()
            .map_err(|err| anyhow::anyhow!("invalid {key}: {err}")),
        _ => Ok(default),
    }
}

fn parse_cors(value: String) -> Option<Vec<String>> {
    let origins: Vec<String> = value
        .split(',')
        .map(str::trim)
        .filter(|origin| !origin.is_empty())
        .map(ToOwned::to_owned)
        .collect();

    if origins.iter().any(|origin| origin == "*") {
        None
    } else if origins.is_empty() {
        Some(vec!["http://localhost:3000".to_string()])
    } else {
        Some(origins)
    }
}
