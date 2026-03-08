import { NextRequest, NextResponse } from 'next/server'
import { getOverview, getGlobalQuote } from '@/lib/apis/alphavantage'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import type { StockOverview } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('overview', ticker)

  try {
    // Try cache first
    const cached = await getCached<StockOverview>(key)
    if (cached) return NextResponse.json(cached)

    // Fetch from Alpha Vantage
    const [overview, quote] = await Promise.all([
      getOverview(ticker),
      getGlobalQuote(ticker),
    ])

    if (!overview || !overview.Symbol) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
    }

    const price = parseFloat(quote?.['05. price'] || overview.AnalystTargetPrice || '0')
    const change = parseFloat(quote?.['09. change'] || '0')
    const changePercent = parseFloat((quote?.['10. change percent'] || '0').replace('%', ''))

    const result: StockOverview = {
      ticker: overview.Symbol,
      name: overview.Name || ticker,
      sector: overview.Sector || 'N/A',
      industry: overview.Industry || 'N/A',
      description: overview.Description || '',
      price,
      change,
      changePercent,
      marketCap: parseFloat(overview.MarketCapitalization || '0'),
      pe: parseFloatOrNull(overview.PERatio),
      forwardPe: parseFloatOrNull(overview.ForwardPE),
      eps: parseFloatOrNull(overview.EPS),
      dividendYield: parseFloatOrNull(overview.DividendYield),
      beta: parseFloatOrNull(overview.Beta),
      week52High: parseFloat(overview['52WeekHigh'] || '0'),
      week52Low: parseFloat(overview['52WeekLow'] || '0'),
      sharesOutstanding: parseFloat(overview.SharesOutstanding || '0'),
      evToEbitda: parseFloatOrNull(overview.EVToEBITDA),
      priceToSales: parseFloatOrNull(overview.PriceToSalesRatioTTM),
      priceToBook: parseFloatOrNull(overview.PriceToBookRatio),
      pegRatio: parseFloatOrNull(overview.PEGRatio),
    }

    await setCached(key, result, CACHE_TTL.OVERVIEW)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Overview error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch overview'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function parseFloatOrNull(val: string | undefined): number | null {
  if (!val || val === 'None' || val === '-') return null
  const num = parseFloat(val)
  return isNaN(num) ? null : num
}
