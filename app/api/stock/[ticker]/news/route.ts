import { NextRequest, NextResponse } from 'next/server'
import { getCompanyNews } from '@/lib/apis/finnhub'
import { getYahooNews } from '@/lib/apis/yahoo'
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

    let news = await getCompanyNews(ticker).catch((error) => {
      console.warn('Finnhub news failed:', error)
      return []
    })

    if (news.length === 0) {
      news = await getYahooNews(ticker).catch((error) => {
        console.warn('Yahoo news failed:', error)
        return []
      })
    }

    await setCached(key, news, CACHE_TTL.NEWS)
    return NextResponse.json(news)
  } catch (error) {
    console.error('News error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch news'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
