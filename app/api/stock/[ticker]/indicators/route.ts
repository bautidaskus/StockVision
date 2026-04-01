import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import { calculateIndicators } from '@/lib/indicators'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import { normalizeOhlcvSeries, normalizeTechnicalIndicators } from '@/lib/time-series'
import type { TechnicalIndicators, OHLCV } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('indicators', ticker)
  const perf = createRequestPerformanceTracker('/api/stock/[ticker]/indicators', request, {
    ticker,
    cacheKey: key,
  })

  try {
    return await perf.run(async () => {
      const cached = await measureStage('cache.get', () => getCached<TechnicalIndicators>(key))
      perf.recordCacheGet(key, Boolean(cached))
      if (cached) {
        const normalizedCached = await measureStage('indicators.normalize-cached', async () =>
          normalizeTechnicalIndicators(cached))
        perf.finish(normalizedCached, 200, { source: 'cache' })
        return NextResponse.json(normalizedCached)
      }

      // Get price history (from our own API route which uses FMP/AV with cache)
      const baseUrl = request.nextUrl.origin
      const historyRes = await measureStage('indicators.fetch-history-route', () =>
        fetch(`${baseUrl}/api/stock/${ticker}/history?range=5y`))
      if (!historyRes.ok) {
        const payload = { error: 'Could not fetch price data for indicators' }
        perf.finish(payload, 500)
        return NextResponse.json(payload, { status: 500 })
      }

      const prices = await measureStage('indicators.normalize-history', async () =>
        normalizeOhlcvSeries(await historyRes.json() as OHLCV[]))
      if (!prices || prices.length < 30) {
        const payload = { error: 'Not enough price data for indicators' }
        perf.finish(payload, 404)
        return NextResponse.json(payload, { status: 404 })
      }

      // Calculate all indicators locally from price data (0 external API calls!)
      const result = await measureStage('indicators.calculate', async () =>
        calculateIndicators(prices))

      // Limit to last 200 data points for each indicator
      const maxPoints = 200
      result.rsi = result.rsi.slice(-maxPoints)
      result.macd = result.macd.slice(-maxPoints)
      result.sma20 = result.sma20.slice(-maxPoints)
      result.sma50 = result.sma50.slice(-maxPoints)
      result.sma200 = result.sma200.slice(-maxPoints)

      const normalizedResult = await measureStage('indicators.normalize-result', async () =>
        normalizeTechnicalIndicators(result))

      await measureStage('cache.set', () => setCached(key, normalizedResult, CACHE_TTL.INDICATORS))
      perf.recordCacheSet(key, CACHE_TTL.INDICATORS)
      perf.finish(normalizedResult, 200, { source: 'live' })
      return NextResponse.json(normalizedResult)
    })
  } catch (error) {
    console.error('Indicators error:', error)
    const message = error instanceof Error ? error.message : 'Failed to calculate indicators'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
