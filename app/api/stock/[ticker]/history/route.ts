import { NextRequest, NextResponse } from 'next/server'
import { getYahooHistory } from '@/lib/apis/yahoo'
import { getDailyTimeSeries } from '@/lib/apis/alphavantage'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import { normalizeOhlcvSeries } from '@/lib/time-series'
import type { OHLCV } from '@/lib/types'

const RANGE_DAYS: Record<string, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  '3y': 365 * 3,
  '5y': 365 * 5,
}

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const range = request.nextUrl.searchParams.get('range') || '1y'
  const days = RANGE_DAYS[range] || 365
  const key = cacheKey('history', ticker)
  const perf = createRequestPerformanceTracker('/api/stock/[ticker]/history', request, {
    ticker,
    range,
    cacheKey: key,
  })

  try {
    return await perf.run(async () => {
      // Try cache first (full dataset)
      let allPrices = await measureStage('cache.get', () => getCached<OHLCV[]>(key))
      const initialCacheHit = Boolean(allPrices)
      perf.recordCacheGet(key, Boolean(allPrices))
      let cacheNeedsRefresh = false

      if (!allPrices) {
        // Primary: Yahoo Finance (no API key needed, generous limits)
        allPrices = await measureStage('history.yahoo', () => fetchFromYahoo(ticker))

        // Last resort: Alpha Vantage (25 req/day)
        if (!allPrices || allPrices.length === 0) {
          allPrices = await measureStage('history.alpha-vantage-fallback', () => fetchFromAlphaVantage(ticker))
        }

        if (!allPrices || allPrices.length === 0) {
          const payload = { error: 'No history data found' }
          perf.finish(payload, 404)
          return NextResponse.json(payload, { status: 404 })
        }

        cacheNeedsRefresh = true
      }

      const normalizedPrices = await measureStage('history.normalize', async () =>
        normalizeOhlcvSeries(allPrices as OHLCV[]))
      if (normalizedPrices.length !== allPrices.length) {
        cacheNeedsRefresh = true
      }

      if (cacheNeedsRefresh) {
        await measureStage('cache.set', () => setCached(key, normalizedPrices, CACHE_TTL.HISTORY))
        perf.recordCacheSet(key, CACHE_TTL.HISTORY)
      }

      // Filter by range
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)
      const cutoffStr = cutoffDate.toISOString().split('T')[0]

      const filtered = await measureStage('history.filter-range', async () =>
        normalizedPrices
          .filter((p) => p.date >= cutoffStr)
          .sort((a, b) => a.date.localeCompare(b.date)))

      perf.finish(filtered, 200, {
        source: initialCacheHit ? 'cache' : 'live',
        points: filtered.length,
      })
      return NextResponse.json(filtered)
    })
  } catch (error) {
    console.error('History error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch history'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function fetchFromYahoo(ticker: string): Promise<OHLCV[] | null> {
  try {
    const history = await getYahooHistory(ticker, 5)
    if (!history || history.length === 0) return null
    return history
  } catch (error) {
    console.warn('Yahoo history failed:', error)
    return null
  }
}

async function fetchFromAlphaVantage(ticker: string): Promise<OHLCV[] | null> {
  try {
    const timeSeries = await getDailyTimeSeries(ticker)
    if (!timeSeries || Object.keys(timeSeries).length === 0) return null

    return Object.entries(timeSeries)
      .map(([date, values]) => {
        const v = values as Record<string, string>
        return {
          date,
          open: parseFloat(v['1. open']),
          high: parseFloat(v['2. high']),
          low: parseFloat(v['3. low']),
          close: parseFloat(v['4. close']),
          volume: parseInt(v['6. volume'] || v['5. volume']),
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch (error) {
    console.warn('Alpha Vantage history failed:', error)
    return null
  }
}
