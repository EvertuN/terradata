use axum::{
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("upstream request failed: {0}")]
    Upstream(String),

    #[error("upstream returned status {0}")]
    UpstreamStatus(u16),

    #[error("invalid upstream payload: {0}")]
    Decode(String),

    #[error("rate limited for {retry_after}s")]
    RateLimited { retry_after: u64 },

    #[error("internal error: {0}")]
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, public_message, retry_after) = match &self {
            ApiError::BadRequest(message) => (StatusCode::BAD_REQUEST, message.clone(), None),
            ApiError::NotFound(message) => (StatusCode::NOT_FOUND, message.clone(), None),
            ApiError::RateLimited { retry_after } => (
                StatusCode::TOO_MANY_REQUESTS,
                "rate limit exceeded".to_string(),
                Some(*retry_after),
            ),
            ApiError::Upstream(_) | ApiError::UpstreamStatus(_) | ApiError::Decode(_) => (
                StatusCode::BAD_GATEWAY,
                "upstream service unavailable".to_string(),
                None,
            ),
            ApiError::Internal(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "internal error".to_string(),
                None,
            ),
        };

        let mut response = (
            status,
            Json(json!({
                "error": public_message,
                "retryAfter": retry_after,
            })),
        )
            .into_response();

        if let Some(seconds) = retry_after {
            if let Ok(value) = HeaderValue::from_str(&seconds.to_string()) {
                response.headers_mut().insert(header::RETRY_AFTER, value);
            }
        }

        response
    }
}
