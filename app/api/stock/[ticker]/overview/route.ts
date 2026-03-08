import { NextRequest, NextResponse } from 'next/server'
import { getQuote, getProfile } from '@/lib/apis/fmp'
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

    // Try FMP first (250 req/day vs Alpha Vantage's 25/day)
    let result = await fetchFromFMP(ticker)

    // Fallback to Alpha Vantage if FMP fails
    if (!result) {
      result = await fetchFromAlphaVantage(ticker)
    }

    if (!result) {
      return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
    }

    await setCached(key, result, CACHE_TTL.OVERVIEW)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Overview error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch overview'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function fetchFromFMP(ticker: string): Promise<StockOverview | null> {
  try {
    const [quote, profile] = await Promise.all([
      getQuote(ticker),
      getProfile(ticker),
    ])

    if (!quote || !quote.symbol) return null

    return {
      ticker: quote.symbol,
      name: quote.name || profile?.companyName || ticker,
      sector: profile?.sector || 'N/A',
      industry: profile?.industry || 'N/A',
      description: profile?.description || '',
      price: quote.price || 0,
      change: quote.change || 0,
      changePercent: quote.changesPercentage || 0,
      marketCap: quote.marketCap || 0,
      pe: quote.pe || null,
      forwardPe: profile?.forwardPE || null,
      eps: quote.eps || null,
      dividendYield: profile?.lastDiv ? profile.lastDiv / quote.price : null,
      beta: profile?.beta || null,
      week52High: quote.yearHigh || 0,
      week52Low: quote.yearLow || 0,
      sharesOutstanding: quote.sharesOutstanding || 0,
      evToEbitda: null, // Will be filled from key metrics if available
      priceToSales: profile?.priceToSalesRatio || null,
      priceToBook: profile?.priceToBookRatio || null,
      pegRatio: null,
    }
  } catch (error) {
    console.warn('FMP overview failed:', error)
    return null
  }
}

async function fetchFromAlphaVantage(ticker: string): Promise<StockOverview | null> {
  try {
    const [overview, quote] = await Promise.all([
      getOverview(ticker),
      getGlobalQuote(ticker),
    ])

    if (!overview || !overview.Symbol) return null

    const price = parseFloat(quote?.['05. price'] || overview.AnalystTargetPrice || '0')
    const change = parseFloat(quote?.['09. change'] || '0')
    const changePercent = parseFloat((quote?.['10. change percent'] || '0').replace('%', ''))

    return {
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
  } catch (error) {
    console.warn('Alpha Vantage overview failed:', error)
    return null
  }
}

function parseFloatOrNull(val: string | undefined): number | null {
  if (!val || val === 'None' || val === '-') return null
  const num = parseFloat(val)
  return isNaN(num) ? null : num
}
