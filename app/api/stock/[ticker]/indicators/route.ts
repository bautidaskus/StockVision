import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import { calculateIndicators } from '@/lib/indicators'
import type { TechnicalIndicators, OHLCV } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('indicators', ticker)

  try {
    const cached = await getCached<TechnicalIndicators>(key)
    if (cached) return NextResponse.json(cached)

    // Get price history (from our own API route which uses FMP/AV with cache)
    const baseUrl = request.nextUrl.origin
    const historyRes = await fetch(`${baseUrl}/api/stock/${ticker}/history?range=5y`)
    if (!historyRes.ok) {
      return NextResponse.json({ error: 'Could not fetch price data for indicators' }, { status: 500 })
    }

    const prices: OHLCV[] = await historyRes.json()
    if (!prices || prices.length < 30) {
      return NextResponse.json({ error: 'Not enough price data for indicators' }, { status: 404 })
    }

    // Calculate all indicators locally from price data (0 external API calls!)
    const result = calculateIndicators(prices)

    // Limit to last 200 data points for each indicator
    const maxPoints = 200
    result.rsi = result.rsi.slice(-maxPoints)
    result.macd = result.macd.slice(-maxPoints)
    result.sma20 = result.sma20.slice(-maxPoints)
    result.sma50 = result.sma50.slice(-maxPoints)
    result.sma200 = result.sma200.slice(-maxPoints)

    await setCached(key, result, CACHE_TTL.INDICATORS)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Indicators error:', error)
    const message = error instanceof Error ? error.message : 'Failed to calculate indicators'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
