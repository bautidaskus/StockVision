import { NextRequest, NextResponse } from 'next/server'
import { getRSI, getMACD, getSMA } from '@/lib/apis/alphavantage'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import type { TechnicalIndicators } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('indicators', ticker)

  try {
    const cached = await getCached<TechnicalIndicators>(key)
    if (cached) return NextResponse.json(cached)

    // Fetch all indicators in parallel (4 API calls)
    const [rsiData, macdData, sma20Data, sma50Data, sma200Data] = await Promise.all([
      getRSI(ticker),
      getMACD(ticker),
      getSMA(ticker, 20),
      getSMA(ticker, 50),
      getSMA(ticker, 200),
    ])

    const maxPoints = 200

    const result: TechnicalIndicators = {
      rsi: Object.entries(rsiData)
        .slice(0, maxPoints)
        .map(([date, val]) => ({
          date,
          value: parseFloat((val as Record<string, string>).RSI),
        }))
        .reverse(),
      macd: Object.entries(macdData)
        .slice(0, maxPoints)
        .map(([date, val]) => {
          const v = val as Record<string, string>
          return {
            date,
            macd: parseFloat(v['MACD']),
            signal: parseFloat(v['MACD_Signal']),
            histogram: parseFloat(v['MACD_Hist']),
          }
        })
        .reverse(),
      sma20: Object.entries(sma20Data)
        .slice(0, maxPoints)
        .map(([date, val]) => ({
          date,
          value: parseFloat((val as Record<string, string>).SMA),
        }))
        .reverse(),
      sma50: Object.entries(sma50Data)
        .slice(0, maxPoints)
        .map(([date, val]) => ({
          date,
          value: parseFloat((val as Record<string, string>).SMA),
        }))
        .reverse(),
      sma200: Object.entries(sma200Data)
        .slice(0, maxPoints)
        .map(([date, val]) => ({
          date,
          value: parseFloat((val as Record<string, string>).SMA),
        }))
        .reverse(),
    }

    await setCached(key, result, CACHE_TTL.INDICATORS)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Indicators error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch indicators'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
