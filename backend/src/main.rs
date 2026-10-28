mod cache;
mod citydb;
mod config;
mod error;
mod handlers;
mod models;
mod rate_limit;
mod routes;
mod services;
mod state;
mod upstream;
mod util;

use std::{net::SocketAddr, time::Duration};

use anyhow::{Context, Result};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use crate::{citydb::CityDb, config::Config, state::AppState};

#[tokio::main]
async fn main() -> Result<()> {
    // `.env` is optional; production deployments normally inject env vars.
    let _ = dotenvy::dotenv();

    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("terradata_api=info,tower_http=info")),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::from_env().context("invalid configuration")?;
    if !config.static_dir.exists() {
        tracing::warn!(
            static_dir = %config.static_dir.display(),
            "static directory does not exist; API will run but the frontend will 404"
        );
    }

    let citydb = CityDb::load().context("failed to load embedded city database")?;
    tracing::info!(cities = citydb.len(), "city index loaded");

    let state = AppState::new(config, citydb)?;
    let app = routes::build_router(state.clone());
    let listener = tokio::net::TcpListener::bind(state.config.socket_addr()?)
        .await
        .context("failed to bind HTTP listener")?;

    tracing::info!(
        address = %state.config.bind_description(),
        static_dir = %state.config.static_dir.display(),
        per_ip_per_minute = state.config.per_ip_per_minute,
        upstream_concurrency = state.config.upstream_concurrency,
        "TerraData Rust backend ready"
    );

    let limiter = state.limiter.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(5 * 60));
        loop {
            interval.tick().await;
            limiter.prune();
        }
    });

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("HTTP server failed")?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received");
}
