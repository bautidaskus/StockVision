import { NextRequest, NextResponse } from 'next/server'
import { getQuoteFinnhub, getBasicFinancials } from '@/lib/apis/finnhub'
import { getYahooQuote } from '@/lib/apis/yahoo'
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

    // Try Finnhub + Yahoo first
    let result = await fetchFromFinnhubYahoo(ticker)

    // Fallback to Alpha Vantage if both fail
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

async function fetchFromFinnhubYahoo(ticker: string): Promise<StockOverview | null> {
  try {
    // Finnhub for real-time price + basic metrics, Yahoo for profile
    const [finnhubQuote, finnhubMetrics, yahooData] = await Promise.all([
      getQuoteFinnhub(ticker).catch(() => null),
      getBasicFinancials(ticker).catch(() => null),
      getYahooQuote(ticker).catch(() => null),
    ])

    // Need at least Finnhub quote or Yahoo data
    if (!finnhubQuote?.price && !yahooData?.price) return null

    // Prefer Finnhub for real-time price, Yahoo for profile/valuation
    const price = finnhubQuote?.price || yahooData?.price || 0
    const change = finnhubQuote?.change || yahooData?.change || 0
    const changePercent = finnhubQuote?.changePercent || yahooData?.changePercent || 0

    return {
      ticker: yahooData?.symbol || ticker,
      name: yahooData?.name || ticker,
      sector: yahooData?.sector || 'N/A',
      industry: yahooData?.industry || 'N/A',
      description: yahooData?.description || '',
      price,
      change,
      changePercent,
      marketCap: finnhubMetrics?.marketCap || yahooData?.marketCap || 0,
      pe: yahooData?.pe || finnhubMetrics?.pe || null,
      forwardPe: yahooData?.forwardPe || null,
      eps: yahooData?.eps || finnhubMetrics?.eps || null,
      dividendYield: yahooData?.dividendYield || finnhubMetrics?.dividendYield || null,
      beta: yahooData?.beta || finnhubMetrics?.beta || null,
      week52High: finnhubMetrics?.week52High || yahooData?.week52High || 0,
      week52Low: finnhubMetrics?.week52Low || yahooData?.week52Low || 0,
      sharesOutstanding: finnhubMetrics?.sharesOutstanding || yahooData?.sharesOutstanding || 0,
      evToEbitda: yahooData?.enterpriseToEbitda || null,
      priceToSales: finnhubMetrics?.priceToSales || null,
      priceToBook: finnhubMetrics?.priceToBook || yahooData?.priceToBook || null,
      pegRatio: yahooData?.pegRatio || null,
    }
  } catch (error) {
    console.warn('Finnhub+Yahoo overview failed:', error)
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
