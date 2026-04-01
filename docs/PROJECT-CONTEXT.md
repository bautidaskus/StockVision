# StockVision: Guia de Contexto del Proyecto

## Objetivo de este documento

Este archivo funciona como fuente de contexto operativo para futuras tareas sobre StockVision. Resume la arquitectura real del codigo, los flujos principales, los proveedores de datos, las convenciones y la deuda tecnica visible.

Importante:
- La documentacion previa (`README.md`, `docs/ARCHITECTURE.md`, `docs/API-ROUTES.md`, `docs/EXTENDING.md`, `CLAUDE.md`) es util, pero algunas partes quedaron desactualizadas.
- Cuando haya contradicciones, la fuente de verdad debe ser el codigo actual.

## Que es StockVision hoy

StockVision es una app personal de analisis de inversiones construida con Next.js App Router. Permite:
- buscar acciones, ETFs y criptomonedas
- ver detalle de stocks con grafico, fundamentales, noticias, consenso de analistas, earnings, insiders y analisis IA
- ver detalle de crypto con grafico y analisis IA
- mantener una watchlist local
- mantener un portfolio local con P&L
- correr un screener de acciones con filtros basicos
- proteger el acceso con una contrasena opcional via `APP_PASSWORD`

No es una app multiusuario. No hay base de datos propia. El estado persistente del usuario vive en `localStorage` y el cache server-side vive en Upstash Redis cuando esta configurado.

## Stack real

- Next.js 14 + TypeScript
- React 18
- Tailwind CSS + componentes `shadcn/ui`
- TanStack Query para fetch/caching en cliente
- Zustand + `persist` para watchlist y portfolio
- Lightweight Charts para velas e indicadores
- Recharts para graficos de fundamentales/otros datos
- Upstash Redis para cache server-side
- Gemini 2.5 Flash para analisis IA
- `yahoo-finance2`, Finnhub, FMP, CoinGecko y Alpha Vantage como proveedores de datos
- Vitest + Testing Library para tests

## Estado actual del repo

El worktree esta sucio. Hay cambios ya presentes del usuario o recientes en varias areas:
- screener
- portfolio
- earnings / insiders / recommendations
- tests
- documentacion auxiliar

No asumir un estado limpio antes de editar. Revisar `git status --short` antes de tocar algo delicado.

## Arquitectura de alto nivel

Flujo principal:

1. El cliente renderiza paginas y componentes `use client`.
2. Los componentes consultan rutas internas bajo `app/api/` usando `fetch` o TanStack Query.
3. Las API routes consultan Redis primero.
4. Si no hay cache, llaman proveedores externos.
5. Algunas rutas combinan varios proveedores con fallbacks.
6. La respuesta se cachea y vuelve al cliente.

Patrones importantes:
- las keys sensibles no salen al cliente
- Redis es opcional; si falla, la app sigue funcionando
- varias rutas ya no dependen primariamente de Alpha Vantage
- los indicadores tecnicos se calculan localmente desde precios historicos para ahorrar requests

## Estructura funcional

### Paginas

- `app/page.tsx`
  Home con buscador, watchlist, portfolio y accesos rapidos.

- `app/stock/[ticker]/page.tsx`
  Pagina de stock con tabs:
  - grafico
  - fundamentales
  - analistas
  - earnings
  - insiders
  - analisis IA
  - noticias

- `app/crypto/[id]/page.tsx`
  Pagina de crypto con tabs:
  - grafico
  - analisis IA

- `app/screener/page.tsx`
  Screener con filtros, presets y tabla sortable.

- `app/login/page.tsx`
  Pantalla de login cuando `APP_PASSWORD` esta configurado y no hay cookie valida.

### Layout y providers

- `app/layout.tsx`
  Define fuentes, navbar simple y monta `Providers`.

- `components/providers.tsx`
  Crea el `QueryClient` global con `staleTime` de 5 minutos y sin refetch al enfocar ventana.

### Estado local

- `lib/store/watchlist.ts`
  Persistencia en `stockvision-watchlist`.

- `lib/store/portfolio.ts`
  Persistencia en `stockvision-portfolio`.
  `addPosition` hace upsert por ticker.

## Seguridad y acceso

Hay autenticacion minima basada en contrasena:

- `middleware.ts`
  Protege todas las rutas salvo:
  - `/login`
  - `/api/*`
  - assets de Next
  - archivos estaticos

- `app/api/auth/route.ts`
  Valida `APP_PASSWORD`, genera token HMAC y setea cookie `sv-auth`.

Comportamiento:
- si `APP_PASSWORD` no existe, no hay proteccion
- las rutas API quedan abiertas incluso cuando el frontend esta protegido

Eso ultimo es relevante: el middleware excluye `/api/*`, asi que la proteccion es de acceso a UI, no de backend interno.

## Proveedores de datos: realidad actual

### Stocks

`/api/stock/[ticker]/overview`
- prioridad: Finnhub + Yahoo
- fallback: Alpha Vantage
- usa cache de 10 min

`/api/stock/[ticker]/history`
- prioridad: Yahoo historical
- fallback: Alpha Vantage
- cachea dataset completo y luego filtra por rango

`/api/stock/[ticker]/indicators`
- no llama Alpha Vantage
- llama a la propia ruta de history y calcula RSI, MACD y SMA en `lib/indicators.ts`
- cache 1 hora

`/api/stock/[ticker]/financials`
- usa Yahoo Finance
- hoy devuelve `statements`
- hoy deja `estimates: null` y `ratios: []`

`/api/stock/[ticker]/news`
- usa Finnhub

`/api/stock/[ticker]/recommendations`
- usa Finnhub recommendation trends
- calcula consenso y total de analistas

`/api/stock/[ticker]/earnings`
- usa Yahoo

`/api/stock/[ticker]/insiders`
- usa Yahoo

### Search

`/api/search`
- prioridad para stocks: Finnhub search
- fallback para stocks: Yahoo search
- crypto: CoinGecko search
- devuelve stocks primero

### Crypto

`/api/crypto/[id]/overview`
- CoinGecko

`/api/crypto/[id]/history`
- CoinGecko

### Screener

`/api/screener`
- usa un fast path por fases:
  - preferido: FMP screener cuando la credencial lo permite
  - equivalente: universo Yahoo + batch quote para filtros compatibles
  - fallback final: ranking enriquecido legacy
- cachea por filtros ordenados y separa la variante base de la variante con `scoreWindow`
- el score ya no se calcula para todo el universo por defecto
- la UI mantiene `draftFilters` y `appliedFilters`; no consulta por cada keypress
- el enriquecimiento del score se limita a una ventana chica y llega despues de la tabla base

### IA

`/api/analyze/[ticker]`
- usa Gemini
- consulta otras rutas internas primero
- soporta `type=stock|crypto`
- soporta `refresh=true`
- si encuentra cache, responde texto completo
- si no encuentra cache, hace streaming y cachea el texto final

## Inconsistencias relevantes entre tipos, docs y codigo

Estas son importantes para no confiar ciegamente en la documentacion:

1. `lib/apis/alphavantage.ts` sigue existiendo, pero ya no es la fuente primaria para overview/history/indicators.
2. `docs/API-ROUTES.md` y `docs/ARCHITECTURE.md` describen una app mas centrada en Alpha Vantage y FMP para varias rutas. Eso ya no refleja el flujo principal.
3. `docs/EXTENDING.md` dice que no hay tests, pero si los hay.
4. Algunos filtros del screener solo pueden resolverse en el fast path equivalente o en el fallback legacy:
   - `sector`
   - `roeMin`
   - `netMarginMin`
   - `debtToEquityMax`
5. El score del screener ahora es parcial por diseño:
   - base: `scoreStatus = not-requested`
   - enriquecido: `scoreStatus = ready`
   - fallo parcial: `scoreStatus = unavailable`
6. `CLAUDE.md` es mejor que los docs viejos, pero tambien mezcla descripcion vigente con supuestos anteriores.

## Cache y TTLs

Definidos en `lib/cache/redis.ts`:

- `OVERVIEW`: 600
- `HISTORY`: 3600
- `INDICATORS`: 3600
- `FINANCIALS`: 86400
- `NEWS`: 3600
- `AI_ANALYSIS`: 21600
- `RECOMMENDATIONS`: 3600
- `EARNINGS`: 86400
- `INSIDERS`: 86400
- `SCREENER`: 3600

Funciones utiles:
- `getCached`
- `setCached`
- `cacheKey`

Patron de key:
- `sv:${prefix}:${parts.join(':')}`

Redis es tolerante a fallas:
- si faltan env vars, retorna `null`
- si falla `get` o `set`, hace `console.warn` y sigue

## Componentes clave y responsabilidades

### Home

- `components/search-bar.tsx`
  Busqueda con debounce manual de 300ms, dropdown y navegacion por router.

- `components/watchlist-card.tsx`
  Obtiene overview + history por item para mostrar precio, variacion y sparkline.

- `components/portfolio-summary.tsx`
  Usa `useQueries` para traer overview de cada posicion y calcular valor total, costo total y P&L.

- `components/portfolio-card.tsx`
  Tarjeta individual de posicion.

- `components/add-position-dialog.tsx`
  Alta/edicion de posiciones.

### Stock

- `components/stock/stock-header.tsx`
  Muestra datos basicos y toggle de watchlist.

- `components/stock/candlestick-chart.tsx`
  Grafico principal con:
  - velas
  - volumen opcional
  - SMA20/50/200 opcionales
  - subgrafico RSI + MACD

  Detalle tecnico:
  - importa `lightweight-charts` dinamicamente
  - evita calls extra usando `/api/stock/[ticker]/indicators`
  - los indicadores se alinean por fecha contra el history visible

- `components/stock/fundamentals-tab.tsx`
  Consume financieros y muestra metricas/graficos.

- `components/stock/ai-analysis-tab.tsx`
  Lee stream manualmente con `ReadableStreamDefaultReader`.
  Tiene renderer markdown casero, no usa libreria externa.

- `components/stock/news-section.tsx`
- `components/stock/recommendations-section.tsx`
- `components/stock/earnings-section.tsx`
- `components/stock/insiders-section.tsx`

### Crypto

- `components/crypto/crypto-header.tsx`
- `components/crypto/crypto-chart.tsx`

## Tipos utiles

`lib/types.ts` concentra la mayoria de interfaces:
- `StockOverview`
- `OHLCV`
- `TechnicalIndicators`
- `FinancialStatement`
- `NewsItem`
- `CryptoOverview`
- `AnalystRecommendation`
- `EarningsData`
- `InsiderData`
- `PortfolioPosition`
- `ScreenerFilters`
- `ScreenerResult`

Si se cambia la forma de una API route, normalmente tambien hay que tocar `lib/types.ts`.

## Utilidades compartidas

- `lib/format.ts`
  Formato monetario, porcentajes, grandes numeros, quarters y color por valor.

- `lib/indicators.ts`
  Implementa SMA, RSI, EMA y MACD localmente.
  Este archivo es importante porque reduce fuerte la dependencia de Alpha Vantage.

- `lib/utils.ts`
  Utilidad base de `cn`.

## Tests actuales

La suite actual si existe y hoy pasa:
- `npm run test:run`
- resultado observado: 5 archivos, 19 tests, todo OK

Cobertura presente:
- wrappers de Yahoo, Finnhub y screener
- store de portfolio
- componente `screener-results`

Cobertura faltante o debil:
- middleware/auth
- rutas API
- watchlist store
- AI analysis y streaming
- graficos
- crypto routes/components

## Variables de entorno reales

Segun el codigo actual, estas variables importan:

- `APP_PASSWORD`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GEMINI_API_KEY`
- `FINNHUB_API_KEY`
- `COINGECKO_API_KEY`
- `ALPHA_VANTAGE_API_KEY`
- `FMP_API_KEY`

Notas:
- `ALPHA_VANTAGE_API_KEY` hoy es mas fallback que dependencia primaria.
- `FMP_API_KEY` hoy se usa sobre todo para screener y no para overview/history comunes.

## Riesgos y deuda tecnica visibles

1. Documentacion interna parcialmente desalineada con el codigo.
2. `Alpha Vantage` sigue presente como fallback, pero algunos textos del proyecto lo describen como proveedor central.
3. El screener ya expone metadatos de procedencia (`primaryDataSource`, `scoreSource`, `scoreStatus`), pero los consumidores viejos pueden ignorarlos.
4. El fast path preferido de FMP depende del plan de la credencial; si devuelve `402/403`, entra el fast path equivalente o el fallback legacy.
5. La ruta de analisis IA cachea bajo `cacheKey('analysis', ticker)` sin incluir `type`; si existiera el mismo identificador para stock y crypto, podria haber colision conceptual.
6. La UI protegida por password no protege las API routes.
7. Hay mucha logica importante acoplada a fetches internos (`/api/...`) en vez de abstraerse mas; esto es simple pero agrega acoplamiento entre rutas.

## Como encarar cambios futuros sin perder tiempo

### Si el cambio toca datos de mercado

Primero revisar:
- `app/api/stock/...` o `app/api/crypto/...`
- `lib/apis/...`
- `lib/types.ts`
- `lib/cache/redis.ts`

Preguntas clave:
- el dato viene de proveedor primario o fallback
- hay que cachearlo
- afecta algun componente de home, stock, crypto o screener

### Si el cambio toca UI

Primero revisar:
- pagina en `app/...`
- componente principal asociado
- tipos consumidos
- query keys de TanStack Query

### Si el cambio toca portfolio o watchlist

Primero revisar:
- `lib/store/watchlist.ts`
- `lib/store/portfolio.ts`
- componentes de home

### Si el cambio toca IA

Primero revisar:
- `app/api/analyze/[ticker]/route.ts`
- `components/stock/ai-analysis-tab.tsx`

Especial cuidado con:
- cache
- streaming
- prompts
- dependencia de rutas internas

## Checklist rapido antes de editar

1. Confirmar si la documentacion vieja aplica o no.
2. Revisar `git status --short`.
3. Verificar si el tipo en `lib/types.ts` sigue alineado con la respuesta real.
4. Confirmar si hay cache Redis para esa ruta o feature.
5. Si se toca una ruta API, revisar fallbacks y manejo de errores.
6. Si se toca una feature existente, correr al menos `npm run test:run`.

## Convencion de commits

Formato obligatorio:

```text
<type>(<scope>): <resumen>
```

Tipos permitidos:
- `fix`
- `feat`
- `refactor`
- `docs`
- `test`
- `chore`
- `perf`

Reglas:
- usar imperativo
- una sola idea por commit
- evitar `WIP`
- si el cambio es relevante, agregar cuerpo corto con motivo y validacion

Checklist antes de commitear:
1. `git status --short`
2. `npm run lint`
3. `npm run test:run`
4. `npm run build`

## Archivos que conviene leer primero en cualquier tarea

- `app/page.tsx`
- `app/layout.tsx`
- `app/stock/[ticker]/page.tsx`
- `app/crypto/[id]/page.tsx`
- `app/screener/page.tsx`
- `app/api/analyze/[ticker]/route.ts`
- `app/api/stock/[ticker]/overview/route.ts`
- `app/api/stock/[ticker]/history/route.ts`
- `app/api/stock/[ticker]/indicators/route.ts`
- `lib/types.ts`
- `lib/cache/redis.ts`
- `lib/indicators.ts`
- `lib/store/watchlist.ts`
- `lib/store/portfolio.ts`

## Resumen ejecutivo para futuras sesiones

Si hubiera que describir el proyecto en pocas lineas:

StockVision es una app personal de analisis financiero en Next.js, centrada en stocks y crypto, con cache Redis, estado local persistido, screener, portfolio y analisis IA por streaming. El codigo real hoy prioriza Yahoo y Finnhub para stocks, usa CoinGecko para crypto, reserva Alpha Vantage como fallback, y calcula indicadores tecnicos localmente para ahorrar cuota. La documentacion historica existe pero no siempre refleja este estado, asi que conviene partir del codigo y usar este archivo como mapa de entrada.
