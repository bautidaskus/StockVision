import { NextRequest, NextResponse } from 'next/server'
import { getYahooFinancials } from '@/lib/apis/yahoo'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const period = (request.nextUrl.searchParams.get('period') || 'quarterly') as 'quarterly' | 'annual'
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '8')
  const key = cacheKey('financials', ticker, period, String(limit))

  try {
    const cached = await getCached(key)
    if (cached) return NextResponse.json(cached)

    const financials = await getYahooFinancials(ticker, period, limit)

    const result = {
      statements: financials.statements,
      estimates: null, // Yahoo free doesn't provide analyst estimates easily
      ratios: [],
    }

    await setCached(key, result, CACHE_TTL.FINANCIALS)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Financials error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch financials'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
