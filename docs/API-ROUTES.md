# API Routes vigentes

Todas las rutas viven bajo `app/api/` y son server-side.

Formato de error comun:

```json
{ "error": "mensaje" }
```

## Auth

### `POST /api/auth`

Body:

```json
{ "password": "..." }
```

Efecto:
- valida `APP_PASSWORD`
- setea cookie `sv-auth`

### `DELETE /api/auth`

Efecto:
- elimina cookie `sv-auth`

## Search

### `GET /api/search?q=apple`

Proveedores:
- stocks: Finnhub, fallback Yahoo
- crypto: CoinGecko

Respuesta:

```ts
Array<{
  ticker: string
  name: string
  type: 'stock' | 'crypto'
  exchange: string
  image?: string
}>
```

## Screener

### `GET /api/screener?...`

Proveedor:
- FMP

Filtros soportados hoy por implementacion:
- `exchange`
- `sector`
- `marketCapMin`
- `marketCapMax`
- `peMin`
- `peMax`
- `pbMin`
- `pbMax`
- `roeMin`
- `netMarginMin`
- `betaMin`
- `betaMax`
- `debtToEquityMax`
- `dividendMin`
- `limit`

Respuesta:
- `ScreenerResult[]`

## Stocks

### `GET /api/stock/[ticker]/overview`

Prioridad:
- Finnhub + Yahoo
- fallback Alpha Vantage

Cache:
- `CACHE_TTL.OVERVIEW`

Respuesta:
- `StockOverview`

### `GET /api/stock/[ticker]/history?range=1y`

Prioridad:
- Yahoo
- fallback Alpha Vantage

Ranges:
- `1m`
- `3m`
- `6m`
- `1y`
- `3y`
- `5y`

Respuesta:
- `OHLCV[]`

### `GET /api/stock/[ticker]/indicators`

Fuente:
- history interna + calculo local en `lib/indicators.ts`

Respuesta:

```ts
{
  rsi: Array<{ date: string; value: number }>
  macd: Array<{ date: string; macd: number; signal: number; histogram: number }>
  sma20: Array<{ date: string; value: number }>
  sma50: Array<{ date: string; value: number }>
  sma200: Array<{ date: string; value: number }>
}
```

### `GET /api/stock/[ticker]/financials?period=quarterly&limit=8`

Proveedor:
- Yahoo

Respuesta actual:

```ts
{
  statements: FinancialStatement[]
  estimates: null
  ratios: []
}
```

### `GET /api/stock/[ticker]/news`

Proveedor:
- Finnhub

Respuesta:
- `NewsItem[]`

### `GET /api/stock/[ticker]/recommendations`

Proveedor:
- Finnhub

Respuesta:

```ts
{
  recommendations: AnalystRecommendation[]
  consensus: string
  totalAnalysts: number
}
```

### `GET /api/stock/[ticker]/earnings`

Proveedor:
- Yahoo

Respuesta:
- `EarningsData`

### `GET /api/stock/[ticker]/insiders`

Proveedor:
- Yahoo

Respuesta:
- `InsiderData`

## Crypto

### `GET /api/crypto/[id]/overview`

Proveedor:
- CoinGecko

Respuesta:
- `CryptoOverview`

### `GET /api/crypto/[id]/history?range=1y`

Proveedor:
- CoinGecko

Respuesta:

```ts
{
  prices: Array<{ date: string; close: number }>
  volumes: Array<{ date: string; volume: number }>
}
```

## IA

### `GET /api/analyze/[ticker]?type=stock&refresh=false`

Proveedor:
- Gemini 2.5 Flash

Tipos:
- `stock`
- `crypto`

Comportamiento:
- busca cache por `type + ticker`
- si hay cache y no se fuerza refresh, responde texto completo
- si no hay cache, hace streaming

Respuesta:
- `text/plain`

El contenido incluye estas secciones:
- `## Resumen Ejecutivo`
- `## Análisis Técnico`
- `## Análisis Fundamental` o `## Análisis del Ecosistema`
- `## Factores de Riesgo`
- `## Veredicto`
