# StockVision Context

Este archivo resume el contexto esencial del repo para asistentes o futuras sesiones. La referencia mas completa sigue siendo `docs/PROJECT-CONTEXT.md`.

## Proyecto

App personal de analisis financiero con:
- stocks
- ETFs
- crypto
- watchlist
- portfolio
- screener
- analisis IA

## Arquitectura real

- frontend cliente en Next.js App Router
- API interna en `app/api/`
- cache opcional con Upstash Redis
- providers mixtos:
  - Yahoo + Finnhub para la mayor parte de stocks
  - Alpha Vantage como fallback puntual
  - CoinGecko para crypto
  - FMP para screener
  - Gemini para analisis IA

## Puntos importantes

- los indicadores tecnicos se calculan localmente
- `APP_PASSWORD` activa login opcional
- `api/*` no queda protegida por middleware
- la documentacion vieja fue reemplazada y alineada con el codigo actual

## Archivos de entrada recomendados

- `docs/PROJECT-CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/API-ROUTES.md`
- `docs/CONTRIBUTING.md`

## Validacion minima

```bash
npm run lint
npm run test:run
npm run build
```
