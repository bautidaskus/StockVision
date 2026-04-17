# Phase A — Baseline vs After (2026-04-16)

Session to fix the highest-impact performance and data issues before starting portfolio / FX work.

## Setup

- Local dev (`npm run dev`) on Windows.
- Cookies + localStorage scripted via playwright MCP (`bauti123` password, watchlist preloaded with MELI / MSFT / NU).
- Upstash Redis instance `optimal-cobra-19251.upstash.io` was dead (NXDOMAIN). This was discovered during the audit and turned out to be the top performance killer.

## Timings

| Scenario | Before | After |
|---|---|---|
| `/api/stock/MELI/overview` cold miss | 14 357 ms | 622 ms (warm Yahoo-local); 4 316 ms (very first compile+fetch) |
| `/api/stock/MSFT/overview` cold miss | 14 461 ms | 656 ms warm / 4 662 ms first |
| `/api/stock/NU/overview` | — | 853 ms warm |
| Home with 3-ticker watchlist | Cascade of 6 requests, each 14 s+ waiting on DNS | 6 parallel requests, all finish in ~1 s combined once warm |
| `/api/search?q=meli` first run | Fired on every keystroke (1 char included); out-of-order results possible | Only fires on ≥ 2 chars; request cancellation via TanStack `signal`; 2 302 ms first, 30 s server cache afterwards |
| Toggling SMA 20 / 50 / 200 | Chart destroyed + recreated | Canvas DOM node identity preserved (`sameNode === true`); series added/removed in place |
| `/api/analyze/MELI` cold miss | 5 internal HTTP calls + double middleware/caching | Single `Promise.all` over lib service functions; direct cache hits |

**Delta that matters:** the Redis DNS hang of ~14 s per cache op was eliminated by a 500 ms race timeout + 60 s circuit breaker cooldown. That alone explains the 10×-20× improvement on almost every endpoint.

## Data quality fixes

Rendered MELI page now shows:
- Div Yield: `—` (was `N/A`)
- Shares Out: `—` (was `0.00`)
- Market Cap / P/E / EPS / 52W High/Low: real numbers (unchanged)
- Sector / Industry badges: `Consumer Cyclical`, `Internet Retail` (unchanged — were already present for this ticker)

Field types in `StockOverview` widened to `| null` for `sector`, `industry`, `marketCap`, `week52High`, `week52Low`, `sharesOutstanding`. Formatters (`formatCurrency`, `formatLargeNumber`, `formatPercent`, `safeFixed`) now accept `number | null | undefined` and render `—` for missing values.

## Remaining work (out of scope for this session)

- `/api/batch/overview` endpoint to consolidate the watchlist fan-out — deferred to Phase B when portfolio brings many positions.
- Stock page migration to RSC with streaming — only if future measurements show the client-first-paint is still a problem.
- Fresh Upstash instance (or alternative cache backend) — the circuit breaker makes this non-blocking but without a live cache every request hits Yahoo directly.
