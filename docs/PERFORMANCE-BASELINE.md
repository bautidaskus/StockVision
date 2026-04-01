# Performance Baseline

## Fecha

- Medido el 1 de abril de 2026
- Entorno: `next dev` local sobre `127.0.0.1:3100`
- Variables: `.env.local` cargado
- Cache server-side: Upstash Redis activo

## Metodologia

Se tomaron dos tipos de evidencia:

1. Latencia observable por ruta con requests HTTP locales.
2. Spans instrumentados en modo debug con `__perf=1` para medir:
   - tiempo total de handler
   - tiempo por proveedor externo
   - hits y misses de cache
   - tamaño aproximado de payload

Notas:

- Los tiempos `cold` y `warm` son de una primera y segunda ejecución consecutiva.
- En las rutas cacheadas por ticker, algunos misses instrumentados se midieron con tickers frescos (`ADSK`, `MSFT`) para evitar colisiones con cache previa.
- En screener se forzó un miss controlado con `phase0_probe=screener-live-20260401`.

## Baseline HTTP

| Ruta | Caso medido | Cold | Warm | Payload aprox. |
| --- | --- | ---: | ---: | ---: |
| `/api/screener?limit=100` | universo y ranking actual | 1109 ms | 147 ms | 59.4 KB |
| `/api/search?q=aapl` | stocks + crypto | 337 ms | 470 ms | 479 B |
| `/api/stock/AAPL/overview` | overview stock | 3656 ms | 63 ms | 2.3 KB |
| `/api/stock/AAPL/history?range=1y` | history stock | 1522 ms | 168 ms | 34.7 KB |
| `/api/stock/AAPL/indicators` | indicators con fetch interno | 665 ms | 88 ms | 60.2 KB |
| `/api/stock/AAPL/score` | score completo | 2615 ms | 65 ms | 1.7 KB |

## Baseline Instrumentada

### Search

- `/api/search?q=aapl&__perf=1`
- Total observado en spans: `355-926 ms`
- Proveedores:
  - `finnhub./search`: `352-925 ms`
  - `coingecko./search`: `18-89 ms`
- Hotspot:
  - la ruta queda dominada por Finnhub; CoinGecko no es el cuello principal

### Overview

- `/api/stock/ADSK/overview?__perf=1`
- Handler live: `2931-3001 ms`
- Cache miss + set: `~263 ms`
- Proveedores:
  - `yahoo.quoteSummary.quote`: `2218 ms`
  - `finnhub./quote`: `338-505 ms`
  - `finnhub./stock/metric`: `349-441 ms`
- Hotspot:
  - Yahoo domina el costo del overview; Finnhub agrega valor pero no explica el total

### History

- `/api/stock/ADSK/history?range=1y&__perf=1`
- Handler live: `6662 ms`
- Cache miss + set: `1110 ms`
- Proveedor:
  - `yahoo.chart.history`: `5507 ms`
- Hotspot:
  - la descarga completa de 5 años desde Yahoo es el costo central del history cold

### Indicators

- `/api/stock/ADSK/indicators?__perf=1`
- Handler live: `890 ms`
- Etapas:
  - `indicators.fetch-history-route`: `628 ms`
  - `indicators.calculate`: `18.8 ms`
  - `indicators.normalize-history`: `11.2 ms`
- Hotspot:
  - el problema no es el cálculo técnico; es el fetch HTTP interno a `/api/stock/[ticker]/history`

### Score

- `/api/stock/ADSK/score?__perf=1`
- Handler live: `3020 ms`
- Cache miss + set: `475 ms`
- Proveedores:
  - `yahoo.chart.history`: `1134 ms`
  - `yahoo.fundamentalsTimeSeries` quarterly: `1628 ms`
  - `yahoo.fundamentalsTimeSeries` annual: `1797 ms`
  - `yahoo.quoteSummary.quote`: `1943 ms`
  - `yahoo.quoteSummary.insiders`: `2292 ms`
  - `yahoo.quoteSummary.earnings`: `2315 ms`
  - `yahoo.quoteSummary.recommendations`: `2508 ms`
- Hotspot:
  - el score hace demasiadas llamadas Yahoo aun para una sola entidad

### Screener

- `/api/screener?limit=100&phase0_probe=screener-live-20260401&__perf=1`
- Handler live: `89759 ms`
- Provider calls: `706`
- Cache miss + set: `837 ms`
- Etapas:
  - `screener.build-universe`: `3327 ms`
  - `screener.enrich-universe`: `85592 ms`
  - `screener.filter-sort`: `1.3 ms`
- Observaciones:
  - el costo real está casi totalmente en el enriquecimiento ticker por ticker
  - la ruta hace cientos de llamadas Yahoo para construir score y contexto completo
  - el ordenado final no es un problema material

## Hotspots Priorizados

1. Screener: el enriquecimiento masivo del universo actual es el principal cuello de botella por amplio margen.
2. Score: incluso fuera del screener, el cálculo completo por ticker sigue siendo costoso.
3. History cold: descargar y normalizar 5 años completos desde Yahoo tiene costo alto, aunque luego cachea bien.
4. Overview: Yahoo `quoteSummary` domina el cold path.
5. Indicators: la latencia propia es baja; el fetch HTTP interno agrega costo evitable.

## Conclusion De Fase 0

La evidencia confirma el orden del plan original:

1. El screener es la prioridad máxima.
2. La optimización correcta es reducir trabajo por request, no micro-optimizar sorting ni render.
3. `indicators` debe pasar a lógica compartida en `lib/` en una fase posterior.
4. La instrumentación quedó detrás de `SV_PERF_DEBUG=1` o `__perf=1`, sin logs ruidosos por defecto.
