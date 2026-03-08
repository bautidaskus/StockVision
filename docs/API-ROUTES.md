# API Routes Reference

Todas las API routes están en `app/api/` y son server-side (las API keys nunca llegan al cliente).

---

## Stock Routes

### GET `/api/stock/[ticker]/overview`

Devuelve datos generales de la acción.

**Fuente:** Alpha Vantage (`OVERVIEW` + `GLOBAL_QUOTE`)
**Caché:** 10 minutos

**Response:**
```typescript
{
  ticker: string           // "AAPL"
  name: string             // "Apple Inc"
  sector: string           // "Technology"
  industry: string         // "Consumer Electronics"
  description: string      // Descripción de la empresa
  price: number            // 185.50
  change: number           // +2.30
  changePercent: number    // +1.25
  marketCap: number        // 2890000000000
  pe: number | null        // 29.5
  forwardPe: number | null // 27.8
  eps: number | null       // 6.28
  dividendYield: number | null // 0.0055
  beta: number | null      // 1.28
  week52High: number       // 199.62
  week52Low: number        // 143.90
  sharesOutstanding: number
  evToEbitda: number | null
  priceToSales: number | null
  priceToBook: number | null
  pegRatio: number | null
}
```

---

### GET `/api/stock/[ticker]/history?range=1y`

Devuelve precios históricos OHLCV.

**Fuente:** Alpha Vantage (`TIME_SERIES_DAILY_ADJUSTED`, outputsize=full)
**Caché:** 1 hora (se cachea el dataset completo y se filtra por rango)
**Query params:** `range` = `1m` | `3m` | `6m` | `1y` | `3y` | `5y`

**Response:**
```typescript
Array<{
  date: string    // "2024-01-15"
  open: number
  high: number
  low: number
  close: number
  volume: number
}>
```

---

### GET `/api/stock/[ticker]/indicators`

Devuelve indicadores técnicos.

**Fuente:** Alpha Vantage (5 calls: `RSI`, `MACD`, `SMA` x3)
**Caché:** 1 hora
**Nota:** Este endpoint consume 5 de los 25 requests diarios de Alpha Vantage.

**Response:**
```typescript
{
  rsi: Array<{ date: string, value: number }>
  macd: Array<{ date: string, macd: number, signal: number, histogram: number }>
  sma20: Array<{ date: string, value: number }>
  sma50: Array<{ date: string, value: number }>
  sma200: Array<{ date: string, value: number }>
}
```

Cada array tiene hasta 200 puntos, ordenados cronológicamente (más antiguo primero).

---

### GET `/api/stock/[ticker]/financials?period=quarterly&limit=8`

Devuelve estados financieros combinados.

**Fuente:** FMP (income-statement, balance-sheet, cash-flow-statement, key-metrics, analyst-estimates, ratios)
**Caché:** 24 horas
**Query params:**
- `period` = `quarterly` | `annual` (default: quarterly)
- `limit` = número de períodos (default: 8)

**Response:**
```typescript
{
  statements: Array<{
    date: string              // "2024-09-30"
    period: string            // "Q3"
    revenue: number
    grossProfit: number
    grossProfitRatio: number  // 0.46 = 46%
    operatingIncome: number
    netIncome: number
    netIncomeRatio: number    // 0.25 = 25%
    eps: number
    epsDiluted: number
    ebitda: number
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
    totalDebt: number
    cashAndEquivalents: number
    operatingCashFlow: number
    freeCashFlow: number
    roe: number | null
    roa: number | null
    debtToEquity: number | null
  }>
  estimates: { ... } | null
  ratios: Array<{ ... }>
}
```

---

### GET `/api/stock/[ticker]/news`

Devuelve noticias recientes.

**Fuente:** Finnhub (`company-news`, últimos 30 días)
**Caché:** 1 hora

**Response:**
```typescript
Array<{
  headline: string
  summary: string
  url: string
  datetime: number    // Unix timestamp (seconds)
  source: string
  image: string
}>
```

Máximo 10 noticias.

---

## Crypto Routes

### GET `/api/crypto/[id]/overview`

**Fuente:** CoinGecko (`/coins/{id}`)
**Caché:** 10 minutos
**Nota:** El `id` es el ID de CoinGecko (e.g., `bitcoin`, `ethereum`), no el símbolo.

**Response:**
```typescript
{
  id: string               // "bitcoin"
  symbol: string           // "BTC"
  name: string             // "Bitcoin"
  image: string            // URL de la imagen
  price: number
  change24h: number
  changePercent24h: number
  marketCap: number
  volume24h: number
  circulatingSupply: number
  totalSupply: number | null
  maxSupply: number | null
  ath: number
  athDate: string
  atl: number
  atlDate: string
  marketCapRank: number
  description: string
}
```

---

### GET `/api/crypto/[id]/history?range=1y`

**Fuente:** CoinGecko (`/coins/{id}/market_chart`)
**Caché:** 1 hora
**Query params:** `range` = `1m` | `3m` | `6m` | `1y` | `3y` | `5y`

**Response:**
```typescript
{
  prices: Array<{ date: string, close: number }>
  volumes: Array<{ date: string, volume: number }>
}
```

---

## AI Analysis

### GET `/api/analyze/[ticker]?type=stock&refresh=false`

Genera análisis con IA usando Google Gemini 2.5 Flash. **Devuelve streaming de texto plano.**

**Caché:** 6 horas
**Query params:**
- `type` = `stock` | `crypto` (default: stock)
- `refresh` = `true` para forzar regeneración ignorando caché

**Response:** `text/plain` streaming (no JSON). El texto contiene Markdown con las secciones:
- `## Resumen Ejecutivo`
- `## Análisis Técnico`
- `## Análisis Fundamental` (stock) o `## Análisis del Ecosistema` (crypto)
- `## Factores de Riesgo`
- `## Veredicto` — contiene `**MOMENTO FAVORABLE**`, `**NEUTRAL**`, o `**MOMENTO DESFAVORABLE**`

**Comportamiento:** Si hay caché válido y no se pide refresh, devuelve el texto completo (no streaming). Si no hay caché, hace streaming desde Gemini y cachea el resultado al terminar.

---

## Search

### GET `/api/search?q=apple`

Búsqueda combinada de stocks y crypto.

**Fuente:** FMP (`/search`) + CoinGecko (`/search`)
**Caché:** No (búsquedas son efímeras)

**Response:**
```typescript
Array<{
  ticker: string      // "AAPL" o "bitcoin" (CoinGecko id)
  name: string        // "Apple Inc" o "Bitcoin"
  type: "stock" | "crypto"
  exchange: string    // "NASDAQ" o "BTC"
  image?: string      // Solo para crypto
}>
```

Devuelve hasta 6 stocks + 4 crypto.

---

## Errores

Todas las rutas devuelven errores con este formato:

```typescript
{ error: string }
```

Códigos HTTP:
- `404` — Ticker/ID no encontrado
- `500` — Error de API externa o error interno
- El mensaje de error incluye detalles ("Alpha Vantage rate limit reached (5/min)", "Ticker not found", etc.)
