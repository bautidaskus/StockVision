# Fase B — Portfolio CEDEARs + ARS + FX

**Fecha:** 2026-04-17
**Alcance:** que el portfolio soporte CEDEARs argentinos con su ratio y valuación en ARS usando MEP. Stocks US y crypto quedan sin tocar.

## Decisiones

| # | Decisión | Razón |
|---|---|---|
| 1 | Modelo de datos sigue siendo "posición única con avg cost manual". No transacciones. | Minimiza el blast radius y no rompe datos persistidos de zustand. |
| 2 | CEDEARs se agregan por ticker `.BA` (ej. `AAPL.BA`). El precio del subyacente sale del ticker US (`AAPL`), se aplica ratio y FX MEP. | No dependemos de feeds de BYMA/IOL (requieren auth o son inestables). |
| 3 | Lista de ratios curada en `lib/cedears/list.ts`. **Ratio editable en el formulario por posición**, prefillado desde la lista. | Los ratios cambian con splits. El usuario sabe el suyo mejor que la lista estática. |
| 4 | FX MEP desde `https://dolarapi.com/v1/dolares/bolsa`. Cache Redis 15min. | Gratis, sin auth, JSON simple, devuelve compra/venta. |
| 5 | `averageCost` del cedear es en ARS. Para stock/crypto sigue en USD. Semántica por `type`. | Evita migración del schema persistido. |
| 6 | Dual display (ARS + USD) en `PortfolioCard` y `PortfolioSummary`. | Pedido del usuario (4c + 5). |
| 7 | P&L en ARS sale de `avgCostArs` directamente. P&L en USD se calcula con MEP de hoy — es aproximado. | Sin FX histórico gratis; marcamos el USD equivalent como "al MEP de hoy" para no mentir. |

## Fuera de alcance

- Lista de transacciones / historial de compras.
- Otros mercados AR (acciones locales como YPFD.BA listadas en ARS nativo, bonos, ONs).
- Otros dólares (CCL, Blue, Oficial).
- FX histórico por fecha de compra.

## Cambios de código

**Nuevo**
- `lib/cedears/list.ts` — `CEDEAR_RATIOS: Record<string, { underlying, name, ratio }>`. Top ~40 CEDEARs.
- `lib/cedears/index.ts` — `lookupCedear(tickerBA)` helper.
- `lib/services/fx.ts` — `getMepCached()` con TTL 15min.
- `app/api/fx/mep/route.ts` — GET devuelve `{ buy, sell, timestamp }`.
- Tests: `__tests__/lib/cedears.test.ts`, `__tests__/lib/services/fx.test.ts`, `__tests__/app/api/fx-mep.route.test.ts`.

**Modificado**
- `lib/types.ts` — `PortfolioPosition.type` suma `'cedear'`; campo opcional `ratio?: number` (solo cedear); `CACHE_TTL.FX` en `lib/cache/redis.ts`.
- `components/add-position-dialog.tsx` — selector suma "CEDEAR". Cuando `type='cedear'`, ticker sufre `.BA` auto, ratio aparece (prefillado desde lista), label del cost cambia a "Costo Promedio (ARS)".
- `components/portfolio-card.tsx` — para cedear: fetch del underlying US + fetch MEP, calcula precio CEDEAR ARS (= priceUsd / ratio × mep), muestra ARS grande y USD equivalente chico; P&L en ambas monedas.
- `components/portfolio-summary.tsx` — agrega card adicional "Valor ARS" cuando hay cedears; el "Valor Total" en USD sigue válido (convierto cedear a USD con MEP hoy).
- `lib/format.ts` — agregar `formatCurrencyArs(val)` que formatea como `$X.XXX.XXX` sin decimales por default (ARS suelen ser montos grandes).

## Criterios de éxito

- Puedo agregar `AAPL.BA` con ratio 20, ver su precio ARS actual correctamente (≈ priceUsd/20 × MEP), P&L en ARS y USD.
- Si ingreso un cedear fuera de la lista, el formulario me deja poner ratio manual (no bloquea).
- El FX MEP se llama una sola vez por render del portfolio (cacheado en cliente vía TanStack Query).
- Stocks US y crypto existentes siguen funcionando exactamente igual.
- Lint + test + build pasan.

## Verificación

- Unit tests para `lookupCedear`, para la función `cedearPriceArs(priceUsd, ratio, mep)`, para `getMepCached`, para el route `/api/fx/mep`.
- Manual: agregar `AAPL.BA` con ratio 20, cantidad 100, cost ARS 17500 — el card muestra precio ARS y USD actuales y P&L razonable.
