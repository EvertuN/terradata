# 🌍 TerraData — Agregador Urbano e Meteorológico

> Plataforma moderna de inteligência geográfica e meteorológica em tempo real, construída com **React Native for Web**, **Next.js 14**, **TypeScript** e **Cloudflare Workers (Hono Edge BFF)**.

---

## ✨ Funcionalidades Principais

- 🎯 **Busca Centralizada Minimalista**: Experiência de boas-vindas limpa inspirada no Apple Spotlight, com histórico local para retorno rápido em 1 clique (`Continuar em [Cidade] ➔`).
- ⚡ **Skeleton Screens com Efeito Shimmer**: Carregamento fluido com animação contínua de sweep gradiente (estilo YouTube/Apple) e desbloqueio progressivo em ~200ms.
- ⛅ **Clima em Tempo Real & Previsão Horária (24h) / 7 Dias**: Temperatura atual, sensação térmica, umidade, vento, pressão e gráfico de curva com probabilidade de precipitação via Open-Meteo.
- 🍃 **Qualidade do Ar (AQI)**: Indicador visual em gradiente contínuo pastel com detalhamento de partículas (PM2.5, PM10, Ozônio, NO₂).
- 🌧️ **Radar de Precipitação em Tempo Real**: Cobertura de radar meteorológico animado sobre Leaflet via RainViewer API.
- 🗺️ **Mapa Interativo**: Cartografia limpa com tema personalizável, pontos de interesse georreferenciados e municípios vizinhos.
- 🏛️ **Pontos de Interesse (POIs)**: Monumentos históricos, museus, teatros e parques culturais com fotos em alta definição integradas ao Wikidata/Wikipédia.
- 🧭 **Cidades Vizinhas**: Municípios no raio de até 100km com distância calculada, orientação de bússola e alternância instantânea.
- 📸 **Snapshot Card (Stories / Social)**: Geração nativa via Canvas de cards verticais em alta resolução para compartilhamento direto.
- 🚀 **Edge BFF (Cloudflare Workers + Hono)**: Agregação paralela na borda com Cloudflare Cache (`stale-while-revalidate`), reduzindo a latência perceptível para ~15-20ms.

---

## 🛠️ Fontes de Dados e APIs Públicas

- **[Open-Meteo](https://open-meteo.com/)**: Previsão meteorológica, qualidade do ar e geocodificação global.
- **[Wikipédia REST API](https://www.mediawiki.org/wiki/API:REST_API)**: Resumo histórico, descrições culturais e imagens de capa.
- **[Wikidata Query Service (SPARQL)](https://query.wikidata.org/)**: Pontos turísticos, monumentos e atrações culturais.
- **[RainViewer API](https://www.rainviewer.com/api.html)**: Camadas de radar meteorológico e precipitação em tempo real.
- **[Nominatim OpenStreetMap](https://nominatim.org/)**: Geocodificação reversa de coordenadas GPS.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js (v18+)
- npm ou yarn

### 1. Instalação das Dependências
```bash
npm install
```

### 2. Desenvolvimento Local (Next.js)
```bash
npm run dev
```
Acesse no seu navegador: `http://localhost:3000`

### 3. Build Estático para Produção
```bash
npm run build
npm start
```

### 4. Executar com Cloudflare Workers (Edge BFF)
Para testar o Worker localmente simulando o ambiente Cloudflare Edge:
```bash
npx wrangler dev
```

Para realizar o deploy na Cloudflare:
```bash
npx wrangler deploy
```

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte o arquivo de licença para mais informações.
