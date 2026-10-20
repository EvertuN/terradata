# 🍎 TerraData — Auditoria Visual & Revisão Anti-AI-Slop

> **Data da Auditoria:** 20 de Outubro de 2026  
> **Método:** Inspeção visual direta via headless browser engine (Chromium/Edge CDP), capturando telas reais em Desktop (1440×900) e Mobile (390×844 - iPhone 14), com dados ao vivo de Curitiba, Ariquemes e São Paulo.  
> **Status da Aplicação:** Em execução local (`http://localhost:3000`), Next.js 14 + React Native for Web + TypeScript.

---

## 1. O que é "AI-Slop" no Design de Frontend?

O termo **AI-Slop** no desenvolvimento de interfaces refere-se ao conjunto de vícios visuais, muletas estéticas e clichês que modelos de IA reproduzem repetidamente quando solicitados a criar interfaces modernas. 

Esses vícios criam uma falsa sensação de "design pronto", mas revelam amadorismo na experiência real do usuário:
1. **Sparkles & Glitter (`✨`)**: Colocar ícones de brilho em logos, cabeçalhos e botões para forçar uma ideia de "inteligente/mágico".
2. **Sopa de Choice Chips / Pílulas Infinitas**: Envelopar cada palavra, coordenada, número ou dado em um badge arredondado com borda e cor pastel diferente. Isso destrói a hierarquia tipográfica e satura a visão.
3. **Visualizações de Dados "Cenográficas" (Falsos Gráficos)**: Barras e indicadores que parecem dados reais de longe, mas na prática têm larguras estáticas idênticas (como as barras da previsão de 7 dias).
4. **Copy Genérico & Futurista**: Slogans vazios como *"Agregador de Cidades Inteligente"*, *"Explorador Inteligente"* ou *"12 locais em destaque"*, em vez de microcopy claro, humano e funcional.
5. **Degradês e Bordas Saturadas**: Uso indiscriminado de azul elétrico (`#0071e3`), ciano e sombras difusas artificiais em vez da sutileza dos materiais foscos (frosted glass / blur) e tipografia da Apple (SF Pro / New York).

---

## 2. Diagnóstico Visual Seção por Seção (Evidências Diretas do Browser)

### 2.1. Tela Inicial (Landing Spotlight & Autocomplete)
* **Capturas analisadas:** `01_landing_desktop_light.png`, `02_search_autocomplete_active.png`, `15_landing_with_cached_city.png`
* **Pontos Positivos:**
  - O estilo Spotlight centralizado limpa o ruído anterior e foca a atenção na busca.
  - O blur e cantos arredondados (`borderRadius: 28`) passam uma primeira impressão limpa.
* **Sintomas de AI-Slop detectados:**
  - 🚩 **Ícone Sparkles (`✨`) sobre o logo:** O ícone `Sparkles` no topo do logo TerraData é o maior marcador de AI-Slop da atualidade. Faz o app parecer um chatbot de IA em vez de uma plataforma de dados geográficos confiável.
  - 🚩 **Duotons no Logo (`Terra` preto, `Data` azul elétrico):** Clichê de template SaaS de 2021. Marcas da Apple e ferramentas de referência usam tipografia unificada com peso óptico requintado.
  - 🚩 **Bandeiras quebradas como texto bruto (`Curitiba BR`):** No dropdown de sugestões, o código de país aparece como texto chapado em negrito colado ao nome, sem espaçamento óptico ou bandeira formatada.
  - 🚩 **Botão GPS com texto longo:** *"Usar minha localização atual"* com ícone de avião de papel parece formulário. O padrão Apple é um discreto ícone de bússola/seta de localização com *"Minha localização"*.

---

### 2.2. Header & Navegação
* **Capturas analisadas:** `real_dashboard.png`, `dark_01_top.png`, `mobile_01_top.png`
* **Pontos Positivos:**
  - Botão `< Cidades` no canto esquerdo funciona intuitivamente como o botão "Voltar" do iOS.
  - Campo de busca integrado no header permite alternar de cidade sem sair do dashboard.
* **Sintomas de AI-Slop detectados:**
  - 🚩 **Repetição do Sparkles:** Novamente o ícone `Sparkles` grudado no logo do header.
  - 🚩 **Poluição de Pílulas de Ação no canto direito:** Três botões lado a lado (`GPS`, `°C`, `Lua`). No desktop competem com a barra de busca; no mobile, quebram em 3 linhas, consumindo mais de 220px de altura de tela só com o cabeçalho.
  - 🚩 **Barra de Abas / Filtros (`Visão Geral`, `Clima`, `Qualidade do Ar`, `Mapa`, `Atrações`, `Vizinhas`):**
    - No desktop ocupa muito espaço vertical.
    - No mobile, não possui fade gradiente nas laterais para indicar scroll horizontal, parecendo cortada.

---

### 2.3. Cartão de Identidade da Cidade (Hero Banner)
* **Capturas analisadas:** `real_dashboard.png`, `mobile_01_top.png`
* **Pontos Positivos:**
  - A foto real da cidade (Jardim Botânico / Ópera de Arame em Curitiba) à direita traz autenticidade e quebra o aspecto puramente analítico.
  - O extrato enciclopédico resume bem a cidade.
* **Sintomas de AI-Slop detectados:**
  - 🚩 **Excesso de Pílulas de Metadados:** Quatro pílulas pequenas empilhadas embaixo do texto: `👥 1.948.626 hab.`, `⛰️ 924 m`, `📍 -25.43°, -49.27°` e `Wikipédia ↗`. Isso fragmenta a leitura.
  - 🚩 **Solução Apple:** Em vez de 4 pílulas isoladas, agrupar em uma régua tipográfica contínua com divisores sutis:
    `1,9M hab. • 924m altitude • -25.43°, -49.27° • Fonte: Wikipédia`.
  - 🚩 **Relógio em pílula destacada:** A pílula de horário local (`17:41:31`) tem o mesmo peso visual do nome do estado/país.

---

### 2.4. Previsão do Tempo & Gráficos (Detecção Crítica)
* **Capturas analisadas:** `scroll_01_weather_chart.png`, `mobile_02_weather.png`
* **Pontos Positivos:**
  - Temperatura em tamanho de destaque (`15°C`) com sensação térmica.
  - Gráfico contínuo da curva de 24 horas (`Variação Térmica Contínua`) suave e sem eixos agressivos.
* **Sintomas de AI-Slop detectados:**
  - 🚨 **FALSO GRÁFICO NA PREVISÃO DE 7 DIAS (Severidade Alta):**
    - Todas as barras laranjas dos 7 dias têm exatamente o mesmo comprimento fixo (~65% da largura)!
    - No Apple Weather original, a barra horizontal é um **min-max range visualizer real**:
      - Se terça-feira varia de 11°C a 20°C, e quarta de 12°C a 22°C, a barra da quarta deve começar mais à direita e terminar mais à direita.
      - A barra tem um degradê térmico suave (azul para frio, âmbar para ameno, vermelho para calor).
      - No dia atual ("Hoje"), há um pontinho branco indicador marcando a temperatura de agora dentro da faixa do dia.
  - 🚩 **Ícones multicoloridos sem paleta unificada:** No cartão de métricas (Umidade, Vento, Pressão, Chuva), há quatro cores primárias concorrentes (azul, roxo, verde, laranja). O estilo Apple privilegia ícones em tons monocromáticos de ardósia ou uma cor acento coesa.

---

### 2.5. Qualidade do Ar & Métrica Ambiental
* **Capturas analisadas:** `scroll_02_air_map.png`, `scroll_03_pois.png`
* **Pontos Positivos:**
  - O indicador de qualidade do ar com pontinho no gradiente funciona muito bem.
  - Badge de status (`Excelente`) em verde suave pastel.
  - Os 4 cartões de poluentes (`PM2.5`, `PM10`, `NO2`, `O3`) são limpos e informativos.

---

### 2.6. Mapa da Região (Leaflet / OpenStreetMap)
* **Capturas analisadas:** `scroll_03_pois.png`, `mobile_04_pois.png`
* **Pontos Positivos:**
  - Tiles do OpenStreetMap oficiais limpos, sem marcas d'água de API pagas.
  - Pins temáticos espalhados pela cidade com ícones específicos.
* **Sintomas de AI-Slop detectados:**
  - 🚩 **Controles nativos do Leaflet desajustados:** Os botões de zoom `+` e `-` no canto superior esquerdo são botões brancos quadrados com bordas retas dos anos 2010, destoando dos cartões arredondados com `borderRadius: 24` do resto do site.
  - 🚩 **Falta de controle de recentralizar:** Não há um botão elegante para resetar a visão para o centro da cidade.

---

### 2.7. Pontos de Interesse (POIs) & Atrações
* **Capturas analisadas:** `scroll_04_nearby.png`, `mobile_04_pois.png`
* **Pontos Positivos:**
  - 12 atrações reais de alta relevância com fotos de alta resolução do Wikimedia Commons (Museu Oscar Niemeyer, Praça do Japão, Teatro Guaíra, etc.).
  - Estrelas de avaliação (`⭐ 4.8`) e contagem de reviews críveis (`5.8k avaliações`), atendendo perfeitamente ao pedido do usuário.
  - Pílula de categoria elegante no canto superior da imagem.
* **Sintomas de AI-Slop detectados:**
  - 🚨 **Overflow no Mobile (Severidade Média):** Na tela do iPhone (`mobile_04_pois.png`), o cabeçalho da seção `Pontos de Interesse & Atrações Populares` não quebra linha e empurra o badge `12 locais em destaque` para fora da tela, sendo cortado como `12 loc...`.
  - 🚩 **Espaçamento e altura das fotos:** Em algumas resoluções intermediárias, os cards ficam com alturas de texto desiguais, criando espaços vazios na parte inferior antes do botão "Ver detalhes".

---

### 2.8. Cidades Vizinhas & Malha Regional
* **Capturas analisadas:** `scroll_04_nearby.png`
* **Pontos Positivos:**
  - Municípios verdadeiros (sem subdivisões falsas ou direções artificiais como "Zona Norte de Curitiba").
  - Distância precisa em km com direção cardinal (N, SE, SO, etc.).
  - Botão de exploração direta (`Explorar ↗`).
* **Sintomas de AI-Slop detectados:**
  - 🚩 **Repetição de código de país em texto:** O `BR` textual bruto aparece ao lado de cada cidade vizinha.

---

### 2.9. Modo Escuro (Dark Mode)
* **Capturas analisadas:** `dark_01_top.png`
* **Pontos de Atenção:**
  - O tema escuro deve utilizar a escala de cinzas profundos da Apple (`#000000` fundo principal, `#1c1c1e` superfície de cards, `#2c2c2e` cartões internos), com bordas em `rgba(255, 255, 255, 0.08)`.
  - Garantir que a paleta de textos secundários não caia abaixo da razão de contraste WCAG 4.5:1.

---

## 3. Matriz de Refatoração Anti-AI-Slop

| Elemento | Sintoma de AI-Slop | Solução Apple Minimalist / Anti-Slop | Arquivo Alvo |
| :--- | :--- | :--- | :--- |
| **Identidade Visual** | Ícone `Sparkles` (`✨`) em logo e header; título bicolor berrante. | Remover sparkles; adotar ícone sóbrio (`Globe2` ou `Compass`); tipografia uniforme em SF Pro. | `LandingSearch.tsx`, `Header.tsx` |
| **Previsão 7 Dias** | Barras horizontais estáticas idênticas (~65% largura fixa). | Barra dinâmica proporcional (`minTemp` e `maxTemp` reais relativos à semana) com gradiente e ponto indicador no dia atual. | `WeatherSection.tsx` |
| **Hero Banner** | 4 pílulas de metadados empilhadas competindo com o texto. | Régua tipográfica elegante e coesa com divisores discretos (`•`). | `HeroBanner.tsx` |
| **Cabeçalho Mobile** | Header empilha em 3 linhas ocupando mais de 200px da tela. | Compactar em barra de ferramentas iOS limpa (uma linha principal + busca recolhível). | `Header.tsx` |
| **Badges de Seção** | Overflow no mobile cortando texto (`12 loc...`). | `flexWrap: 'wrap'` ou ocultar texto longo em telas `< 420px`, mantendo apenas `12`. | `POIsSection.tsx` |
| **Bandeiras de País** | Código de país em texto cru (`Curitiba BR`). | Componente de bandeira ou pill sutil de território (`[PR • BR]`). | `utils.ts`, `LandingSearch.tsx` |
| **Controles do Mapa** | Botões de zoom Leaflet quadrados e brancos dos anos 2010. | CSS customizado para botões flutuantes circulares com blur e cantos suaves. | `InteractiveMap.tsx` |
| **Métricas Climáticas** | 4 cores neon concorrentes (azul, roxo, verde, laranja). | Paleta monocromática ou azul pastel consistente com opacidades sutis. | `WeatherSection.tsx` |

---

## 4. Próximos Passos de Execução

1. **Eliminar todos os resquícios de `Sparkles`** em `LandingSearch.tsx` e `Header.tsx`, substituindo por um símbolo geográfico sóbrio.
2. **Implementar a barra de amplitude térmica real** na previsão de 7 dias em `WeatherSection.tsx`.
3. **Limpar a "sopa de pílulas"** no `HeroBanner.tsx`, convertendo dados em métricas tipográficas com hierarquia clara.
4. **Corrigir o corte de texto (`overflow`) nos badges** no `POIsSection.tsx` para telas móveis.
5. **Modernizar os controles do Leaflet** em `InteractiveMap.tsx` para ficarem perfeitamente integrados ao canvas minimalista.
