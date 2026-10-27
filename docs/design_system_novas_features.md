# TerraData — Design System & Arquitetura das 5 Novas Funcionalidades
**Padrão Estético Apple (Human Interface Guidelines)**

---

## 1. Filosofia de Design & Diretrizes de Experiência do Usuário (Apple HIG)

TerraData adota os princípios fundamentais das **Apple Human Interface Guidelines (HIG)** para plataformas modernas (iOS, iPadOS e macOS):

1. **Clareza e Legibilidade (Clarity)**: Tipografia hierarquizada no padrão SF Pro com pesos calibrados, contraste otimizado (WCAG AAA) e suporte nativo a números tabulares (`fontVariant: ['tabular-nums']`) para relógios, temperaturas e métricas.
2. **Deferência ao Conteúdo (Deference)**: A interface é fluida, calma e minimalista. Elementos gráficos decorativos ou ruído visual desnecessário ("AI-slop", como excesso de pills coloridas sem função ou gradientes saturados de neon) são estritamente proibidos. O foco visual é a cidade, os dados meteorológicos e os mapas de alta precisão.
3. **Profundidade e Materiais (Depth & Materials)**: Uso extensivo de superfícies de vidro fosco (*frosted glass / thin material*) com `backdrop-filter: blur(20px)` e bordas translúcidas de 1px (`rgba(0,0,0,0.04)` no modo claro e `rgba(255,255,255,0.08)` no modo escuro), transmitindo sensação tátil e espacial idêntica aos apps nativos do iOS.
4. **Respostas e Microinterações Orgânicas**: Feedback imediato para ações do usuário (salvar cidade, alternar radar, gerar snapshot) com transições suaves e tempo de resposta perceptível de 0ms através do sistema de cache em memória e `localStorage`.

---

## 2. Paleta de Cores e Materiais Apple (Light & Dark Mode)

### 2.1 Superfícies e Fundos
| Token | Modo Claro (Apple Light) | Modo Escuro (Apple Dark) | Utilização |
|---|---|---|---|
| `bg-root` | `#fbfbfd` | `#000000` | Fundo principal da página |
| `bg-card` | `#ffffff` | `#1c1c1e` | Cartões e seções de dados |
| `bg-frosted` | `rgba(255,255,255,0.82)` | `rgba(28,28,30,0.82)` | Modais, cabeçalho e controles flutuantes |
| `bg-subtle` | `#f0f0f2` | `#2c2c2e` | Tracks de segmentos, botões neutros |
| `border-subtle` | `rgba(0, 0, 0, 0.04)` | `rgba(255, 255, 255, 0.08)` | Divisores e bordas de cartões |

### 2.2 Cores de Acento e Paleta Pastel Apple
| Cor Semântica | Claro (Pastel / Sólido) | Escuro (Pastel Glow) | Significado no TerraData |
|---|---|---|---|
| **Apple Blue** | `#0071e3` / `#eef5ff` | `#64b5f6` / `rgba(10,132,255,0.15)` | Navegação, radar ativo, GPS, links |
| **Apple Mint** | `#10b981` / `#eef9f2` | `#81c784` / `rgba(48,209,88,0.15)` | Ar Excelente, cidades salvas, Golden Hour |
| **Apple Amber** | `#f59e0b` / `#fffbeb` | `#ffd54f` / `rgba(255,193,7,0.15)` | Sol, UV Moderado, Pôr do sol |
| **Apple Coral** | `#f43f5e` / `#fff1f2` | `#f06292` / `rgba(244,63,94,0.15)` | UV Alto, Chuva intensa, alertas |
| **Apple Purple** | `#8b5cf6` / `#f5f3ff` | `#ba68c8` / `rgba(139,92,246,0.15)` | Atrações culturais, museus, itinerário |

---

## 3. Arquitetura das 5 Novas Funcionalidades

### Funcionalidade 1: Radar de Chuva e Nuvens em Tempo Real no Mapa
- **Tecnologia**: Leaflet + API Aberta e Gratuita do RainViewer (`https://api.rainviewer.com/public/weather-maps.json`).
- **Mapeamento de Tiles**:
  - URL Base: `https://tilecache.rainviewer.com`
  - Formato dos Tiles: `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`
  - Esquema de cores: `2` (Universal Blue com transições suaves estilo radar meteorológico da Apple).
- **Controles Flutuantes de Frosted Glass**:
  - Painel posicionado com `position: absolute; bottom: 16px; left: 16px; right: 16px;` sobre o canvas do mapa.
  - Botão Play/Pause com animação cronometrada (loop a cada 750ms percorrendo os últimos quadros temporais).
  - Timeline com marcadores de tempo relativos (ex: `-40m`, `-20m`, `Agora`).
  - Badge em tempo real com horário do quadro atual.
  - Indicador e legenda de intensidade de precipitação (Fraca → Moderada → Forte → Tempestade).
- **Toggle Instantâneo**: Botão discreto no topo do mapa para ligar/desligar a camada de radar sem recarregar o mapa base.

### Funcionalidade 2: Carrossel de Cidades Salvas (Estilo iOS Weather)
- **Componente**: `SavedCitiesCarousel.tsx`.
- **Comportamento & Ergonomia**:
  - Inspirado na lista de cidades salvas do aplicativo Tempo nativo do iPhone.
  - Cartões horizontais em carrossel deslizante com rolagem suave (`overflow-x: auto; scroll-snap-type: x mandatory`).
  - Cada cartão exibe:
    * Nome da cidade e UF/País
    * Horário local ao vivo (atualizado a cada segundo de acordo com a timezone)
    * Temperatura e ícone de clima representativo
    * Temperatura máxima e mínima do dia
    * Botão de remover dos favoritos no hover/ação
  - **Acesso em 0ms**: Armazenado em `localStorage` sob a chave `terradata_favorites_v1` e sincronizado com os dados em cache do TerraData.
  - Botão de favoritar/desfavoritar no `HeroBanner` com ícone de coração preenchido/vazio e micro-animação tátil.
  - Integração dupla: Disponível na tela de boas-vindas (`LandingSearch`) e no cabeçalho do Dashboard para troca instantânea de cidade.

### Funcionalidade 3: Smart Insights do Dia & Golden Hour
- **Componente**: `SmartDayInsights.tsx`.
- **Seção 1: Golden Hour & Fotografia**:
  - Cálculo de eventos celestes derivado dos campos `sunrise` e `sunset` da API Open-Meteo:
    * *Nascer do Sol*: horário exato
    * *Golden Hour Matinal*: nascer do sol até +60 minutos
    * *Golden Hour Vespertina*: -60 minutos do pôr do sol até o pôr do sol
    * *Crepúsculo / Blue Hour*: pôr do sol até +30 minutos
  - Identificação de estado atual: "Em andamento agora!", "Próxima em X horas" ou "Ocorrido hoje".
- **Seção 2: Janela Perfeita para Atividades ao Ar Livre**:
  - Algoritmo que examina a previsão horária (`hourly.temperatures`, `hourly.precipitationProbabilities`, `hourly.weatherCodes`):
    * Filtra horas do dia (06:00 às 20:00)
    * Critérios: Chuva < 20%, Temperatura entre 18°C e 27°C, Códigos climáticos favoráveis (céu limpo ou parcialmente nublado).
    * Agrupa intervalos contíguos de 2 a 3 horas e elege o horário ideal.
    * Gera sugestão editorial humana: *"Melhor momento para caminhar ou correr: 16h30 às 18h30. Clima ameno (23°C) e céu aberto."*
- **Seção 3: Monitor de Índice UV e Cuidados com a Pele**:
  - Escala oficial da OMS renderizada em gradiente suave:
    * 0 a 2: Baixo (Verde pastel) — Não requer proteção especial.
    * 3 a 5: Moderado (Amarelo pastel) — Use óculos de sol e protetor solar FPS 30+.
    * 6 a 7: Alto (Laranja pastel) — Evite sol ao meio-dia, use chapéu e reaplique protetor.
    * 8 a 10: Muito Alto (Vermelho suave) — Proteção máxima necessária, procure sombra.
    * 11+: Extremo (Púrpura suave) — Risco severo de queimadura, permaneça em ambientes fechados.
  - Marcador dinâmico de progresso estilo Apple Health.

### Funcionalidade 4: Roteiro Rápido: "Um Dia em [Cidade]"
- **Componente**: `OneDayItinerary.tsx`.
- **Estrutura Cronológica em 4 Turnos**:
  - **09h00 • Manhã**: Café da Manhã, Centro Histórico, Praça Matriz ou Museu regional.
  - **14h00 • Tarde**: Parque Municipal, Jardim Botânico, Reserva Ecológica ou Ecoturismo.
  - **17h30 • Pôr do Sol**: Mirante Panorâmico, Lagoa ou Orla com vista privilegiada.
  - **20h00 • Noite**: Teatro Municipal, Centro Cultural ou Polo Gastronômico.
- **Distribuição Inteligente de POIs**:
  - O componente analisa a lista de pontos turísticos (`pois`) retornada pelo Wikidata/Wikipedia, mapeando-os semanticamente aos 4 turnos.
  - Caso haja poucos pontos cadastrados na cidade, utiliza os polos culturais consolidados garantindo que nenhuma cidade fique sem itinerário.
- **Botões 1-Click Rota**:
  - **Google Maps**: URL estruturada com waypoints sequenciais:
    `https://www.google.com/maps/dir/?api=1&origin=${lat},${lon}&waypoints=${encodedWaypoints}&destination=${destLat},${destLon}&travelmode=driving`
  - **Apple Maps**: Deep link padrão iOS/macOS para rota multimodal:
    `https://maps.apple.com/?saddr=${lat},${lon}&daddr=${destLat},${destLon}`

### Funcionalidade 5: Card "Snapshot" para Compartilhamento (Stories / X)
- **Componente**: `SnapshotModal.tsx`.
- **Formato Vertical 9:16**:
  - Proporção exata para Instagram Stories, WhatsApp Status e posts no X (Twitter).
  - Preview responsivo em tela com proporção calculada e renderização de alta fidelidade (1080x1920 pixels).
- **Composição Visual**:
  - Foto de capa da cidade com efeito vinheta e gradiente cinematográfico inferior.
  - Logotipo e marca d'água elegante "TerraData".
  - Data e hora atual da consulta.
  - Nome da cidade em tipografia de impacto (SF Pro Rounded/Bold).
  - Temperatura em destaque (ex: `24°C`) com ícone meteorológico e descrição do tempo.
  - Indicador de Qualidade do Ar em badge de vidro fosco.
  - Golden Hour ou Curiosidade cultural do dia.
- **Mecanismo de Geração sem Dependências Pesadas**:
  - Utiliza a API nativa do **HTML5 Canvas** para renderizar a imagem completa em resolução Full HD (1080x1920) com texto anti-aliased e gradientes lineares.
  - Exportação direta como arquivo PNG (`terradata-[cidade].png`).
  - Suporte à cópia direta para a área de transferência (`navigator.clipboard.write([ClipboardItem])`).
  - Botão de compartilhamento nativo (`navigator.share`) em navegadores móveis (Safari iOS e Chrome Android).

---

## 4. Estrutura de Arquivos e Novos Componentes

```
terradata/
├── components/
│   ├── AirQualitySection.tsx
│   ├── Header.tsx                    <-- Adicionado botão de Favoritos & Snapshot
│   ├── HeroBanner.tsx                <-- Adicionado botão de Favoritos & Snapshot
│   ├── HourlyChart.tsx
│   ├── InteractiveMap.tsx            <-- Radar de Chuva RainViewer integrado
│   ├── LandingSearch.tsx             <-- Carrossel de Cidades Salvas integrado
│   ├── NearbyCitiesSection.tsx
│   ├── OneDayItinerary.tsx           <-- [NOVO] Roteiro de 4 turnos + Rota 1-Click
│   ├── POIsSection.tsx
│   ├── SavedCitiesCarousel.tsx       <-- [NOVO] Carrossel estilo iOS Weather
│   ├── SmartDayInsights.tsx          <-- [NOVO] Golden hour + Outdoor + UV
│   ├── SnapshotModal.tsx             <-- [NOVO] Card 9:16 Stories + Export PNG
│   ├── Toast.tsx
│   └── WeatherSection.tsx
├── services/
│   ├── api.ts                        <-- Integração RainViewer API & Helpers
│   ├── cache.ts
│   └── favorites.ts                  <-- [NOVO] Gerenciamento reativo de cidades salvas
└── pages/
    └── index.tsx                     <-- Integração orquestrada das 5 features
```
