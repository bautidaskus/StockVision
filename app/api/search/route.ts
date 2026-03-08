import { NextRequest, NextResponse } from 'next/server'
import { searchTicker } from '@/lib/apis/fmp'
import { searchCoins } from '@/lib/apis/coingecko'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || ''
  if (query.length < 1) {
    return NextResponse.json([])
  }

  try {
    // Search both APIs in parallel
    const [fmpResults, cryptoResult] = await Promise.all([
      searchTicker(query, 8).catch((err) => {
        console.warn('FMP search failed:', err)
        return []
      }),
      searchCoins(query).catch((err) => {
        console.warn('CoinGecko search failed:', err)
        return { coins: [] }
      }),
    ])

    // Process FMP stock results
    const stockResults = (Array.isArray(fmpResults) ? fmpResults : [])
      .filter((s: Record<string, string>) => {
        // Filter out OTC, crypto-like tickers, and non-equity items
        const exchange = (s.stockExchange || s.exchangeShortName || '').toUpperCase()
        return s.symbol &&
          !exchange.includes('CRYPTO') &&
          !exchange.includes('PNK') &&
          s.symbol.length <= 5
      })
      .slice(0, 6)
      .map((s: Record<string, string>) => ({
        ticker: s.symbol,
        name: s.name,
        type: 'stock' as const,
        exchange: s.exchangeShortName || s.stockExchange || '',
      }))

    // Process CoinGecko crypto results
    const coins = cryptoResult?.coins || []
    const cryptoResults = (Array.isArray(coins) ? coins : [])
      .slice(0, 4)
      .map((c: Record<string, unknown>) => ({
        ticker: c.id as string,
        name: c.name as string,
        type: 'crypto' as const,
        exchange: ((c.symbol as string) || '').toUpperCase(),
        image: (c.thumb as string) || '',
      }))

    // Always show stocks first, then crypto
    return NextResponse.json([...stockResults, ...cryptoResults])
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json([])
  }
}
