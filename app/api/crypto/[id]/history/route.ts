import { NextRequest, NextResponse } from 'next/server'
import { getCoinMarketChart } from '@/lib/apis/coingecko'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'

const RANGE_DAYS: Record<string, string> = {
  '1m': '30',
  '3m': '90',
  '6m': '180',
  '1y': '365',
  '3y': '1095',
  '5y': '1825',
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id.toLowerCase()
  const range = request.nextUrl.searchParams.get('range') || '1y'
  const days = RANGE_DAYS[range] || '365'
  const key = cacheKey('crypto-history', id, days)

  try {
    const cached = await getCached(key)
    if (cached) return NextResponse.json(cached)

    const data = await getCoinMarketChart(id, days)
    if (!data || !data.prices) {
      return NextResponse.json({ error: 'No history data found' }, { status: 404 })
    }

    const prices = data.prices.map(([timestamp, price]: [number, number]) => ({
      date: new Date(timestamp).toISOString().split('T')[0],
      close: price,
    }))

    const volumes = data.total_volumes?.map(([timestamp, volume]: [number, number]) => ({
      date: new Date(timestamp).toISOString().split('T')[0],
      volume,
    })) || []

    const result = { prices, volumes }
    await setCached(key, result, CACHE_TTL.HISTORY)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Crypto history error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch crypto history'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
