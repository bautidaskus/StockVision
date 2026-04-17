# Fase A — Performance & data fixes

**Fecha:** 2026-04-16
**Alcance:** arreglar base existente antes de sumar portfolio (Fase B) y repensar análisis (Fase C).

## Síntomas reportados

A. Búsqueda lenta al tipear.
B. Página de stock tarda en el primer render.
D. Datos fundamentales con `N/A` o `0` donde debería haber número o guión.
F. Análisis IA tarda mucho.
G. Watchlist lenta.

## Diagnóstico

### G — Watchlist N+1 de fetches
`components/watchlist-card.tsx:17-41` dispara **dos queries independientes por card**: overview + history (`range=1m`). Con 10 tickers son 20 requests paralelos; el browser limita 6 concurrent por origen → cascada. Además la ruta `/api/stock/[ticker]/history` siempre pide 5 años a Yahoo y filtra en memoria (`app/api/stock/[ticker]/history/route.ts:41-82`), aun para un sparkline de 30 puntos.

### A — Búsqueda
`components/search-bar.tsx:36-62`:
- dispara con 1 char (demasiado agresivo, el backend arranca Finnhub + CoinGecko).
- sin `AbortController` → respuestas tardías sobrescriben nuevas.
- sin cache cliente (aunque hay TanStack Query, no se usa acá).

### B — Stock page tiempo a primer render
`app/stock/[ticker]/page.tsx` es entera `'use client'`. Pierde streaming de Next. En mount: StockHeader + OpportunityScoreCard + CandlestickChart todos simultáneos (≥4 requests). El score compuesto internamente agrega llamadas más.

### F — IA
`app/api/analyze/[ticker]/route.ts:29-43` hace **5 `fetch()` internos** a sus propias rutas (`/api/stock/.../overview|history|indicators|financials|news`). Re-entra a routing, re-parsea headers, re-ejecuta middleware. En cache hit se evita; en cache miss paga 5x.

### D — Datos faltantes o en cero
- `app/api/stock/[ticker]/overview/route.ts:73-99` usa `||` en lugar de `??`; para campos que pueden ser 0 legítimo (change, dividendYield) reemplaza con el siguiente provider.
- `getYahooQuote()` devuelve strings `'N/A'` para sector/industry y números `0` como default — la UI no distingue "faltante" de "cero real".

### Bonus — Candlestick recrea chart en cada toggle
`components/stock/candlestick-chart.tsx:175`: effect depende de `[history, indicators, showVolume, showSma]`. Cada click en SMA destruye y recrea el chart entero.

## Cambios propuestos (orden de ejecución)

1. **Batch endpoint para watchlist**
   - Nueva ruta `GET /api/batch/overview?tickers=AAPL,KO,...&spark=1m` → `{[ticker]: {overview, sparkline}}`.
   - En server: leer de Redis en bloque, solo pegar al provider los que faltan, consolidar sparkline desde cache de history si existe.
   - `WatchlistCard` cambia a consumir un único `useQuery` compartido (hoisted al padre o `useQueries` que comparta key).
   - Métrica objetivo: 10 tickers ≤ 1 roundtrip.

2. **Search bar endurecido**
   - Mín. 2 chars.
   - `AbortController` por cada request, cancelar en `onChange` / unmount.
   - Migrar a `useQuery` con `keepPreviousData` (TanStack Query ya está).
   - Server: cache Redis 30s por query (`sv:search:<q>`).

3. **Analyze: directo a lib, no HTTP interno**
   - Refactor a `Promise.all([getOverview(ticker), getHistoryCached(ticker, '3m'), getIndicatorsCached(ticker), getFinancials(...), getNews(ticker)])` usando funciones lib directas (extraer la lógica de cache+fetch de las rutas a `lib/services/*.ts`).
   - Evita doble cache-lookup y doble middleware.

4. **Overview + yahoo: nulls y `??`**
   - Cambiar `||` → `??` para números en overview route.
   - `getYahooQuote`: sector/industry `null` en vez de `'N/A'`; `marketCap/eps/etc` `null` en vez de `0`.
   - Tipos en `lib/types.ts`: que esos campos sean `number | null`.
   - UI: `formatOrDash(val)` que convierte `null/undefined/NaN` → `'—'`.

5. **Candlestick chart: update quirúrgico de series**
   - Separar effects: uno para crear chart + price data (deps: `[history]`), otro para SMAs (deps: `[indicators, showSma]`) que **agrega/quita series** sobre el chart existente.
   - Guardar refs a cada serie SMA en `useRef<Map>`.

6. *(opcional)* **Stock page → RSC con streaming**
   - `app/stock/[ticker]/page.tsx` pasa a server component; hace prefetch de overview + history en server, pasa a children por props + `HydrationBoundary`.
   - Se evalúa solo si después de 1-5 el page sigue sintiéndose lento.

## Criterios de éxito

- Watchlist con 10 items renderiza en ≤ 1s en red local (antes: ~3-5s por cascada).
- Búsqueda no muestra resultados fuera de orden, primer sugerencia ≤ 400ms para queries repetidas.
- `/api/analyze/...` en cache miss: baja ≥ 40% vs baseline.
- Campos 0/N/A dejan de aparecer donde el dato no existe — se muestra `—`.
- Toggle SMA no recrea el chart (ver en DevTools: canvas mismo nodo).

## Fuera de alcance (Fase B y C)

- Portfolio con CEDEARs, ARS, FX, precio promedio.
- Alternativas a Gemini / señales cuantitativas puras.
- Migración de stock page a RSC si los pasos 1-5 alcanzan.

## Verificación

Por cambio: `npm run lint && npm run test:run && npm run build`. UI: playwright MCP sobre `http://localhost:3000`, medir timings network y comparar con baseline actual. Tickers de prueba: los que el usuario provea (CEDEARs típicos: AAPL, KO, VIST).
