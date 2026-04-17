import { NextRequest, NextResponse } from 'next/server'
import { searchSymbols } from '@/lib/apis/finnhub'
import { searchYahoo } from '@/lib/apis/yahoo'
import { searchCoins } from '@/lib/apis/coingecko'
import { getCached, setCached, cacheKey } from '@/lib/cache/redis'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'

const MIN_QUERY_CHARS = 2
const SEARCH_CACHE_TTL = 30

interface SearchItem {
  ticker: string
  name: string
  type: 'stock' | 'crypto'
  exchange: string
  image?: string
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || ''
  const perf = createRequestPerformanceTracker('/api/search', request, {
    query,
  })

  if (query.length < MIN_QUERY_CHARS) {
    const payload: SearchItem[] = []
    perf.finish(payload, 200, { shortCircuit: 'too-short' })
    return NextResponse.json(payload)
  }

  const sKey = cacheKey('search', query.toLowerCase())
  const cached = await getCached<SearchItem[]>(sKey)
  if (cached) {
    perf.finish(cached, 200, { source: 'cache' })
    return NextResponse.json(cached)
  }

  try {
    return await perf.run(async () => {
      // Search stocks (Finnhub) and crypto (CoinGecko) in parallel
      const [finnhubResults, cryptoResult] = await measureStage('search.parallel', () =>
        Promise.all([
          searchSymbols(query).catch((err) => {
            console.warn('Finnhub search failed:', err)
            return []
          }),
          searchCoins(query).catch((err) => {
            console.warn('CoinGecko search failed:', err)
            return { coins: [] }
          }),
        ]))

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
        const yahooResults = await measureStage('search.yahoo-fallback', () =>
          searchYahoo(query, 6).catch(() => []))
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
      const payload = [...stockResults, ...cryptoResults.slice(0, cryptoLimit)]
      await setCached(sKey, payload, SEARCH_CACHE_TTL)
      perf.finish(payload, 200, {
        stockResults: stockResults.length,
        cryptoResults: cryptoResults.length,
      })
      return NextResponse.json(payload)
    })
  } catch (error) {
    console.error('Search error:', error)
    const payload: [] = []
    perf.finish(payload, 200, {
      failed: true,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(payload)
  }
}
