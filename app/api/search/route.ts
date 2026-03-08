import { NextRequest, NextResponse } from 'next/server'
import { searchTicker } from '@/lib/apis/fmp'
import { searchCoins } from '@/lib/apis/coingecko'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || ''
  if (query.length < 1) {
    return NextResponse.json([])
  }

  try {
    const [stocks, cryptoResult] = await Promise.all([
      searchTicker(query, 6).catch(() => []),
      searchCoins(query).catch(() => ({ coins: [] })),
    ])

    const stockResults = (stocks || []).map((s: Record<string, string>) => ({
      ticker: s.symbol,
      name: s.name,
      type: 'stock' as const,
      exchange: s.stockExchange || s.exchangeShortName || '',
    }))

    const cryptoResults = (cryptoResult?.coins || []).slice(0, 4).map((c: Record<string, string & { large: string }>) => ({
      ticker: c.id,
      name: c.name,
      type: 'crypto' as const,
      exchange: c.symbol?.toUpperCase() || '',
      image: c.large || c.thumb || '',
    }))

    return NextResponse.json([...stockResults, ...cryptoResults])
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json([])
  }
}
