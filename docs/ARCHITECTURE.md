# Arquitectura de StockVision

## Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌───────────┐ │
│  │ Homepage  │  │ Stock Detail │  │  Crypto   │  │ Watchlist  │ │
│  │ Search    │  │ Chart/Fund/  │  │  Detail   │  │ (Zustand)  │ │
│  │ Watchlist │  │ AI/News Tabs │  │ Chart/AI  │  │ localStorage│
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘  └───────────┘ │
│       │               │                │                        │
│       └───────────────┼────────────────┘                        │
│                       │ TanStack Query (useQuery)               │
│                       ▼                                         │
├─────────────────── fetch() ─────────────────────────────────────┤
│                                                                 │
│                    NEXT.JS API ROUTES (Server)                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Redis Cache Layer                      │    │
│  │              (Upstash Redis — lib/cache/redis.ts)         │    │
│  │                                                           │    │
│  │  getCached(key) ──▶ hit? return cached data              │    │
│  │                     miss? ──▶ call external API           │    │
│  │                              setCached(key, data, ttl)    │    │
│  └──────────────────────┬──────────────────────────────────┘    │
│                         │ (on cache miss)                       │
│                         ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   External APIs                           │   │
│  │                                                           │   │
│  │  Alpha Vantage ─── overview, prices, RSI, MACD, SMA      │   │
│  │  FMP ───────────── financials, ratios, search, estimates  │   │
│  │  Finnhub ────────── company news                          │   │
│  │  CoinGecko ──────── crypto prices, market data, search    │   │
│  │  Google Gemini ──── AI analysis (streaming)               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Capas del Sistema

### 1. Capa de Presentación (`app/` + `components/`)

Páginas de Next.js App Router con componentes React client-side.

| Página | Ruta | Descripción |
|--------|------|-------------|
| Homepage | `/` | Buscador, watchlist, acceso rápido |
| Stock | `/stock/[ticker]` | Detalle de acción/ETF con 4 tabs |
| Crypto | `/crypto/[id]` | Detalle de cripto con 2 tabs |

**Patrón de data fetching:** Cada componente usa `useQuery()` de TanStack Query que hace `fetch()` a las API routes internas. TanStack Query maneja el caché del lado cliente (staleTime: 5 min) y estados de loading/error.

### 2. Capa de API Routes (`app/api/`)

Endpoints server-side de Next.js que actúan como proxy a las APIs externas. Protegen las API keys y manejan la lógica de caché.

**Flujo de cada route:**
```
Request → Check Redis cache → (hit) Return cached → (miss) Call external API → Cache result → Return
```

**Rutas de stock:** 5 endpoints bajo `/api/stock/[ticker]/`
- `overview` — 2 calls Alpha Vantage (OVERVIEW + GLOBAL_QUOTE)
- `history` — 1 call Alpha Vantage (TIME_SERIES_DAILY_ADJUSTED, full output)
- `indicators` — 5 calls Alpha Vantage (RSI + MACD + SMA20 + SMA50 + SMA200)
- `financials` — 6 calls FMP (income + balance + cashflow + metrics + estimates + ratios)
- `news` — 1 call Finnhub (company-news)

**Rutas de crypto:** 2 endpoints bajo `/api/crypto/[id]/`
- `overview` — 1 call CoinGecko (coins/{id})
- `history` — 1 call CoinGecko (coins/{id}/market_chart)

**Ruta de AI:** `/api/analyze/[ticker]`
- Hace fetch interno a overview + history + indicators + financials + news
- Construye prompt estructurado con datos reales
- Llama Gemini con streaming (`generateContentStream`)
- Devuelve `ReadableStream` al cliente

**Ruta de búsqueda:** `/api/search`
- Busca en paralelo en FMP (stocks) y CoinGecko (crypto)
- Devuelve resultados combinados

### 3. Capa de Caché (`lib/cache/redis.ts`)

Redis (Upstash) con TTLs configurables. Funciones principales:

```typescript
getCached<T>(key: string): Promise<T | null>        // Lee del caché
setCached<T>(key: string, data: T, ttl: number)     // Escribe con TTL
cacheKey(prefix: string, ...parts: string[]): string // Genera key: "sv:prefix:part1:part2"
```

**Patrón de keys:** `sv:{tipo}:{params}` — ejemplo: `sv:overview:AAPL`, `sv:history:AAPL`, `sv:crypto-overview:bitcoin`

**Fallback:** Si Redis no responde, las funciones retornan `null` / no-op en vez de lanzar errores.

### 4. Capa de APIs Externas (`lib/apis/`)

Wrappers tipados para cada API externa. Cada archivo exporta funciones async que hacen fetch directo. No manejan caché (eso lo hace la API route).

| Archivo | API | Funciones principales |
|---------|-----|----------------------|
| `alphavantage.ts` | Alpha Vantage | `getOverview`, `getGlobalQuote`, `getDailyTimeSeries`, `getRSI`, `getMACD`, `getSMA` |
| `fmp.ts` | Financial Modeling Prep | `getIncomeStatement`, `getBalanceSheet`, `getCashFlowStatement`, `getKeyMetrics`, `getAnalystEstimates`, `getRatios`, `searchTicker` |
| `finnhub.ts` | Finnhub | `getCompanyNews` |
| `coingecko.ts` | CoinGecko | `getCoinData`, `getCoinMarketChart`, `searchCoins` |

### 5. Capa de Estado (`lib/store/`)

**Watchlist (Zustand + persist):**
- Store: `useWatchlist`
- Persistencia: `localStorage` bajo key `stockvision-watchlist`
- Acciones: `addItem`, `removeItem`, `hasItem`
- Cada item: `{ ticker, name, type: 'stock' | 'crypto', addedAt }`

## Gráficos

### Lightweight Charts (TradingView)
Usado en `candlestick-chart.tsx` y `crypto-chart.tsx`. Se importa dinámicamente (`import()`) porque es client-only.

**Stock chart:** Candlestick + volume histogram + SMA lines (opcionales) + RSI + MACD en sub-chart.

**Crypto chart:** Area chart + volume histogram.

### Recharts
Usado en `fundamentals-tab.tsx` para gráficos de barras (Revenue, Net Income, EPS trimestrales).

## Streaming de IA

El análisis con Gemini usa streaming end-to-end:

```
API Route                              Client Component
─────────                              ────────────────
model.generateContentStream(prompt)    fetch('/api/analyze/AAPL')
    │                                       │
    ▼                                       ▼
for await (chunk of result.stream)     reader = response.body.getReader()
    │                                       │
    ▼                                       ▼
controller.enqueue(encode(text))       while (true) { reader.read() }
    │                                       │
    ▼                                       ▼
ReadableStream ──────────────────────▶ setAnalysis(fullText)
                                       (re-renders progressively)
```

Después del streaming completo, el texto final se guarda en Redis (TTL: 6 horas).

## Manejo de Errores

- API routes devuelven `{ error: string }` con status 4xx/5xx
- Componentes muestran mensajes claros cuando hay error
- Redis failures son silenciosos (log + fallback)
- Alpha Vantage rate limits devuelven error descriptivo ("25/day limit" o "5/min limit")
