import { NextRequest, NextResponse } from 'next/server'
import { getNewsCached } from '@/lib/services/stock-service'

export async function GET(
  _request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()

  try {
    const news = await getNewsCached(ticker)
    return NextResponse.json(news)
  } catch (error) {
    console.error('News error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch news'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
