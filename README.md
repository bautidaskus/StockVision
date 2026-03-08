# StockVision

Herramienta personal de análisis de inversiones con inteligencia artificial.

Analiza acciones, ETFs y criptomonedas con gráficos de velas, indicadores técnicos (RSI, MACD, SMA), datos fundamentales y análisis generado por IA (Gemini 2.5 Flash). Tema oscuro estilo Bloomberg/TradingView.

## Stack

- **Next.js 14** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui**
- **Lightweight Charts** (TradingView) — gráficos de velas
- **Recharts** — gráficos de datos fundamentales
- **TanStack Query** — data fetching y caché cliente
- **Zustand** — estado global (watchlist persistida en localStorage)
- **Upstash Redis** — caché server-side de APIs externas

## APIs Externas

| API | Uso | Límite Free |
|-----|-----|-------------|
| Alpha Vantage | Precios, overview, indicadores técnicos | 25 req/día, 5 req/min |
| Financial Modeling Prep | Financieros, ratios, búsqueda, estimaciones | 250 req/día |
| Finnhub | Noticias por ticker | 60 req/min |
| CoinGecko | Precios y datos de criptomonedas | 30 req/min |
| Google Gemini 2.5 Flash | Análisis con IA (streaming) | ~1000 req/día |

## Setup Local

### 1. Clonar e instalar

```bash
git clone https://github.com/bautidaskus/StockVision.git
cd StockVision
npm install
```

### 2. Configurar variables de entorno

Crear `.env.local` en la raíz del proyecto:

```env
ALPHA_VANTAGE_API_KEY=tu_key_aqui
FMP_API_KEY=tu_key_aqui
FINNHUB_API_KEY=tu_key_aqui
COINGECKO_API_KEY=tu_key_aqui
GEMINI_API_KEY=tu_key_aqui
UPSTASH_REDIS_REST_URL=tu_url_aqui
UPSTASH_REDIS_REST_TOKEN=tu_token_aqui
```

**Dónde obtener las keys:**
- Alpha Vantage: [alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
- FMP: [financialmodelingprep.com/developer](https://financialmodelingprep.com/developer)
- Finnhub: [finnhub.io/register](https://finnhub.io/register)
- CoinGecko: [coingecko.com/en/api](https://www.coingecko.com/en/api)
- Gemini: [aistudio.google.com](https://aistudio.google.com) → "Get API key" (gratis, sin tarjeta)
- Upstash Redis: [upstash.com](https://upstash.com) → crear una base Redis

### 3. Correr en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Funcionalidades

### Homepage (`/`)
- Barra de búsqueda por ticker o nombre (stocks + crypto)
- Watchlist personal con precio actual, variación % y sparkline
- Acceso rápido a los activos más populares

### Página de Stock (`/stock/[ticker]`)
- **Header:** nombre, precio, variación, market cap, sector, industria
- **Tab Gráfico:** velas con Lightweight Charts, selectores de timeframe (1M-5Y), toggles SMA20/50/200, volumen, paneles RSI y MACD
- **Tab Fundamentales:** métricas de valuación (P/E, EV/EBITDA, P/S, PEG), salud financiera (márgenes, ROE, ROA, deuda), crecimiento YoY, gráficos de Revenue/Income/EPS trimestrales
- **Tab Análisis IA:** análisis streaming con Gemini — resumen ejecutivo, técnico, fundamental, riesgos y veredicto (Favorable/Neutral/Desfavorable)
- **Tab Noticias:** últimas noticias del ticker vía Finnhub

### Página de Crypto (`/crypto/[id]`)
- Header con precio, market cap, volumen 24h, supply, ATH/ATL
- Gráfico de precios histórico (area chart)
- Análisis IA adaptado a criptomonedas

## Estrategia de Caché

Redis (Upstash) con TTLs diferenciados para respetar los límites de Alpha Vantage:

| Dato | TTL |
|------|-----|
| Overview / precio | 10 minutos |
| Histórico de precios | 1 hora |
| Indicadores técnicos | 1 hora |
| Fundamentales | 24 horas |
| Noticias | 1 hora |
| Análisis IA | 6 horas |

Si Redis no está disponible, la app funciona igual haciendo fallback a las APIs directamente.

## Deploy en Vercel

1. Conectar el repo en [vercel.com](https://vercel.com)
2. Configurar las 7 variables de entorno
3. Deploy automático en cada push a `main`

## Estructura del Proyecto

```
app/                          # Páginas y API routes (Next.js App Router)
├── page.tsx                  # Homepage
├── stock/[ticker]/page.tsx   # Detalle de stock
├── crypto/[id]/page.tsx      # Detalle de crypto
└── api/                      # API routes (server-side)

components/                   # Componentes React
├── stock/                    # Componentes de la página de stocks
├── crypto/                   # Componentes de la página de crypto
└── ui/                       # Componentes shadcn/ui

lib/                          # Lógica compartida
├── apis/                     # Wrappers de APIs externas
├── cache/                    # Capa de caché Redis
├── store/                    # Zustand stores
├── types.ts                  # Interfaces TypeScript
└── format.ts                 # Utilidades de formateo
```

## Licencia

Proyecto personal. Uso privado.
