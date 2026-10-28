# ⚡ TerraData — Análise de Performance & Plano de Otimização

> **Data:** 28 de outubro de 2026  
> **Escopo:** build estático (`next build` → `out/`) publicado como assets no Cloudflare Workers free.  
> **Objetivo:** deixar o app mais rápido sem perder funcionalidades e sem sair do plano gratuito.

---

## 1. Resumo executivo

**O gargalo não era a linguagem.** TypeScript já é compilado para JavaScript; trocar TS por JS não mudaria nada no navegador. O que deixava o app pesado era a **arquitetura do bundle** e o **tamanho dos recursos**:

1. O banco de cidades do Brasil (~430 KB) estava **dentro do chunk inicial**, então a tela de busca baixava e parseava tudo antes de o usuário digitar.
2. As imagens da Wikipédia/Wikidata eram as **originais** (frequentemente 3–10 MB por foto), e o `<Image>` do React Native Web renderiza uma `div` com `background-image` — ou seja, **sem lazy loading**.
3. As APIs eram chamadas em cadeia com fallbacks sequenciais (até ~10 requisições por cidade) e **sem timeout** em várias delas.
4. CSS de terceiros (Leaflet via unpkg) e 7 pesos da fonte Inter **bloqueavam a renderização** da landing.

**Resultado das otimizações aplicadas:**

| Métrica | Antes | Depois | Ganho |
|---|---:|---:|---:|
| JS carregado na landing (gzip) | ~288 KB | ~188 KB | **−35%** |
| JS carregado na landing (bruto) | ~1.026 KB | ~617 KB | **−40%** |
| Chunk da página inicial | 542 KB bruto / 132 KB gzip | 136 KB bruto / 33 KB gzip | **−75%** |
| Banco de cidades | no caminho crítico | chunk lazy de 105 KB gzip | fora do crítico |
| Busca fuzzy (desktop) | 12,6 ms/consulta | 3,2 ms/consulta | **−75%** |
| HTML da landing | 44,3 KB | 40,1 KB | −9% |
| Foto do hero | original (MBs) | thumb de 1280 px | ~10–50× menos bytes |
| Fotos dos POIs | original (MBs) | thumb de 800 px + `loading="lazy"` | ~10–50× menos bytes |

> Medições feitas com Node 24 no Windows; em um celular médio, os tempos de CPU costumam ser 3–5× maiores — o ganho relativo se mantém.

**Recomendação:** **não trocar de linguagem agora**. Se o objetivo for simplificar o projeto, o ganho real vem de trocar **React Native Web + Next.js** por **Vite + TypeScript (vanilla ou Preact)** — mesma linguagem, ~90% menos JavaScript de framework. Isso pode ser feito depois, de forma incremental, reaproveitando 100% da camada de serviços.

---

## 2. Onde o app roda hoje (e por que isso já é bom)

```toml
# wrangler.toml
[assets]
directory = "./out"
not_found_handling = "single-page-application"
```

Não existe `main` no `wrangler.toml`. Isso significa que o Cloudflare **não invoca um Worker** para servir o app: os arquivos são entregues pela camada de **Static Assets**, com cache e compressão automáticos (gzip/brotli). Portanto:

- ✅ Não consome as 100.000 requisições/dia do plano free.
- ✅ Não consome os 10 ms de CPU por requisição.
- ✅ TTFB é excelente (arquivo estático na borda).
- ⚠️ O gargalo é 100% no navegador: download, parse, execução de JS, imagens e chamadas às APIs públicas.

**Conclusão:** a configuração de deploy atual é a ideal para o free tier. Não adicione SSR nem proxy de API sem necessidade — isso passaria a consumir cota.

---

## 3. Diagnóstico detalhado

### 3.1 Banco de cidades no bundle inicial (crítico)

`services/cityDatabase.ts` tem ~430 KB: 5.571 municípios em uma única string + 30 cidades globais em um array literal.

- O arquivo era importado estaticamente por `api.ts` → `fuzzySearch.ts` → `cityDatabase.ts`, então entrava no chunk da página.
- O chunk da página tinha **542 KB**, dos quais ~430 KB eram o banco (≈80%).
- A cada tecla, `searchLocalFuzzyCities` **re-normalizava os 5.571 nomes** (NFD + regex), fazia `split(' ')` por cidade e rodava Jaro-Winkler/Levenshtein.

**O que foi feito:**

- `services/textMatch.ts`: funções puras de normalização e similaridade, sem dependência do banco.
- `api.ts` importa apenas `normalizeCityName` de `textMatch`; o banco virou **chunk lazy** (`import('./fuzzySearch')`).
- Índice pré-normalizado criado **uma vez por sessão** (`warmupCitySearch`), em vez de a cada consulta.
- `split(' ')` substituído por `indexOf(' ' + query)` (sem alocação de array).
- Levenshtein reescrito com **duas linhas** de DP e corte antecipado por diferença de tamanho.
- Jaro com `Uint8Array` em vez de `Array.fill(false)`.
- O download do chunk e a requisição ao Open-Meteo agora **acontecem em paralelo**.
- O chunk é pré-carregado em `requestIdleCallback` (fallback: 1,5 s), sem competir com a primeira renderização.

**Benchmark (mesmas consultas, mesmo resultado):**

```
ANTES (original):   12,62 ms/consulta
DEPOIS (otimizado):  3,19 ms/consulta
ganho: 75%
mesmo resultado? true
```

### 3.2 Imagens superdimensionadas

- `getCitySummary` preferia `originalimage.source` (foto original, às vezes 8–10 MB).
- POIs usavam `P18` do Wikidata direto (original).
- `Image` do React Native Web vira `<div style="background-image: ...">`, então `loading="lazy"` não existe.

**O que foi feito:**

- `services/images.ts`: converte URLs da Wikimedia para thumbnails (`/1280px-` no hero, `/800px-` nos POIs; `Special:FilePath?...&width=`).
- `components/LazyImage.tsx`: `<img loading="lazy" decoding="async" object-fit="cover">` para hero (eager) e cards (lazy).

**Impacto:** o hero de Ariquemes, por exemplo, agora carrega uma imagem de 1280 px em vez do arquivo original. Os 12 POIs só baixam quando entram na viewport.

### 3.3 Chamadas de API em cadeia

Cada cidade dispara 5 chamadas em paralelo (`Promise.allSettled`), mas:

- POIs: até 2 consultas SPARQL no Wikidata (4 s de timeout cada) + até 4 chamadas à Wikipédia + busca por palavra-chave.
- Cidades vizinhas: GeoDB + Wikidata + Open-Meteo, em sequência.
- Clima/ar/Wikipédia: **sem timeout** — se uma API não responder, o loader fica preso.
- Clima: pedia 168 horas de previsão para usar apenas 24.

**O que foi feito:**

- `forecast_hours=24` no Open-Meteo (payload horário ~7× menor).
- `AbortSignal.timeout()` (com fallback para Safari antigo) em clima, ar, geocodificação reversa, Wikipédia e Commons.
- Respostas continuam paralelas; nenhuma funcionalidade removida.

**Próximo passo recomendado:** *stale-while-revalidate* no cache (mostrar o dado antigo na hora e atualizar em background). Isso elimina o loader em visitas repetidas.

### 3.4 Terceiros bloqueando a renderização

- 7 pesos da fonte Inter (300–800) eram inlinados pelo Next no HTML (~40 KB de CSS).
- O CSS do Leaflet era carregado do **unpkg** no `<head>` — DNS + TLS + requisição de terceiro antes do primeiro paint, mesmo na landing onde não há mapa.

**O que foi feito:**

- Inter reduzida a 4 pesos (400/500/600/700).
- `preconnect` para geocoding/upload.wikimedia e `dns-prefetch` para as demais APIs.
- `leaflet.css` agora é local (`public/leaflet.css`) e injetado **somente quando o mapa monta** (`InteractiveMap`), removendo o unpkg do caminho crítico.

### 3.5 Stack (o “piso” atual)

Mesmo depois das otimizações, o custo de framework continua:

| Parte | Tamanho (gzip) | Observação |
|---|---:|---|
| React + React DOM (framework + main) | ~77 KB | carregado sempre |
| React Native Web | ~37 KB | carregado sempre |
| Polyfills | ~39 KB | desnecessário em navegadores modernos |
| Página + componentes | ~33 KB | já otimizado |
| **Total inicial** | **~188 KB** | |
| Chart.js (lazy) | ~52 KB | só no dashboard |
| Leaflet (lazy) | ~42 KB | só no mapa |
| Banco de cidades (lazy) | ~105 KB | só na busca |
| Imagens | variável | agora redimensionadas/lazy |

---

## 4. O que foi alterado

| Arquivo | Mudança |
|---|---|
| `services/textMatch.ts` *(novo)* | Normalização, Jaro, Jaro-Winkler e Levenshtein puros (sem banco). |
| `services/fuzzySearch.ts` | Índice pré-normalizado, buscas sem alocação, DP de 2 linhas, `warmupCitySearch`. |
| `services/api.ts` | Banco lazy, requisições em paralelo, timeouts, `forecast_hours=24`, thumbs de imagem. |
| `services/images.ts` *(novo)* | Conversão para thumbnails da Wikimedia. |
| `components/LazyImage.tsx` *(novo)* | `<img loading="lazy">` para hero, POIs e itinerário. |
| `components/LandingSearch.tsx` | Pré-carregamento do banco em idle. |
| `components/InteractiveMap.tsx` | CSS do Leaflet injetado sob demanda (local). |
| `pages/_document.tsx` | Menos pesos de fonte, preconnect/dns-prefetch, remove unpkg. |
| `next.config.js` | `optimizePackageImports` para `lucide-react`, remoção de `console.log` em produção. |
| `public/leaflet.css` *(novo)* | Cópia local do CSS do Leaflet 1.9.4. |

**Validação:** `npm run build` passou (type-check incluso) e um smoke test headless confirmou:
- busca “Arque” → “Ariquemes” (match aproximado) ✅
- chunk do banco carregado sob demanda ✅
- dashboard abre com clima, mapa, POIs e vizinhas ✅
- hero servido como thumb de 1280 px ✅
- nenhum erro de console ✅

---

## 5. Vale trocar de linguagem/stack?

**Trocar TypeScript por JavaScript: não.** Não há ganho de runtime; só perde segurança de tipos.

**Trocar a stack de UI: sim, se o objetivo for simplicidade e bundle mínimo.** Comparação realista:

| Stack | JS inicial (gzip) | Build | Esforço de migração | Comentário |
|---|---:|---:|---|---|
| **Next 14 + React + RNW** (atual) | ~188 KB | ~30–60 s | zero | Funciona bem; framework é o piso. |
| **Vite + Preact + TS** | ~25–40 KB | ~2–5 s | médio (1–2 dias) | Melhor relação ganho/esforço. Reaproveita serviços. |
| **Vite + TS vanilla** | ~10–20 KB | ~1–2 s | alto (2–4 dias) | Máximo ganho; reescreve a UI com HTML/CSS. |
| **Svelte/Solid + Vite** | ~20–35 KB | ~2–4 s | médio/alto | Ótimo runtime, ecossistema menor. |

**Recomendação pragmática:**

1. **Agora:** manter Next + React e colher os ganhos já aplicados (−35% no JS inicial, busca 4× mais rápida, imagens 10–50× menores).
2. **Depois, se quiser o “programa simples”:** migrar para **Vite + Preact/TS**, nesta ordem:
   - Reaproveitar `services/api.ts`, `cache.ts`, `textMatch.ts`, `images.ts` e `cityDatabase.ts` (são agnósticos de framework).
   - Trocar `View`/`Text`/`TouchableOpacity` por HTML semântico + CSS (os tokens de design já existem em `styles/globals.css`).
   - Substituir Chart.js por um SVG inline (o gráfico é uma linha + barras).
   - Publicar `dist/` no mesmo `[assets]` do `wrangler.toml` — deploy continua igual e igualmente free.

---

## 6. Próximos ganhos (ordenados por ROI)

1. **Cache stale-while-revalidate** — mostrar dados antigos instantaneamente e atualizar em background. Elimina o loader em visitas repetidas (maior ganho percebido).
2. **Chart.js → SVG inline** — economiza ~52 KB gzip (lazy) e remove uma dependência grande para um gráfico simples.
3. **RNW → CSS/Preact** — elimina ~37 KB gzip de RNW + parte do React; base para a migração do item 5.
4. **Compactar o banco de cidades** — o chunk lazy tem 105 KB gzip; um formato binário/compacto ou “top N + API” pode reduzi-lo a ~60 KB.
5. **Self-host da fonte** (`next/font` ou woff2 local) — remove a requisição ao Google Fonts; ou remover Inter e usar só a pilha de sistema (Apple design).
6. **Reduzir fallbacks de POIs/vizinhas** — menos requisições sequenciais em cidades pequenas; opcionalmente um proxy no Worker com Cache API (mas isso consome cota do free tier).
7. **Limpeza** — `index.html`, `js/`, `css/` e `server.js` na raiz são a versão legada e **não entram no deploy** (`wrangler` usa `./out`). Mantê-los confunde; mover para `legacy/` ou remover.

---

## 7. Cloudflare free — observações práticas

- **Static Assets (atual):** sem invocação de Worker; melhor opção. Limites: 20.000 arquivos e 25 MiB por arquivo — o projeto está muito abaixo.
- **Se adicionar um Worker (`main`) para proxy/cache de APIs:** passa a valer 100.000 req/dia e 10 ms CPU/req. Como cada cidade faz ~5–10 requisições, isso daria ~10–20 mil visualizações/dia. Só vale a pena se você quiser cache de borda ou esconder chaves.
- **`_headers`:** já define `immutable` para `/_next/static/*`. Vale adicionar cache longo para `/leaflet.css` (arquivo estável, não fingerprintado):

```txt
/leaflet.css
  Cache-Control: public, max-age=86400
```

---

## 8. Como validar localmente

```bash
npm run build
# A saída deve mostrar algo como:
# Route (pages)   Size      First Load JS
# /               72.5 kB   154 kB
```

No DevTools → Network (aba limpa, recarregar a landing):

- JS inicial deve ficar em **~188 KB gzip** (antes ~288 KB).
- O chunk `818.*.js` (banco de cidades) **não** deve aparecer no carregamento inicial; ele é baixado em idle ou na primeira busca.
- Imagens do hero devem ter `naturalWidth` ≈ 1280 e vir de `upload.wikimedia.org`/`thumb.wikimedia.org`.
- O CSS do Leaflet só deve aparecer depois que o mapa monta.

Para repetir o benchmark da busca, compile os serviços e rode o comparativo (script usado na análise, não versionado):

```bash
npx tsc services/fuzzySearch.ts services/textMatch.ts services/cityDatabase.ts \
  --outDir .tmp --module commonjs --target es2020 --skipLibCheck --esModuleInterop
# executar um comparativo entre a implementação antiga e a nova
```

---

## 9. Conclusão

- **Não é preciso trocar de linguagem** para ganhar performance. As mudanças estruturais entregaram ~35% menos JS inicial, 75% menos tempo de busca e imagens 10–50× menores.
- **A configuração no Cloudflare já é a mais simples e barata possível** (assets estáticos, sem Worker). Continue assim.
- **Se o objetivo é ter um programa realmente enxuto**, o próximo salto é de *stack*, não de linguagem: **Vite + TypeScript (Preact ou vanilla)**. Faça isso de forma incremental, começando pelo dashboard e reaproveitando toda a camada de serviços.
