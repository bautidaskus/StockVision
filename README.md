# StockVision

Herramienta personal de analisis de inversiones con IA para stocks, ETFs y criptomonedas.

## Estado actual

La app hoy incluye:
- buscador unificado de stocks y crypto
- watchlist persistida en `localStorage`
- portfolio persistido con P&L
- detalle de stocks con grafico, fundamentales, noticias, analisis IA, recommendations, earnings e insiders
- detalle de crypto con grafico y analisis IA
- screener de acciones
- proteccion opcional por contrasena via `APP_PASSWORD`

La fuente de verdad es el codigo. La documentacion fue actualizada para reflejar el estado actual, pero el archivo de referencia operativa mas completo es [docs/PROJECT-CONTEXT.md](/D:/Bauti/StockVision/docs/PROJECT-CONTEXT.md).

## Stack

- Next.js 14 + TypeScript
- React 18
- Tailwind CSS + `shadcn/ui`
- TanStack Query
- Zustand
- Upstash Redis
- Lightweight Charts
- Recharts
- Gemini 2.5 Flash
- Yahoo Finance, Finnhub, CoinGecko, FMP y Alpha Vantage
- Vitest + Testing Library

## Arquitectura resumida

1. El cliente renderiza paginas `use client`.
2. Los componentes consultan rutas internas bajo `app/api/`.
3. Las rutas API leen Redis primero.
4. Ante cache miss, consultan proveedores externos.
5. Varias rutas combinan proveedores con fallbacks.
6. Redis es opcional: si falla, la app sigue.

Notas reales del codigo actual:
- stocks: prioridad Yahoo + Finnhub; Alpha Vantage queda como fallback en overview/history
- indicadores: se calculan localmente desde history, no con llamadas extra a Alpha Vantage
- screener: usa FMP
- crypto: usa CoinGecko
- IA: usa Gemini con streaming

## Estructura principal

```text
app/
  page.tsx
  stock/[ticker]/page.tsx
  crypto/[id]/page.tsx
  screener/page.tsx
  login/page.tsx
  api/

components/
  stock/
  crypto/
  ui/

lib/
  apis/
  cache/
  store/
  format.ts
  indicators.ts
  types.ts

docs/
  PROJECT-CONTEXT.md
  ARCHITECTURE.md
  API-ROUTES.md
  EXTENDING.md
  CONTRIBUTING.md
```

## Variables de entorno

```env
APP_PASSWORD=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
GEMINI_API_KEY=
FINNHUB_API_KEY=
COINGECKO_API_KEY=
ALPHA_VANTAGE_API_KEY=
FMP_API_KEY=
```

Notas:
- `APP_PASSWORD` es opcional. Si no existe, no hay login.
- `ALPHA_VANTAGE_API_KEY` hoy se usa como fallback.
- `FMP_API_KEY` hoy es especialmente importante para screener.

## Comandos

```bash
npm install
npm run dev
npm run build
npm run lint
npm run test:run
```

## Documentacion

- [docs/PROJECT-CONTEXT.md](/D:/Bauti/StockVision/docs/PROJECT-CONTEXT.md): contexto operativo completo
- [docs/ARCHITECTURE.md](/D:/Bauti/StockVision/docs/ARCHITECTURE.md): mapa de capas y decisiones
- [docs/API-ROUTES.md](/D:/Bauti/StockVision/docs/API-ROUTES.md): contratos vigentes de rutas API
- [docs/EXTENDING.md](/D:/Bauti/StockVision/docs/EXTENDING.md): patrones para extender la app
- [docs/CONTRIBUTING.md](/D:/Bauti/StockVision/docs/CONTRIBUTING.md): reglas de trabajo y commits

## Commits

La convencion oficial del repo esta en [docs/CONTRIBUTING.md](/D:/Bauti/StockVision/docs/CONTRIBUTING.md). Formato requerido:

```text
<type>(<scope>): <resumen>
```

Ejemplos:
- `fix(screener): correct FMP field mapping`
- `docs(project): align architecture docs with current providers`
- `refactor(api): isolate internal fetch error handling`

## Verificacion minima antes de commitear

1. `npm run lint`
2. `npm run test:run`
3. `npm run build`

## Licencia

Proyecto personal. Uso privado.
