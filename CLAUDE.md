# StockVision — Claude Code Context

## What is this project?

StockVision is a **personal investment analysis tool** — a single-user web app (no auth, no multi-tenant) for analyzing stocks, ETFs, and cryptocurrencies. It combines real-time market data with AI-powered analysis (Google Gemini 2.5 Flash).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (dark theme) |
| Stock Charts | Lightweight Charts (TradingView) |
| Data Charts | Recharts (bar charts for fundamentals) |
| Data Fetching | TanStack Query (React Query) |
| Global State | Zustand with persist middleware (localStorage) |
| Server Cache | Upstash Redis |
| AI | Google Gemini 2.5 Flash via `@google/generative-ai` SDK |

## Architecture Overview

```
Browser ──▶ Next.js Pages (React) ──▶ Next.js API Routes ──▶ Redis Cache ──▶ External APIs
                                                                    │
                                                            (cache miss)
                                                                    ▼
                                                          Alpha Vantage / FMP
                                                          Finnhub / CoinGecko
                                                          Google Gemini
```

**All external API calls go through Next.js API routes** — never from the client directly (API keys would be exposed).

## Critical Constraints

### Alpha Vantage Rate Limits
- **25 requests/day** on the free tier
- **5 requests/minute** rate limit
- Redis caching is MANDATORY, not optional
- The indicators endpoint (`/api/stock/[ticker]/indicators`) uses 5 Alpha Vantage calls per request (RSI + MACD + SMA20 + SMA50 + SMA200)
- Always check cache before making API calls

### Cache TTLs (defined in `lib/cache/redis.ts`)
- Overview: 10 minutes
- History: 1 hour
- Indicators: 1 hour
- Financials: 24 hours
- News: 1 hour
- AI Analysis: 6 hours

### Redis Fallback
If Redis is unavailable, the app falls back to direct API calls. Never let a Redis failure break the app.

## Project Structure

```
app/
├── page.tsx                              # Homepage: search bar + watchlist + quick access
├── stock/[ticker]/page.tsx               # Stock detail page (4 tabs)
├── crypto/[id]/page.tsx                  # Crypto detail page (2 tabs)
└── api/
    ├── stock/[ticker]/
    │   ├── overview/route.ts             # Alpha Vantage OVERVIEW + GLOBAL_QUOTE
    │   ├── history/route.ts              # Alpha Vantage TIME_SERIES_DAILY_ADJUSTED
    │   ├── indicators/route.ts           # Alpha Vantage RSI, MACD, SMA(20,50,200)
    │   ├── financials/route.ts           # FMP income/balance/cashflow + metrics
    │   └── news/route.ts                 # Finnhub company-news
    ├── crypto/[id]/
    │   ├── overview/route.ts             # CoinGecko coin data
    │   └── history/route.ts              # CoinGecko market chart
    ├── analyze/[ticker]/route.ts         # Gemini AI streaming analysis
    └── search/route.ts                   # FMP + CoinGecko combined search

components/
├── stock/
│   ├── stock-header.tsx                  # Price, change, sector, watchlist toggle
│   ├── candlestick-chart.tsx             # Lightweight Charts with SMA/volume/RSI/MACD
│   ├── fundamentals-tab.tsx              # Metrics grid + Recharts bar charts
│   ├── ai-analysis-tab.tsx               # Streaming AI analysis with verdict badge
│   └── news-section.tsx                  # News feed from Finnhub
├── crypto/
│   ├── crypto-header.tsx                 # Crypto price, supply, ATH/ATL
│   └── crypto-chart.tsx                  # Area chart for crypto prices
├── ui/                                   # shadcn/ui components (don't edit manually)
├── providers.tsx                         # React Query provider
├── search-bar.tsx                        # Debounced search with dropdown
├── watchlist-card.tsx                    # Watchlist item with sparkline
└── sparkline-chart.tsx                   # SVG sparkline for watchlist cards

lib/
├── apis/
│   ├── alphavantage.ts                   # Alpha Vantage API wrapper
│   ├── fmp.ts                            # Financial Modeling Prep API wrapper
│   ├── finnhub.ts                        # Finnhub API wrapper
│   └── coingecko.ts                      # CoinGecko API wrapper
├── cache/redis.ts                        # Upstash Redis cache layer
├── store/watchlist.ts                    # Zustand watchlist store (persisted)
├── types.ts                              # All TypeScript interfaces
└── format.ts                             # Number/currency/date formatting utilities
```

## Key Patterns

### API Route Pattern
Every API route follows: check cache → (miss) call external API → store in cache → return response. Error handling wraps everything and returns `{ error: string }` with appropriate status codes.

### Client Data Fetching
All pages are `'use client'`. Data fetching uses `useQuery` from TanStack Query with appropriate `queryKey` arrays for cache invalidation.

### AI Analysis Streaming
The `/api/analyze/[ticker]` route:
1. Fetches data from other internal API routes in parallel
2. Builds a structured prompt with technical + fundamental data
3. Calls Gemini `generateContentStream()`
4. Pipes the stream to the client via `ReadableStream`
5. Client reads with `response.body.getReader()`
6. Complete text is cached in Redis after streaming finishes

### Watchlist
Uses Zustand with `persist` middleware → saves to `localStorage` under key `stockvision-watchlist`. The store is in `lib/store/watchlist.ts`.

## Design System

- **Theme:** Dark only (no light mode toggle)
- **Background:** `#0f0f11` | **Cards:** `#1a1a1f` | **Borders:** `#2a2a35`
- **Green (positive):** `#00c896` | **Red (negative):** `#ff4757`
- **Accent/Primary:** `#6366f1` (indigo)
- **Fonts:** Inter (text), JetBrains Mono (numbers/tickers)
- **CSS variables** defined in `app/globals.css`
- Custom utilities: `.text-green`, `.text-red`, `.font-mono-numbers`

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Environment Variables

All defined in `.env.local` (gitignored). Required:
- `ALPHA_VANTAGE_API_KEY`
- `FMP_API_KEY`
- `FINNHUB_API_KEY`
- `COINGECKO_API_KEY`
- `GEMINI_API_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## Conventions

- API wrappers in `lib/apis/` are server-only (use `process.env`)
- Components in `components/ui/` are managed by shadcn — don't edit manually, use `npx shadcn@latest add <component>`
- Numbers that represent money or financial data use the `font-mono-numbers` class
- Positive values render in green (`text-green`), negative in red (`text-red`)
- Financial dates from FMP format as quarters: "2024-09-30" → "Q3 2024" (use `formatQuarter()`)
- All pages under `app/` that use hooks are marked `'use client'`
