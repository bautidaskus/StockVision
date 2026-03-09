import { NextRequest, NextResponse } from 'next/server'
import { getYahooHistory } from '@/lib/apis/yahoo'
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
    // Try cache first (full dataset)
    let allPrices = await getCached<OHLCV[]>(key)

    if (!allPrices) {
      // Primary: Yahoo Finance (no API key needed, generous limits)
      allPrices = await fetchFromYahoo(ticker)

      // Last resort: Alpha Vantage (25 req/day)
      if (!allPrices || allPrices.length === 0) {
        allPrices = await fetchFromAlphaVantage(ticker)
      }

      if (!allPrices || allPrices.length === 0) {
        return NextResponse.json({ error: 'No history data found' }, { status: 404 })
      }

      await setCached(key, allPrices, CACHE_TTL.HISTORY)
    }

    // Filter by range
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffStr = cutoffDate.toISOString().split('T')[0]

    const filtered = allPrices
      .filter((p) => p.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('History error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch history'
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
