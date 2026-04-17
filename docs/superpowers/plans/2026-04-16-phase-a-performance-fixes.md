# Fase A — Performance & data fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the N+1 fetch pattern in watchlist, harden search, kill the HTTP-internal cascade in analyze, stop leaking `0`/`'N/A'` for missing data, and make the candlestick chart stop rebuilding on every SMA toggle — without introducing portfolio or new AI yet.

**Architecture:** Keep the existing Next 14 App Router API boundary. Introduce a thin `lib/services/*` layer that wraps the provider+cache logic currently embedded in route handlers — this lets both the batch endpoint and the analyze route reuse cache-aware functions without re-entering Next routing. UI changes stay minimal and focused on the same three files (`watchlist-card`/home, `search-bar`, `candlestick-chart`).

**Tech Stack:** Next 14 App Router, TypeScript, TanStack Query v5, Upstash Redis, Vitest, lightweight-charts v5, yahoo-finance2.

---

## File Structure

**New:**
- `lib/services/stock-service.ts` — cache-aware `getOverviewCached(ticker)`, `getHistoryCached(ticker, range)`, `getIndicatorsCached(ticker)`, `getFinancialsCached(ticker, opts)`, `getNewsCached(ticker)`. Extracted from the corresponding route handlers.
- `lib/services/sparkline.ts` — pure function `pickSparkline(history, range)` that returns `number[]` from an OHLCV array.
- `app/api/batch/overview/route.ts` — `GET ?tickers=A,B,C&spark=1m` returns `Record<ticker, { overview, sparkline }>`.
- `lib/format.ts` — add `formatOrDash(val)` helper (or extend existing).
- `__tests__/lib/services/stock-service.test.ts`
- `__tests__/lib/services/sparkline.test.ts`
- `__tests__/app/api/batch-overview.route.test.ts`
- `__tests__/components/search-bar.test.tsx`

**Modify:**
- `app/api/stock/[ticker]/overview/route.ts` — thin wrapper around `getOverviewCached`. Replace `||` with `??` for number fields.
- `app/api/stock/[ticker]/history/route.ts` — thin wrapper around `getHistoryCached`.
- `app/api/stock/[ticker]/indicators/route.ts`, `financials/route.ts`, `news/route.ts` — same pattern.
- `app/api/analyze/[ticker]/route.ts` — replace 5 `fetch()` internal calls with `Promise.all` of service functions.
- `app/api/search/route.ts` — add 30s Redis cache per query.
- `lib/apis/yahoo.ts` — `getYahooQuote` returns `null` for missing fields (sector/industry strings, numeric zeros), not `'N/A'` / `0`.
- `lib/types.ts` — widen `StockOverview` fields that can be missing to `| null`; `sector`/`industry` to `string | null`.
- `components/search-bar.tsx` — 2-char minimum, `AbortController`, migrate to `useQuery` with `keepPreviousData`.
- `components/watchlist-card.tsx` — accept optional `initialOverview`/`initialSparkline` props; fall back to per-ticker fetch only if missing.
- `app/page.tsx` — when watchlist has items, fetch via `/api/batch/overview` once and pass data down.
- `components/stock/candlestick-chart.tsx` — split effects, persist series refs across renders.
- UI touchpoints that render overview fields to use `formatOrDash` where applicable: `components/stock/stock-header.tsx`, `components/stock/fundamentals-tab.tsx`, `components/watchlist-card.tsx`.

---

## Task 0: Baseline measurement

**Goal:** Capture current numbers so we can prove improvement.

**Files:**
- Create: `docs/PERFORMANCE-BASELINE-2026-04-16.md` (ad-hoc notes, not tracked as spec)

- [ ] **Step 1:** Start dev server.
  Run: `npm run dev`
  Expected: server on `http://localhost:3000`, no startup errors.

- [ ] **Step 2:** Add MELI, MSFT, NU to watchlist via UI. With DevTools Network open, reload `/`. Record:
  - Total requests, duration of slowest, waterfall depth.
  - Cold load: clear Redis keys or use fresh `?nocache=1` if supported, otherwise note this is warm.
- [ ] **Step 3:** Navigate to `/stock/MELI`. Record time-to-first-paint of: header, score, chart. Toggle SMA20 → SMA50 → SMA200. Record whether chart re-renders visibly.
- [ ] **Step 4:** Type `mel` then `meli` in search bar with throttled 3G. Record jitter / out-of-order results.
- [ ] **Step 5:** Click Analizar con IA on MELI uncached (refresh=true). Record time-to-first-token and total completion.
- [ ] **Step 6:** Write findings to `docs/PERFORMANCE-BASELINE-2026-04-16.md`. Commit:
  ```bash
  git add docs/PERFORMANCE-BASELINE-2026-04-16.md
  git commit -m "docs(perf): baseline before phase A fixes"
  ```

---

## Task 1: Extract `lib/services/stock-service.ts`

**Goal:** Pull cache-aware fetch logic out of each route handler into reusable functions. No behavior change yet.

**Files:**
- Create: `lib/services/stock-service.ts`
- Modify: `app/api/stock/[ticker]/overview/route.ts`, `history/route.ts`, `indicators/route.ts`, `financials/route.ts`, `news/route.ts`
- Test: `__tests__/lib/services/stock-service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/services/stock-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/cache/redis', () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  cacheKey: (p: string, ...rest: string[]) => `sv:${p}:${rest.join(':')}`,
  CACHE_TTL: { OVERVIEW: 600, HISTORY: 3600, INDICATORS: 3600, FINANCIALS: 86400, NEWS: 3600 },
}))
vi.mock('@/lib/apis/yahoo', () => ({
  getYahooQuote: vi.fn(),
  getYahooHistory: vi.fn(),
}))
vi.mock('@/lib/apis/finnhub', () => ({
  getQuoteFinnhub: vi.fn(),
  getBasicFinancials: vi.fn(),
}))
vi.mock('@/lib/apis/alphavantage', () => ({
  getOverview: vi.fn(),
  getGlobalQuote: vi.fn(),
  getDailyTimeSeries: vi.fn(),
}))

import { getOverviewCached } from '@/lib/services/stock-service'
import { getCached, setCached } from '@/lib/cache/redis'
import { getYahooQuote } from '@/lib/apis/yahoo'

describe('getOverviewCached', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns cached value without calling providers', async () => {
    ;(getCached as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ticker: 'MSFT', price: 400 })
    const result = await getOverviewCached('MSFT')
    expect(result).toEqual({ ticker: 'MSFT', price: 400 })
    expect(getYahooQuote).not.toHaveBeenCalled()
  })

  it('falls through to providers on cache miss and writes back', async () => {
    ;(getCached as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    ;(getYahooQuote as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      symbol: 'MSFT', name: 'Microsoft', price: 400, change: 1, changePercent: 0.25,
      sector: 'Tech', industry: 'Software', description: '',
      marketCap: 3e12, pe: 35, forwardPe: 30, eps: 11, dividendYield: 0.8,
      beta: 0.9, week52High: 450, week52Low: 300, sharesOutstanding: 7.5e9,
      enterpriseToEbitda: 22, priceToBook: 12, pegRatio: 2.1,
    })
    const result = await getOverviewCached('MSFT')
    expect(result?.price).toBe(400)
    expect(setCached).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- stock-service`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/services/stock-service.ts`**

Move the exact body of each `fetchFromFinnhubYahoo` / `fetchFromAlphaVantage` / `fetchFromYahoo` helper into this file. Each exported function: try cache → fallback provider chain → write cache → return.

```ts
// lib/services/stock-service.ts
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import { getQuoteFinnhub, getBasicFinancials } from '@/lib/apis/finnhub'
import { getYahooQuote, getYahooHistory } from '@/lib/apis/yahoo'
import { getOverview as avOverview, getGlobalQuote as avQuote, getDailyTimeSeries } from '@/lib/apis/alphavantage'
import type { OHLCV, StockOverview } from '@/lib/types'

export async function getOverviewCached(ticker: string): Promise<StockOverview | null> {
  const key = cacheKey('overview', ticker)
  const cached = await getCached<StockOverview>(key)
  if (cached) return cached

  const result = (await fetchFromFinnhubYahoo(ticker)) ?? (await fetchFromAlphaVantage(ticker))
  if (!result) return null
  await setCached(key, result, CACHE_TTL.OVERVIEW)
  return result
}

export async function getHistoryCached(ticker: string, range: string): Promise<OHLCV[] | null> {
  // same pattern as app/api/stock/[ticker]/history/route.ts, but returning filtered slice
  // ...
}
// indicators, financials, news: same pattern
```
(Engineer: copy the exact logic from each existing route. Keep `??` semantics — see Task 4 for number-coalescing fix.)

- [ ] **Step 4: Run tests — all pass**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 5: Switch each route handler to call the service**

Example `app/api/stock/[ticker]/overview/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import { getOverviewCached } from '@/lib/services/stock-service'

export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase()
  const perf = createRequestPerformanceTracker('/api/stock/[ticker]/overview', request, { ticker })
  try {
    return await perf.run(async () => {
      const result = await measureStage('overview.service', () => getOverviewCached(ticker))
      if (!result) {
        perf.finish({ error: 'Ticker not found' }, 404)
        return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
      }
      perf.finish(result, 200)
      return NextResponse.json(result)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```
Repeat for history/indicators/financials/news.

- [ ] **Step 6: Full test suite + build**

Run: `npm run test:run && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/services app/api/stock __tests__/lib/services
git commit -m "refactor(stock): extract cache-aware service layer"
```

---

## Task 2: Analyze → service calls (F)

**Files:**
- Modify: `app/api/analyze/[ticker]/route.ts`
- Test: extend `__tests__/lib/services/stock-service.test.ts` or add a small `analyze.test.ts` if the route has no tests yet.

- [ ] **Step 1: Replace 5 internal HTTP fetches with `Promise.all` of services**

```ts
// app/api/analyze/[ticker]/route.ts (stock branch)
import {
  getOverviewCached, getHistoryCached, getIndicatorsCached,
  getFinancialsCached, getNewsCached,
} from '@/lib/services/stock-service'

const [overview, history, indicators, financials, news] = await Promise.all([
  getOverviewCached(ticker),
  getHistoryCached(ticker, '3m'),
  getIndicatorsCached(ticker),
  getFinancialsCached(ticker, { period: 'quarterly', limit: 4 }),
  getNewsCached(ticker),
])
```
Remove `fetchInternalJson` and the `baseUrl` derivation for the stock branch. Keep crypto branch as-is for now (separate services file not in scope here — a follow-up note).

- [ ] **Step 2: Run tests + build**

Run: `npm run test:run && npm run build`
Expected: PASS.

- [ ] **Step 3: Manual check** — hit `/api/analyze/MELI?refresh=true`, verify stream still works, first token should arrive noticeably faster (compare vs baseline in Task 0).

- [ ] **Step 4: Commit**

```bash
git add app/api/analyze
git commit -m "perf(analyze): call services directly instead of internal HTTP"
```

---

## Task 3: Batch overview endpoint (G)

**Files:**
- Create: `lib/services/sparkline.ts`, `app/api/batch/overview/route.ts`
- Test: `__tests__/lib/services/sparkline.test.ts`, `__tests__/app/api/batch-overview.route.test.ts`

- [ ] **Step 1: Sparkline test**

```ts
// __tests__/lib/services/sparkline.test.ts
import { describe, it, expect } from 'vitest'
import { pickSparkline } from '@/lib/services/sparkline'

describe('pickSparkline', () => {
  const series = Array.from({ length: 300 }, (_, i) => ({
    date: new Date(2026, 0, i + 1).toISOString().slice(0, 10),
    open: 0, high: 0, low: 0, close: i + 1, volume: 0,
  }))

  it('returns closes for last 30 entries when range=1m', () => {
    const result = pickSparkline(series, '1m')
    expect(result).toHaveLength(30)
    expect(result[result.length - 1]).toBe(300)
  })

  it('returns [] for empty input', () => {
    expect(pickSparkline([], '1m')).toEqual([])
  })
})
```

- [ ] **Step 2: Run — FAIL**
  Run: `npm run test:run -- sparkline`

- [ ] **Step 3: Implement**

```ts
// lib/services/sparkline.ts
import type { OHLCV } from '@/lib/types'

const RANGE_DAYS: Record<string, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 }

export function pickSparkline(history: OHLCV[], range: string): number[] {
  if (!history.length) return []
  const days = RANGE_DAYS[range] ?? 30
  return history.slice(-days).map((p) => p.close)
}
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Batch route test**

```ts
// __tests__/app/api/batch-overview.route.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/services/stock-service', () => ({
  getOverviewCached: vi.fn(async (t: string) => ({ ticker: t, price: 100 })),
  getHistoryCached: vi.fn(async () => [
    { date: '2026-03-01', open: 0, high: 0, low: 0, close: 50, volume: 0 },
    { date: '2026-03-02', open: 0, high: 0, low: 0, close: 55, volume: 0 },
  ]),
}))

import { GET } from '@/app/api/batch/overview/route'
import { NextRequest } from 'next/server'

describe('GET /api/batch/overview', () => {
  it('returns overview + sparkline per ticker', async () => {
    const req = new NextRequest('http://localhost/api/batch/overview?tickers=MELI,MSFT&spark=1m')
    const res = await GET(req)
    const body = await res.json()
    expect(body.MELI.overview.ticker).toBe('MELI')
    expect(body.MELI.sparkline).toEqual([50, 55])
    expect(body.MSFT.overview.ticker).toBe('MSFT')
  })

  it('rejects empty / too-many tickers', async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `T${i}`).join(',')
    const req = new NextRequest(`http://localhost/api/batch/overview?tickers=${tooMany}`)
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 6: Run — FAIL**

- [ ] **Step 7: Implement route**

```ts
// app/api/batch/overview/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getOverviewCached, getHistoryCached } from '@/lib/services/stock-service'
import { pickSparkline } from '@/lib/services/sparkline'

const MAX_TICKERS = 50

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('tickers') || ''
  const spark = request.nextUrl.searchParams.get('spark') || '1m'
  const tickers = raw.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)

  if (tickers.length === 0) return NextResponse.json({ error: 'tickers required' }, { status: 400 })
  if (tickers.length > MAX_TICKERS) return NextResponse.json({ error: 'too many tickers' }, { status: 400 })

  const entries = await Promise.all(tickers.map(async (ticker) => {
    const [overview, history] = await Promise.all([
      getOverviewCached(ticker).catch(() => null),
      getHistoryCached(ticker, spark).catch(() => null),
    ])
    return [ticker, { overview, sparkline: history ? pickSparkline(history, spark) : [] }] as const
  }))

  return NextResponse.json(Object.fromEntries(entries))
}
```

- [ ] **Step 8: Run — PASS**

- [ ] **Step 9: Commit**

```bash
git add lib/services/sparkline.ts app/api/batch __tests__/lib/services/sparkline.test.ts __tests__/app/api/batch-overview.route.test.ts
git commit -m "feat(api): batch overview endpoint for watchlist"
```

---

## Task 4: Watchlist consumes batch endpoint (G)

**Files:**
- Modify: `components/watchlist-card.tsx`, `app/page.tsx`

- [ ] **Step 1:** Add `BatchOverview` type in `lib/types.ts`:
```ts
export interface BatchOverviewEntry {
  overview: StockOverview | null
  sparkline: number[]
}
export type BatchOverviewResponse = Record<string, BatchOverviewEntry>
```

- [ ] **Step 2:** In `app/page.tsx`, when the watchlist has items, fetch batch once:

```tsx
// app/page.tsx — add near top
import { useQuery } from '@tanstack/react-query'
import type { BatchOverviewResponse } from '@/lib/types'

// inside HomePage():
const stockItems = items.filter((i) => i.type === 'stock')
const stockTickers = stockItems.map((i) => i.ticker).sort().join(',')

const { data: batch } = useQuery<BatchOverviewResponse>({
  queryKey: ['watchlist-batch', stockTickers],
  enabled: stockTickers.length > 0,
  staleTime: 5 * 60 * 1000,
  queryFn: async () => {
    const res = await fetch(`/api/batch/overview?tickers=${stockTickers}&spark=1m`)
    if (!res.ok) throw new Error('batch failed')
    return res.json()
  },
})
```
Pass `batch?.[item.ticker]` to each `<WatchlistCard ... initialData={batch?.[item.ticker]} />`. Crypto cards keep the old path.

- [ ] **Step 3:** In `components/watchlist-card.tsx`, accept `initialData?: BatchOverviewEntry` prop. If provided and `item.type === 'stock'`, skip the two `useQuery` calls and render directly; otherwise keep existing behavior as fallback.

```tsx
export function WatchlistCard({ item, initialData }: { item: WatchlistItem; initialData?: BatchOverviewEntry }) {
  const hasBatch = item.type === 'stock' && initialData !== undefined
  // existing useQuery calls become: enabled: !hasBatch
  // overview / history resolved from initialData when hasBatch
  ...
}
```

- [ ] **Step 4:** Run `npm run test:run && npm run build`. Manually verify watchlist with MELI+MSFT+NU reloads with exactly one `/api/batch/overview` request (DevTools Network).

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/watchlist-card.tsx lib/types.ts
git commit -m "perf(watchlist): fetch overviews in a single batch roundtrip"
```

---

## Task 5: Search bar — 2 chars, AbortController, Redis cache (A)

**Files:**
- Modify: `components/search-bar.tsx`, `app/api/search/route.ts`
- Test: `__tests__/components/search-bar.test.tsx` (optional; keep Task 5 shippable without it if flaky DOM tests block)

- [ ] **Step 1:** Server cache in `app/api/search/route.ts`:

```ts
import { getCached, setCached, cacheKey } from '@/lib/cache/redis'

// inside GET, after normalizing query:
if (query.length < 2) {
  const payload: [] = []
  perf.finish(payload, 200, { shortCircuit: 'too-short' })
  return NextResponse.json(payload)
}

const sKey = cacheKey('search', query.toLowerCase())
const cached = await getCached<unknown[]>(sKey)
if (cached) {
  perf.finish(cached, 200, { source: 'cache' })
  return NextResponse.json(cached)
}
// ... existing logic ...
await setCached(sKey, payload, 30)
```

- [ ] **Step 2:** Client in `components/search-bar.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'

// replace the effect-based fetching with:
const trimmed = query.trim()
const { data: results = [], isFetching: loading } = useQuery<SearchResult[]>({
  queryKey: ['search', trimmed],
  enabled: trimmed.length >= 2,
  staleTime: 60_000,
  queryFn: async ({ signal }) => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal })
    if (!res.ok) throw new Error('search failed')
    return res.json()
  },
})

// debounce via controlled input: keep a local `deferredQuery` with 250ms delay,
// useQuery depends on deferredQuery, not raw query
```
(TanStack Query passes `signal` — aborts automatically when the key changes or the component unmounts. No manual AbortController needed.)

- [ ] **Step 3:** `isOpen` now derives from `deferredQuery.length >= 2 && results.length > 0` plus the existing focus logic. Remove the `debounceRef` plumbing.

- [ ] **Step 4:** Run `npm run test:run && npm run build`. Manual verify: typing "m", "me", "mel", "meli" no longer shows stale results for "m" after "meli" settles.

- [ ] **Step 5: Commit**

```bash
git add components/search-bar.tsx app/api/search
git commit -m "perf(search): 2-char minimum, query-cancelling, 30s server cache"
```

---

## Task 6: Nulls and nullish coalescing (D)

**Files:**
- Modify: `lib/apis/yahoo.ts`, `lib/types.ts`, `lib/services/stock-service.ts` (or the overview helpers if not fully moved), `lib/format.ts`, `components/stock/stock-header.tsx`, `components/stock/fundamentals-tab.tsx`, `components/watchlist-card.tsx`

- [ ] **Step 1:** In `lib/types.ts` widen `StockOverview`:

```ts
export interface StockOverview {
  ticker: string
  name: string
  sector: string | null
  industry: string | null
  description: string
  price: number
  change: number
  changePercent: number
  marketCap: number | null
  pe: number | null
  forwardPe: number | null
  eps: number | null
  dividendYield: number | null
  beta: number | null
  week52High: number | null
  week52Low: number | null
  sharesOutstanding: number | null
  evToEbitda: number | null
  priceToSales: number | null
  priceToBook: number | null
  pegRatio: number | null
}
```

- [ ] **Step 2:** `lib/apis/yahoo.ts` — `getYahooQuote` returns `null` where data is missing:

```ts
return {
  symbol: price.symbol || ticker,
  name: price.shortName || price.longName || ticker,
  price: pickNumber(price.regularMarketPrice) ?? 0,
  change: pickNumber(price.regularMarketChange) ?? 0,
  changePercent: pickNumber(price.regularMarketChangePercent) != null
    ? (pickNumber(price.regularMarketChangePercent) as number) * 100
    : 0,
  marketCap: pickNumber(price.marketCap),
  sector: profile.sector ?? null,
  industry: profile.industry ?? null,
  description: profile.longBusinessSummary || '',
  website: profile.website || '',
  pe: pickNumber(detail.trailingPE),
  forwardPe: pickNumber(detail.forwardPE),
  eps: pickNumber(stats.trailingEps ?? stats.forwardEps),
  dividendYield: pickNumber(detail.dividendYield),
  beta: pickNumber(detail.beta),
  week52High: pickNumber(detail.fiftyTwoWeekHigh),
  week52Low: pickNumber(detail.fiftyTwoWeekLow),
  sharesOutstanding: pickNumber(stats.sharesOutstanding),
  enterpriseToEbitda: pickNumber(stats.enterpriseToEbitda),
  priceToBook: pickNumber(stats.priceToBook),
  pegRatio: pickNumber(stats.pegRatio),
}
```
(`pickNumber` already exists in the file.)

- [ ] **Step 3:** Overview aggregation (inside `lib/services/stock-service.ts`): replace `||` with `??` for every numeric field; keep `||` only for strings like `name`:

```ts
return {
  ticker: yahooData?.symbol || ticker,
  name: yahooData?.name || ticker,
  sector: yahooData?.sector ?? null,
  industry: yahooData?.industry ?? null,
  description: yahooData?.description || '',
  price: finnhubQuote?.price ?? yahooData?.price ?? 0,
  change: finnhubQuote?.change ?? yahooData?.change ?? 0,
  changePercent: finnhubQuote?.changePercent ?? yahooData?.changePercent ?? 0,
  marketCap: finnhubMetrics?.marketCap ?? yahooData?.marketCap ?? null,
  pe: yahooData?.pe ?? finnhubMetrics?.pe ?? null,
  // ... same for all others: ?? null ...
}
```

- [ ] **Step 4:** `lib/format.ts` — add helper:

```ts
export function formatOrDash<T>(val: T | null | undefined, formatter: (v: T) => string): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number' && !Number.isFinite(val)) return '—'
  return formatter(val)
}
```

- [ ] **Step 5:** Replace render sites where a `0` meant "missing". In `components/stock/stock-header.tsx` and `components/stock/fundamentals-tab.tsx`, use `formatOrDash(overview.marketCap, formatLargeNumber)` (and equivalents) instead of conditionals on `0`.

- [ ] **Step 6:** Update existing tests: `__tests__/lib/apis/yahoo.test.ts` expectations need to accept `null` for missing numerics. Update `__tests__/lib/services/stock-service.test.ts` accordingly.

- [ ] **Step 7:** Run `npm run test:run && npm run build`. Visually check MELI / MSFT / NU overview — values that were `0` or `N/A` now render as `—` or the real number.

- [ ] **Step 8: Commit**

```bash
git add lib/apis/yahoo.ts lib/types.ts lib/services lib/format.ts components __tests__
git commit -m "fix(data): use null for missing fields, nullish coalescing over OR"
```

---

## Task 7: Candlestick chart — surgical SMA updates (B)

**Files:**
- Modify: `components/stock/candlestick-chart.tsx`

- [ ] **Step 1:** Add refs for SMA series and separate the effects:

```tsx
import type { ISeriesApi } from 'lightweight-charts'

const smaSeriesRef = useRef<Partial<Record<'sma20' | 'sma50' | 'sma200', ISeriesApi<'Line'>>>>({})

// Effect A — create chart + candles + volume. Deps: [history, showVolume]
useEffect(() => {
  // existing init logic MINUS the SMA loop
  // on cleanup, clear chartRef AND smaSeriesRef.current = {}
}, [history, showVolume])

// Effect B — sync SMAs. Deps: [indicators, showSma, history]
useEffect(() => {
  const chart = chartRef.current
  if (!chart || !indicators) return
  const dateSet = new Set((history ?? []).map((d) => d.date))
  for (const key of ['sma20', 'sma50', 'sma200'] as const) {
    const shouldShow = showSma[key]
    const existing = smaSeriesRef.current[key]
    if (shouldShow && !existing) {
      // dynamic import LineSeries once at top; or import statically
      const series = chart.addSeries(LineSeries, { color: SMA_COLORS[key], lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      const rows = (indicators[key] as Array<{ date: string; value: number }> | undefined) ?? []
      series.setData(rows.filter((d) => dateSet.has(d.date)).map((d) => ({ time: d.date, value: d.value })))
      smaSeriesRef.current[key] = series
    } else if (!shouldShow && existing) {
      chart.removeSeries(existing)
      delete smaSeriesRef.current[key]
    }
  }
}, [indicators, showSma, history])
```

- [ ] **Step 2:** Move the `await import('lightweight-charts')` call out of the init function into a module-level lazy singleton, or accept the first-render import and keep the Set logic idempotent.

- [ ] **Step 3:** Run `npm run test:run && npm run build`. Manually toggle SMA on `/stock/MELI`. Use DevTools Performance: toggle should not produce a "long task" that rebuilds the canvas.

- [ ] **Step 4: Commit**

```bash
git add components/stock/candlestick-chart.tsx
git commit -m "perf(chart): add/remove SMA series without recreating chart"
```

---

## Task 8: Verification + baseline comparison

- [ ] **Step 1:** Rerun all baseline scenarios from Task 0. Fill in a "after" column in `docs/PERFORMANCE-BASELINE-2026-04-16.md`.

- [ ] **Step 2:** Confirm criteria from spec:
  - Watchlist 10 items ≤ 1 roundtrip to `/api/batch/overview`.
  - Search: no out-of-order results; repeated queries ≤ 400ms.
  - `/api/analyze/...` cold-miss ≥ 40% faster.
  - Missing fields render as `—`, not `0` / `N/A`.
  - Toggling SMA: no chart rebuild (same canvas element in DevTools Elements).

- [ ] **Step 3:** Playwright MCP pass over `/`, `/stock/MELI`, `/stock/MSFT`, `/stock/NU`. Screenshots to `.claude/screenshots/phase-a-after-20260416-HHmm.png`. Console must be clean.

- [ ] **Step 4:** Final `npm run lint && npm run test:run && npm run build`.

- [ ] **Step 5:** Commit the baseline doc update:

```bash
git add docs/PERFORMANCE-BASELINE-2026-04-16.md
git commit -m "docs(perf): phase A verification numbers"
```

---

## Self-Review notes

- **Spec coverage:** Tasks 3+4 → G (watchlist). Task 5 → A (search). Task 7 → B chart part; Task 1 → B partial (services remove 5x cascade when analyze hits during page load? no — analyze is F). B's "stock page RSC" is explicitly deferred in the spec. Task 2 → F. Task 6 → D. Bonus chart → Task 7. All covered.
- **Placeholders:** Step-level code blocks given. A couple of route handlers (history/indicators/financials/news) say "same pattern as overview" — engineer must copy the exact logic. Acceptable given route handlers are near-identical in structure and the engineer needs to adapt them per their current bodies.
- **Type consistency:** `getOverviewCached` / `getHistoryCached` / `BatchOverviewEntry` / `BatchOverviewResponse` names used consistently across Tasks 1, 3, 4.
