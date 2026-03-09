import { NextRequest, NextResponse } from 'next/server'
import { searchSymbols } from '@/lib/apis/finnhub'
import { searchYahoo } from '@/lib/apis/yahoo'
import { searchCoins } from '@/lib/apis/coingecko'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || ''
  if (query.length < 1) {
    return NextResponse.json([])
  }

  try {
    // Search stocks (Finnhub) and crypto (CoinGecko) in parallel
    const [finnhubResults, cryptoResult] = await Promise.all([
      searchSymbols(query).catch((err) => {
        console.warn('Finnhub search failed:', err)
        return []
      }),
      searchCoins(query).catch((err) => {
        console.warn('CoinGecko search failed:', err)
        return { coins: [] }
      }),
    ])

    // Process Finnhub stock results
    let stockResults = (Array.isArray(finnhubResults) ? finnhubResults : [])
      .filter((s: { symbol: string; name: string }) => s.symbol && s.symbol.length <= 5 && !s.symbol.includes('.'))
      .slice(0, 6)
      .map((s: { symbol: string; name: string }) => ({
        ticker: s.symbol,
        name: s.name || s.symbol,
        type: 'stock' as const,
        exchange: '',
      }))

    // If Finnhub returned nothing, try Yahoo Finance as fallback
    if (stockResults.length === 0) {
      const yahooResults = await searchYahoo(query, 6).catch(() => [])
      stockResults = yahooResults.map((s: { symbol: string; name: string; exchange: string }) => ({
        ticker: s.symbol,
        name: s.name || s.symbol,
        type: 'stock' as const,
        exchange: s.exchange || '',
      }))
    }

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

    // Always show stocks first; limit crypto when stocks are present
    const cryptoLimit = stockResults.length > 0 ? 2 : 4
    return NextResponse.json([...stockResults, ...cryptoResults.slice(0, cryptoLimit)])
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json([])
  }
}
