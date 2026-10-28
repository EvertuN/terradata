use std::net::SocketAddr;

use axum::{
    extract::{ConnectInfo, Request, State},
    http::{header, HeaderName, HeaderValue, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, Any, CorsLayer},
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};

use crate::{config::Config, error::ApiError, handlers, rate_limit::client_ip, state::AppState};

pub fn build_router(state: AppState) -> Router {
    let api = Router::new()
        .route("/health", get(handlers::health))
        .route("/cities/search", get(handlers::search))
        .route("/cities/summary", get(handlers::summary))
        .route("/cities/nearby", get(handlers::nearby))
        .route("/geocode/reverse", get(handlers::reverse))
        .route("/weather", get(handlers::weather))
        .route("/air-quality", get(handlers::air_quality))
        .route("/pois", get(handlers::pois))
        .route("/city", get(handlers::dashboard))
        .fallback(handlers::api_not_found)
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            rate_limit,
        ))
        .with_state(state.clone());

    let static_service = static_files(&state);

    Router::new()
        .nest("/api", api)
        .fallback_service(static_service)
        .layer(axum::middleware::from_fn(cache_headers))
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(cors_layer(&state.config))
}

fn static_files(state: &AppState) -> ServeDir<ServeFile> {
    let index = state.config.static_dir.join("index.html");
    ServeDir::new(&state.config.static_dir)
        .append_index_html_on_directories(true)
        .fallback(ServeFile::new(index))
}

fn cors_layer(config: &Config) -> CorsLayer {
    let layer = CorsLayer::new()
        .allow_methods([Method::GET, Method::HEAD, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION, header::ACCEPT]);

    match &config.cors_origins {
        None => layer.allow_origin(Any),
        Some(origins) => {
            let allowed = origins
                .iter()
                .filter_map(|origin| HeaderValue::from_str(origin).ok())
                .collect::<Vec<_>>();
            layer.allow_origin(AllowOrigin::list(allowed))
        }
    }
}

/// Per-IP rate limit. Health checks are exempt so orchestrators can probe the
/// service without consuming a client's budget.
async fn rate_limit(State(state): State<AppState>, request: Request, next: Next) -> Response {
    // Middleware on a nested router sees the path with the `/api` prefix
    // stripped, so accept both forms.
    let path = request.uri().path();
    if path == "/api/health" || path == "/health" {
        return next.run(request).await;
    }

    let remote = request
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .map(|connect_info| connect_info.0);
    let ip = client_ip(request.headers(), remote, state.config.trust_proxy);
    let decision = state.limiter.check(ip);

    if !decision.allowed {
        let error = ApiError::RateLimited {
            retry_after: decision.retry_after,
        };
        let mut response = error.into_response();
        add_rate_headers(&mut response, state.config.per_ip_burst, 0);
        return response;
    }

    let mut response = next.run(request).await;
    add_rate_headers(&mut response, state.config.per_ip_burst, decision.remaining);
    response
}

fn add_rate_headers(response: &mut Response, limit: u32, remaining: u32) {
    if let Ok(value) = HeaderValue::from_str(&limit.to_string()) {
        response
            .headers_mut()
            .insert(HeaderName::from_static("x-ratelimit-limit"), value);
    }
    if let Ok(value) = HeaderValue::from_str(&remaining.to_string()) {
        response
            .headers_mut()
            .insert(HeaderName::from_static("x-ratelimit-remaining"), value);
    }
}

/// Aggressive caching for immutable Next.js chunks, no browser caching for API
/// routes (the server owns freshness), and revalidation for HTML.
async fn cache_headers(request: Request, next: Next) -> Response {
    let path = request.uri().path().to_string();
    let mut response = next.run(request).await;

    let cache_control = if path.starts_with("/api/") {
        "no-store"
    } else if path.starts_with("/_next/static/") || path.starts_with("/assets/") {
        "public, max-age=31536000, immutable"
    } else if path.ends_with(".html") || path == "/" {
        "no-cache, must-revalidate"
    } else {
        "public, max-age=86400, stale-while-revalidate=604800"
    };

    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(cache_control),
    );
    response.headers_mut().insert(
        HeaderName::from_static("x-content-type-options"),
        HeaderValue::from_static("nosniff"),
    );
    response.headers_mut().insert(
        HeaderName::from_static("referrer-policy"),
        HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    response.headers_mut().insert(
        HeaderName::from_static("x-frame-options"),
        HeaderValue::from_static("SAMEORIGIN"),
    );

    if response.status() == StatusCode::NOT_FOUND && path.starts_with("/api/") {
        response.headers_mut().insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        );
    }

    response
}
