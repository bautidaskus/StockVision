import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import { getQuoteFinnhub, getBasicFinancials, getCompanyNews } from '@/lib/apis/finnhub'
import { getYahooQuote, getYahooHistory, getYahooNews } from '@/lib/apis/yahoo'
import { getOverview as avOverview, getGlobalQuote as avQuote, getDailyTimeSeries } from '@/lib/apis/alphavantage'
import { getNormalizedFinancials } from '@/lib/fundamentals'
import { calculateIndicators } from '@/lib/indicators'
import { normalizeOhlcvSeries, normalizeTechnicalIndicators } from '@/lib/time-series'
import type { NewsItem, OHLCV, StockOverview, TechnicalIndicators } from '@/lib/types'

// ─── Overview ──────────────────────────────────────────────────────

export async function getOverviewCached(ticker: string): Promise<StockOverview | null> {
  const key = cacheKey('overview', ticker)
  const cached = await getCached<StockOverview>(key)
  if (cached) return cached

  const result = (await fetchOverviewFromFinnhubYahoo(ticker)) ?? (await fetchOverviewFromAlphaVantage(ticker))
  if (!result) return null
  await setCached(key, result, CACHE_TTL.OVERVIEW)
  return result
}

async function fetchOverviewFromFinnhubYahoo(ticker: string): Promise<StockOverview | null> {
  try {
    const hasFinnhubKey = Boolean(process.env.FINNHUB_API_KEY)
    const yahooData = await getYahooQuote(ticker).catch(() => null)

    const [finnhubQuote, finnhubMetrics] = hasFinnhubKey
      ? await Promise.all([
          getQuoteFinnhub(ticker).catch(() => null),
          getBasicFinancials(ticker).catch(() => null),
        ])
      : [null, null]

    if (!finnhubQuote?.price && !yahooData?.price) return null

    return {
      ticker: yahooData?.symbol || ticker,
      name: yahooData?.name || ticker,
      sector: yahooData?.sector ?? null,
      industry: yahooData?.industry ?? null,
      description: yahooData?.description || '',
      price: finnhubQuote?.price ?? yahooData?.price ?? 0,
      change: finnhubQuote?.change ?? yahooData?.change ?? 0,
      changePercent: finnhubQuote?.changePercent ?? yahooData?.changePercent ?? 0,
      marketCap: (finnhubMetrics?.marketCap ?? yahooData?.marketCap) || null,
      pe: yahooData?.pe ?? finnhubMetrics?.pe ?? null,
      forwardPe: yahooData?.forwardPe ?? null,
      eps: yahooData?.eps ?? finnhubMetrics?.eps ?? null,
      dividendYield: yahooData?.dividendYield ?? finnhubMetrics?.dividendYield ?? null,
      beta: yahooData?.beta ?? finnhubMetrics?.beta ?? null,
      week52High: (finnhubMetrics?.week52High ?? yahooData?.week52High) || null,
      week52Low: (finnhubMetrics?.week52Low ?? yahooData?.week52Low) || null,
      sharesOutstanding: (finnhubMetrics?.sharesOutstanding ?? yahooData?.sharesOutstanding) || null,
      evToEbitda: yahooData?.enterpriseToEbitda ?? null,
      priceToSales: finnhubMetrics?.priceToSales ?? null,
      priceToBook: yahooData?.priceToBook ?? finnhubMetrics?.priceToBook ?? null,
      pegRatio: yahooData?.pegRatio ?? null,
    }
  } catch (error) {
    console.warn('Finnhub+Yahoo overview failed:', error)
    return null
  }
}

async function fetchOverviewFromAlphaVantage(ticker: string): Promise<StockOverview | null> {
  try {
    const [overview, quote] = await Promise.all([avOverview(ticker), avQuote(ticker)])
    if (!overview || !overview.Symbol) return null

    const price = parseFloat(quote?.['05. price'] || overview.AnalystTargetPrice || '0')
    const change = parseFloat(quote?.['09. change'] || '0')
    const changePercent = parseFloat((quote?.['10. change percent'] || '0').replace('%', ''))

    return {
      ticker: overview.Symbol,
      name: overview.Name || ticker,
      sector: overview.Sector ?? null,
      industry: overview.Industry ?? null,
      description: overview.Description || '',
      price,
      change,
      changePercent,
      marketCap: parseFloatOrNull(overview.MarketCapitalization),
      pe: parseFloatOrNull(overview.PERatio),
      forwardPe: parseFloatOrNull(overview.ForwardPE),
      eps: parseFloatOrNull(overview.EPS),
      dividendYield: parseFloatOrNull(overview.DividendYield),
      beta: parseFloatOrNull(overview.Beta),
      week52High: parseFloatOrNull(overview['52WeekHigh']),
      week52Low: parseFloatOrNull(overview['52WeekLow']),
      sharesOutstanding: parseFloatOrNull(overview.SharesOutstanding),
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

// ─── History ───────────────────────────────────────────────────────

const RANGE_DAYS: Record<string, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
  '3y': 365 * 3,
  '5y': 365 * 5,
}

export async function getHistoryCached(ticker: string, range: string): Promise<OHLCV[] | null> {
  const key = cacheKey('history', ticker)
  const days = RANGE_DAYS[range] ?? 365

  let all = await getCached<OHLCV[]>(key)
  let cacheNeedsRefresh = false

  if (!all) {
    all = (await fetchHistoryFromYahoo(ticker)) ?? (await fetchHistoryFromAlphaVantage(ticker))
    if (!all || all.length === 0) return null
    cacheNeedsRefresh = true
  }

  const normalized = normalizeOhlcvSeries(all)
  if (normalized.length !== all.length) cacheNeedsRefresh = true

  if (cacheNeedsRefresh) await setCached(key, normalized, CACHE_TTL.HISTORY)

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoffStr = cutoffDate.toISOString().split('T')[0]

  return normalized
    .filter((p) => p.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date))
}

async function fetchHistoryFromYahoo(ticker: string): Promise<OHLCV[] | null> {
  try {
    const history = await getYahooHistory(ticker, 5)
    if (!history || history.length === 0) return null
    return history
  } catch (error) {
    console.warn('Yahoo history failed:', error)
    return null
  }
}

async function fetchHistoryFromAlphaVantage(ticker: string): Promise<OHLCV[] | null> {
  try {
    const timeSeries = await getDailyTimeSeries(ticker)
    if (!timeSeries || Object.keys(timeSeries).length === 0) return null

    return Object.entries(timeSeries)
      .map(([date, values]) => {
        const v = values as Record<string, string>
        return {
          date,
          open: parseFloat(v['1. open']),
          high: parseFloat(v['2. high']),
          low: parseFloat(v['3. low']),
          close: parseFloat(v['4. close']),
          volume: parseInt(v['6. volume'] || v['5. volume']),
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch (error) {
    console.warn('Alpha Vantage history failed:', error)
    return null
  }
}

// ─── Indicators ────────────────────────────────────────────────────

const MAX_INDICATOR_POINTS = 200

export async function getIndicatorsCached(ticker: string): Promise<TechnicalIndicators | null> {
  const key = cacheKey('indicators', ticker)
  const cached = await getCached<TechnicalIndicators>(key)
  if (cached) return normalizeTechnicalIndicators(cached)

  const prices = await getHistoryCached(ticker, '5y')
  if (!prices || prices.length < 30) return null

  const result = calculateIndicators(prices)
  result.rsi = result.rsi.slice(-MAX_INDICATOR_POINTS)
  result.macd = result.macd.slice(-MAX_INDICATOR_POINTS)
  result.sma20 = result.sma20.slice(-MAX_INDICATOR_POINTS)
  result.sma50 = result.sma50.slice(-MAX_INDICATOR_POINTS)
  result.sma200 = result.sma200.slice(-MAX_INDICATOR_POINTS)

  const normalized = normalizeTechnicalIndicators(result)
  await setCached(key, normalized, CACHE_TTL.INDICATORS)
  return normalized
}

// ─── Financials ────────────────────────────────────────────────────

interface FinancialsResult {
  statements: Awaited<ReturnType<typeof getNormalizedFinancials>>['statements']
  sourceSummary: Awaited<ReturnType<typeof getNormalizedFinancials>>['sourceSummary']
  estimates: null
  ratios: []
}

export async function getFinancialsCached(
  ticker: string,
  period: 'quarterly' | 'annual' = 'quarterly',
  limit = 8,
): Promise<FinancialsResult> {
  const key = cacheKey('financials', ticker, period, String(limit))
  const cached = await getCached<FinancialsResult>(key)
  if (cached) return cached

  const financials = await getNormalizedFinancials(ticker, period, limit)
  const result: FinancialsResult = {
    statements: financials.statements,
    sourceSummary: financials.sourceSummary,
    estimates: null,
    ratios: [],
  }
  await setCached(key, result, CACHE_TTL.FINANCIALS)
  return result
}

// ─── News ──────────────────────────────────────────────────────────

export async function getNewsCached(ticker: string): Promise<NewsItem[]> {
  const key = cacheKey('news', ticker)
  const cached = await getCached<NewsItem[]>(key)
  if (cached) return cached

  let news = await getCompanyNews(ticker).catch((error) => {
    console.warn('Finnhub news failed:', error)
    return [] as NewsItem[]
  })

  if (news.length === 0) {
    news = await getYahooNews(ticker).catch((error) => {
      console.warn('Yahoo news failed:', error)
      return [] as NewsItem[]
    })
  }

  await setCached(key, news, CACHE_TTL.NEWS)
  return news
}
