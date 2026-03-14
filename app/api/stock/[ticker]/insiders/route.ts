import { NextRequest, NextResponse } from 'next/server'
import { getYahooInsiders } from '@/lib/apis/yahoo'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import type { InsiderData } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('insiders', ticker)

  try {
    const cached = await getCached<InsiderData>(key)
    if (cached) return NextResponse.json(cached)

    const insiders = await getYahooInsiders(ticker)
    await setCached(key, insiders, CACHE_TTL.INSIDERS)
    return NextResponse.json(insiders)
  } catch (error) {
    console.error('Insiders error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch insiders'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
