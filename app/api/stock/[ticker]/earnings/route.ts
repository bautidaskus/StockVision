import { NextRequest, NextResponse } from 'next/server'
import { getYahooEarnings } from '@/lib/apis/yahoo'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import type { EarningsData } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('earnings', ticker)

  try {
    const cached = await getCached<EarningsData>(key)
    if (cached) return NextResponse.json(cached)

    const earnings = await getYahooEarnings(ticker)
    await setCached(key, earnings, CACHE_TTL.EARNINGS)
    return NextResponse.json(earnings)
  } catch (error) {
    console.error('Earnings error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch earnings'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
