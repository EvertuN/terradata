# 🌍 TerraData — Agregador de Cidades Inteligente

> Um agregador moderno e completo de informações urbanas e geográficas, construído com **React Native for Web**, **Next.js 14**, **TypeScript** e **TSX**, alimentado exclusivamente por APIs públicas de alta disponibilidade mapeadas a partir do catálogo [APIS.md](file:///C:/Users/evert_b9ypuj4/Dev/1984/APIS.md).

---

## 📸 Funcionalidades Principais

- 🎯 **Primeira Tela Principal Minimalista**: Ao acessar a aplicação, o usuário é recepcionado por uma tela de busca centralizada e limpa (estilo Apple Spotlight), sem poluição visual ou escolha pré-definida forçada.
- 🔍 **Busca Inteligente com Autocomplete**: Digite qualquer cidade do mundo e receba sugestões instantâneas com país, estado, altitude e população.
- 💾 **Cache no Navegador (`localStorage`)**: A cidade escolhida fica salva na memória do navegador. Na próxima visita, o usuário pode reabrir sua última cidade com um único clique (`Continuar em [Cidade] ➔`).
- 📍 **Geolocalização por GPS ("Minha Localização")**: Detecta automaticamente a cidade atual do usuário utilizando a API de geolocalização do navegador combinada com a geocodificação reversa do Nominatim.
- 🕒 **Relógio Digital ao Vivo**: Sincronizado dinamicamente segundo o fuso horário exato da cidade consultada.
- 📖 **História & Resumo Cultural**: Extraído diretamente da Wikipédia com imagem em alta resolução e link para o artigo completo.
- ⛅ **Clima em Tempo Real & Previsão 7 Dias**: Visual inspirado no widget do Apple Weather, com temperatura atual, sensação térmica, umidade, vento, pressão e previsão semanal.
- 📈 **Gráfico Interativo de 24 Horas**: Curva ultra suave de temperatura e barras de probabilidade de chuva desenvolvida com Chart.js sem linhas agressivas.
- 🍃 **Qualidade do Ar (AQI)**: Estilo Apple Health com barra contínua de espectro pastel e detalhamento de partículas (PM2.5, PM10, Ozônio, Dióxido de Nitrogênio).
- 🗺️ **Mapa Interativo (Leaflet + CartoDB/OSM)**: Cartografia limpa com cantos arredondados (24px), marcador central pulsante em azul Apple, atrações locais e cidades vizinhas com popups informativos.
- 🏛️ **Lugares do Local (Pontos de Interesse)**: Monumentos, museus, parques e marcos culturais em um raio de até 10km com distância calculada e fotos em cards limpos.
- 🧭 **Lugares e Cidades Próximas**: Municípios vizinhos num raio de 100km com badges em menta pastel, orientação da bússola (N, S, L, O) e botão **"Explorar"** estilo iOS para alternância instantânea.
- 🍏 **Design Apple Minimalist com Cores Pastéis**: Fundo limpo `#fbfbfd`, cards em branco `#ffffff` com sombras difusas (`0 4px 20px rgba(0,0,0,0.03)`), badges circulares em tons suaves (azul, menta, pêssego, lavanda, coral) e segmented control nativo.

---

## 🛠️ APIs Utilizadas do [APIS.md](file:///C:/Users/evert_b9ypuj4/Dev/1984/APIS.md)

1. **[Open-Meteo Geocoding API](https://open-meteo.com/)** (`Linha 2658`): Busca, coordenadas, elevação, fuso horário e população.
2. **[Open-Meteo Weather Forecast API](https://open-meteo.com/)** (`Linha 2658`): Dados meteorológicos atuais, horários e diários.
3. **[Open-Meteo Air Quality API](https://open-meteo.com/)** (`Linha 2638 / 2658`): Qualidade do ar e poluentes atmosféricos.
4. **[GeoDB Cities API](http://geodb-cities-api.wirefreethought.com/)** (`Linha 1345`): Cidades e municípios vizinhos num raio de até 100km.
5. **[Wikipedia REST API](https://www.mediawiki.org/wiki/API:Main_page)** (`Linha 1877`): Resumo histórico, descrições e fotos de capa.
6. **[Wikipedia Geosearch API](https://www.mediawiki.org/wiki/API:Main_page)** (`Linha 1877`): Pontos de interesse e atrações turísticas em um raio de 10km.
7. **[Nominatim OpenStreetMap](https://nominatim.org/)** (`Linha 1389 & 1395`): Geocodificação reversa de coordenadas GPS e cartografia via Leaflet.

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
- Node.js (v18+) instalado.

### 1. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```

### 2. Compilar e Iniciar em Produção
```bash
npm run build
npm start
```

Acesse no seu navegador: **`http://localhost:3000`**
