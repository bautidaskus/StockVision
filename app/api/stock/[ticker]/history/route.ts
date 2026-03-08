import { NextRequest, NextResponse } from 'next/server'
import { getDailyTimeSeries } from '@/lib/apis/alphavantage'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
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

  try {
    // Try cache (we cache the full dataset and slice client-side)
    let timeSeries = await getCached<Record<string, Record<string, string>>>(key)

    if (!timeSeries) {
      timeSeries = await getDailyTimeSeries(ticker)
      if (!timeSeries || Object.keys(timeSeries).length === 0) {
        return NextResponse.json({ error: 'No history data found' }, { status: 404 })
      }
      await setCached(key, timeSeries, CACHE_TTL.HISTORY)
    }

    // Convert and filter by range
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffStr = cutoffDate.toISOString().split('T')[0]

    const data: OHLCV[] = Object.entries(timeSeries)
      .filter(([date]) => date >= cutoffStr)
      .map(([date, values]) => ({
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['6. volume'] || values['5. volume']),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json(data)
  } catch (error) {
    console.error('History error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch history'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
