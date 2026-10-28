# TerraData — Agregador de Cidades Inteligente

Frontend **Next.js** estático + backend **Rust** que centraliza, cacheia e protege todas as APIs externas. O navegador fala apenas com o próprio backend; nenhuma chave, coordenada ou chamada de terceiro precisa sair do cliente.

```text
Navegador
   │  /api/*  (uma chamada por dashboard)
   ▼
Rust (axum) ──► cache em memória (moka)
   │              ├─ Open-Meteo (geocoding, clima, qualidade do ar)
   │              ├─ Wikipedia / Wikidata
   │              ├─ Nominatim (1 req/s, no máximo)
   │              └─ GeoDB (opcional, desligado por padrão)
   ▼
./out (Next.js exportado)
```

## Por que o backend mudou para Rust

- **Baixo custo**: um único binário, sem Node em produção, sem banco, sem Redis.
- **Rápido**: índice de 5.601 cidades embutido no binário; busca por teclado é CPU local, sem rede.
- **Econômico**: uma requisição do dashboard vira uma chamada do navegador; o servidor paraleliza e cacheia as cinco consultas externas.
- **Protegido**: limite por IP, orçamento por provedor, coalescência de requisições, cache negativo, retries com backoff e timeouts.
- **Seguro**: o antigo `/api/proxy` aberto (SSRF) foi removido junto com o `server.js`. O backend só chama URLs internas e conhecidas.

## Funcionalidades

- Busca de cidades com tolerância a erros de digitação e acentos (`Florianopois` → Florianópolis).
- Geolocalização por GPS com geocodificação reversa e fallback para a base local.
- Clima atual, previsão de 7 dias e gráfico de 24 horas.
- Qualidade do ar (AQI europeu/americano, PM2.5, PM10, ozônio, NO₂).
- Resumo cultural da Wikipédia com imagem de capa.
- Pontos de interesse (Wikidata + Wikipédia) com categoria, avaliação, fotos e mapa.
- Cidades próximas com distância e direção, priorizando a base local.
- UI em português, cache no navegador e histórico local.
- Backend também serve o frontend exportado em `./out`.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js 14 (`output: export`), React 18, TypeScript, Chart.js, Leaflet |
| Backend | Rust 1.89+, axum 0.8, reqwest (rustls), moka, dashmap, tokio |
| Dados locais | 5.601 cidades embutidas via `include_str!` |
| Infra | Binário único ou container Docker; sem banco/Redis |

## Como rodar

Pré-requisitos: **Rust 1.89+**, **Node.js 18+** e npm.

```bash
npm install
cp .env.example .env
npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:8080/api/health

`npm run dev` sobe os dois processos (`scripts/dev.js`). Para rodar separadamente:

```bash
npm run dev:web
npm run dev:api
```

### Produção

```bash
npm run build   # build:web + build:api (release)
npm start       # o backend Rust serve a API e ./out
```

Acesse **http://localhost:8080**.

- `npm run build:web`: gera somente o frontend estático em `out/`.
- `npm run build:api`: compila o binário release em `backend/target/release/`.
- `npm run test:api`: executa os testes Rust.
- `npm run export:cities`: regenera `backend/data/cities.json` a partir de `services/cityDatabase.ts`.

## API

Todas as rotas são `GET`. Respostas de erro usam `{ "error": "...", "retryAfter": null | number }`.

| Rota | Parâmetros | Retorno |
| --- | --- | --- |
| `/api/health` | — | Status, versão, contagem de cidades, cache e limites |
| `/api/cities/search` | `q`, `limit` | Lista de cidades (busca local + fallback Open-Meteo) |
| `/api/cities/summary` | `name`, `fallback` | Resumo da Wikipédia |
| `/api/cities/nearby` | `lat`, `lon`, `name`, `admin1`, `country`, `countryCode` | Cidades próximas |
| `/api/geocode/reverse` | `lat`, `lon`, `tz` | Cidade do ponto (Nominatim + fallback local) |
| `/api/weather` | `lat`, `lon` | Clima atual, diário e horário |
| `/api/air-quality` | `lat`, `lon` | Qualidade do ar |
| `/api/pois` | `lat`, `lon`, `limit`, `name`, `admin1`, `countryCode` | Pontos de interesse |
| `/api/city` | `lat`, `lon`, `name`, `admin1`, `country`, `countryCode`, `limit` | Dashboard agregado |

`/api/city` é o endpoint usado pela tela principal. Ele responde com `weather`, `airQuality`, `summary`, `pois` e `nearbyCities`; qualquer seção temporariamente indisponível vem como `null`/`[]` sem derrubar as demais.

### Exemplo

```bash
curl "http://localhost:8080/api/city?lat=-9.9133&lon=-63.0408&name=Ariquemes&admin1=Rondonia&country=Brasil&countryCode=br"
```

## Cache e proteção das APIs

Cache em memória, por processo, com chaves normalizadas (~110 m de precisão nas coordenadas):

| Dado | TTL |
| --- | --- |
| Clima | 15 min |
| Qualidade do ar | 30 min |
| Busca, resumo, POIs, cidades próximas, geocodificação reversa | 24 h |
| Resultados negativos | 30 s |

Proteções adicionais:

- **Por IP**: 180 req/min com burst 30 (configurável).
- **Concorrência global**: 24 chamadas externas simultâneas.
- **Orçamento por provedor**: Open-Meteo 300/min, ar 120/min, Wikidata 30/min, Wikimedia 120/min, Nominatim 1 req/s e 60/min, GeoDB 20/min.
- **Coalescência**: requisições simultâneas para a mesma chave compartilham uma única chamada externa.
- **Retries**: apenas para timeout/conexão/429/5xx, com backoff e respeito ao `Retry-After`.
- **Busca local primeiro**: Open-Meteo só é chamado quando a base embutida não tem resposta confiável.
- **Cidades próximas locais primeiro**: a base de municípios resolve a maioria dos casos sem API externa. Fora do Brasil, um subconjunto global de grandes cidades cobre Paris, Londres, Tóquio e similares sem chamada externa.
- **POIs por país**: no Brasil o Wikidata é a fonte primária (categorias e imagens melhores); no exterior a Wikipédia (geosearch) vem primeiro, porque é mais rápida e confiável. Se a busca estiver temporariamente sobrecarregada, o backend tenta outro idioma antes de desistir.
- **GeoDB opcional**: `ENABLE_GEODB=false` por padrão. Ative para obter cidades vizinhas reais fora do Brasil (a base global embutida só tem 30 grandes cidades).

## Configuração

As variáveis são lidas do ambiente e, opcionalmente, de um `.env` (o backend usa `dotenvy`).

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | vazio | URL do backend no build do frontend. Vazio = mesma origem. |
| `HOST` | `0.0.0.0` | Endereço de bind. |
| `PORT` | `8080` | Porta HTTP. |
| `STATIC_DIR` | `./out` | Diretório do frontend exportado. |
| `CORS_ORIGINS` | `localhost:3000,127.0.0.1:3000,localhost:8080` | Origens permitidas; use `*` para liberar todas. |
| `TRUST_PROXY` | `false` | Lê `X-Forwarded-For`/`X-Real-IP` (ative atrás de proxy/CDN). |
| `USER_AGENT` | `TerraData/2.0 (+GitHub)` | User-Agent enviado aos provedores (Nominatim exige contato). |
| `REQUEST_TIMEOUT_MS` | `8000` | Timeout por chamada externa. |
| `CONNECT_TIMEOUT_MS` | `4000` | Timeout de conexão. |
| `UPSTREAM_CONCURRENCY` | `24` | Chamadas externas simultâneas no processo. |
| `PER_IP_BURST` | `30` | Burst do token bucket por IP. |
| `PER_IP_PER_MINUTE` | `180` | Taxa sustentada por IP. |
| `ENABLE_GEODB` | `false` | Habilita o GeoDB para cidades vizinhas reais fora do Brasil. |
| `RUST_LOG` | `terradata_api=info,tower_http=info` | Nível de log. |

Em produção com frontend e API em domínios diferentes:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.seudominio.com npm run build:web
CORS_ORIGINS=https://seudominio.com TRUST_PROXY=true ./terradata-api
```

## Deploy

### Container único

```bash
docker build -t terradata .
docker run --rm -p 8080:8080 -e TRUST_PROXY=true terradata
```

O `Dockerfile` compila o frontend e o binário Rust em estágios separados e copia apenas o necessário para a imagem final.

### Binário + estáticos

```bash
npm run build
STATIC_DIR=./out PORT=8080 ./backend/target/release/terradata-api
```

### Frontend separado (Cloudflare Pages, Vercel, etc.)

O `wrangler.toml` publica apenas o frontend estático (`npm run build:web`). A API Rust precisa ser hospedada em outro lugar; configure `NEXT_PUBLIC_API_BASE_URL` no build e `CORS_ORIGINS` no backend.

## Estrutura

```text
backend/
  Cargo.toml
  data/cities.json          # base embutida no binário
  src/main.rs               # bootstrap, bind, shutdown, prune do rate limit
  src/routes.rs             # rotas, CORS, headers, estáticos, rate limit por IP
  src/handlers.rs           # validação e serialização
  src/services.rs           # orquestração de cache e dashboard
  src/upstream.rs           # clientes, orçamentos por host, retries, POIs
  src/cache.rs              # moka + cache negativo + coalescência
  src/citydb.rs             # busca fuzzy e cidades próximas offline
  src/rate_limit.rs         # token bucket por IP
services/
  api.ts                    # cliente fino do frontend
  cache.ts                  # cache localStorage + TTLs
pages/index.tsx             # dashboard usando /api/city
scripts/
  dev.js                    # sobe web + api
  export_cities.js          # gera backend/data/cities.json
Dockerfile
```

## Notas

- O `server.js` antigo foi removido. Ele expunha `/api/proxy?url=...`, um vetor de SSRF, e não é necessário.
- O backend não faz scraping nem contorna limites dos provedores; ele apenas reduz chamadas com cache e filas.
- Nominatim: mantenha um `USER_AGENT` com contato real e não aumente os limites sem necessidade.
- A base de cidades é gerada a partir de `services/cityDatabase.ts`. Se ela mudar, rode `npm run export:cities` antes de compilar o backend.
