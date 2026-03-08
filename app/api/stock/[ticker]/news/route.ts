import { NextRequest, NextResponse } from 'next/server'
import { getCompanyNews } from '@/lib/apis/finnhub'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import type { NewsItem } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('news', ticker)

  try {
    const cached = await getCached<NewsItem[]>(key)
    if (cached) return NextResponse.json(cached)

    const news = await getCompanyNews(ticker)
    await setCached(key, news, CACHE_TTL.NEWS)
    return NextResponse.json(news)
  } catch (error) {
    console.error('News error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch news'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
