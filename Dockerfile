# syntax=docker/dockerfile:1

# 1. Static frontend
FROM node:22-bookworm-slim AS web
ARG NEXT_PUBLIC_API_BASE_URL=""
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:web

# 2. Rust API (dependency layer is cached separately)
FROM rust:1-bookworm AS api
WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN mkdir src \
    && echo 'fn main() {}' > src/main.rs \
    && cargo build --release \
    && rm -rf src
COPY backend ./
RUN cargo build --release

# 3. Tiny runtime: one static binary + static assets
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=api /app/backend/target/release/terradata-api /usr/local/bin/terradata-api
COPY --from=web /app/out ./out

ENV HOST=0.0.0.0 \
    PORT=8080 \
    STATIC_DIR=/app/out

EXPOSE 8080
USER 10001:10001
CMD ["terradata-api"]
