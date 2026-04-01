import { getSecTickerUniverse } from '@/lib/apis/sec'
import { screenStocks } from '@/lib/apis/fmp'
import { getYahooQuotes, getYahooScreenerSymbols } from '@/lib/apis/yahoo'
import { CACHE_TTL, cacheKey, getCached, setCached } from '@/lib/cache/redis'
import { DEFAULT_UNIVERSE } from '@/lib/data/default-universe'
import { measureStage } from '@/lib/observability/performance'
import { buildOpportunityScore } from '@/lib/scoring/opportunity-score'
import type { ScreenerFilters, ScreenerResult } from '@/lib/types'

const UNIVERSE_SCREENER_IDS = [
  'day_gainers',
  'day_losers',
  'most_actives',
  'undervalued_growth_stocks',
  'growth_technology_stocks',
  'most_shorted_stocks',
]

const YAHOO_FAST_UNIVERSE_CACHE_KEY = cacheKey('universe', 'yahoo-fast-v1')

function annotatePrimaryResult(
  result: ScreenerResult,
  source: ScreenerResult['primaryDataSource'] = 'fmp-screener',
): ScreenerResult {
  return {
    ...result,
    primaryDataSource: source,
    scoreSource: null,
    scoreStatus: 'not-requested',
    opportunityScore: null,
    opportunityRating: undefined,
    valuationScore: null,
    qualityScore: null,
    momentumScore: null,
    eventsScore: null,
    reasons: undefined,
  }
}

function passesPostProviderFilters(result: ScreenerResult, filters: ScreenerFilters) {
  if (filters.exchange && result.exchange !== filters.exchange) return false
  if (filters.sector && result.sector !== filters.sector) return false
  if (filters.marketCapMin != null && result.marketCap < filters.marketCapMin) return false
  if (filters.marketCapMax != null && result.marketCap > filters.marketCapMax) return false
  if (filters.peMin != null && (result.pe == null || result.pe < filters.peMin)) return false
  if (filters.peMax != null && (result.pe == null || result.pe > filters.peMax)) return false
  if (filters.pbMin != null && (result.pb == null || result.pb < filters.pbMin)) return false
  if (filters.pbMax != null && (result.pb == null || result.pb > filters.pbMax)) return false
  if (filters.roeMin != null && (result.roe == null || result.roe * 100 < filters.roeMin)) return false
  if (filters.netMarginMin != null && (result.netMargin == null || result.netMargin * 100 < filters.netMarginMin)) return false
  if (filters.betaMin != null && (result.beta == null || result.beta < filters.betaMin)) return false
  if (filters.betaMax != null && (result.beta == null || result.beta > filters.betaMax)) return false
  if (filters.debtToEquityMax != null && (result.debtToEquity == null || result.debtToEquity > filters.debtToEquityMax)) return false
  if (filters.dividendMin != null && (result.dividendYield == null || result.dividendYield * 100 < filters.dividendMin)) return false
  if (filters.pctFromHighMax != null && result.week52High > 0) {
    const pctFromHigh = ((result.price / result.week52High) - 1) * 100
    if (pctFromHigh > filters.pctFromHighMax) return false
  }
  return true
}

function normalizeExchange(exchange?: string, fullExchangeName?: string) {
  const normalized = `${fullExchangeName || exchange || ''}`.toUpperCase()
  if (normalized.includes('NASDAQ') || ['NMS', 'NGM', 'NCM'].includes(normalized)) return 'NASDAQ'
  if (normalized.includes('NYSE') && !normalized.includes('AMERICAN')) return 'NYSE'
  if (normalized.includes('AMEX') || normalized.includes('AMERICAN') || ['ASE', 'PCX'].includes(normalized)) {
    return 'AMEX'
  }
  return exchange?.toUpperCase() || ''
}

function canUseYahooFastPath(filters: ScreenerFilters) {
  return !(
    filters.sector ||
    filters.roeMin != null ||
    filters.netMarginMin != null ||
    filters.debtToEquityMax != null
  )
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++
      results[currentIndex] = await fn(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )

  return results
}

async function getYahooFastUniverse(filters: ScreenerFilters, limit: number) {
  const cachedUniverse = await measureStage('screener.yahoo-fast-universe-cache-get', () =>
    getCached<Array<{ ticker: string; exchange: string }>>(YAHOO_FAST_UNIVERSE_CACHE_KEY))

  const completeUniverse = cachedUniverse || await (async () => {
    const secUniverse = await getSecTickerUniverse(300).catch(() => [])
    const secMap = new Map(secUniverse.map((entry) => [entry.ticker.toUpperCase(), entry.exchange]))
    const yahooSymbols = await getYahooScreenerSymbols(UNIVERSE_SCREENER_IDS, 20).catch(() => [])

    const tickers = new Set<string>(DEFAULT_UNIVERSE)
    for (const entry of secUniverse.slice(0, 150)) {
      tickers.add(entry.ticker.toUpperCase())
    }
    for (const ticker of yahooSymbols) {
      tickers.add(ticker.toUpperCase())
    }

    const universe = Array.from(tickers)
      .map((ticker) => ({
        ticker,
        exchange: normalizeExchange(secMap.get(ticker)),
      }))

    await measureStage('screener.yahoo-fast-universe-cache-set', () =>
      setCached(YAHOO_FAST_UNIVERSE_CACHE_KEY, universe, CACHE_TTL.UNIVERSE))

    return universe
  })()

  return completeUniverse
    .filter((entry) => !filters.exchange || entry.exchange === filters.exchange)
    .slice(0, Math.max(limit * 2, 160))
}

export async function buildYahooFastScreenerResults(filters: ScreenerFilters) {
  const universe = await measureStage('screener.yahoo-fast-universe', () =>
    getYahooFastUniverse(filters, filters.limit || 100))

  const quotes: Array<Record<string, unknown>> = await measureStage('screener.yahoo-fast-quotes', () =>
    getYahooQuotes(universe.map((entry) => entry.ticker)) as Promise<Array<Record<string, unknown>>>)

  const exchangeByTicker = new Map(universe.map((entry) => [entry.ticker, entry.exchange]))

  return quotes
    .map((quote: Record<string, unknown>) => annotatePrimaryResult({
      ticker: String(quote.symbol || ''),
      name: String(quote.shortName || quote.longName || quote.symbol || ''),
      sector: 'N/A',
      industry: 'N/A',
      exchange: exchangeByTicker.get(String(quote.symbol || '').toUpperCase()) ||
        normalizeExchange(
          typeof quote.exchange === 'string' ? quote.exchange : undefined,
          typeof quote.fullExchangeName === 'string' ? quote.fullExchangeName : undefined,
        ),
      price: Number(quote.regularMarketPrice) || 0,
      marketCap: Number(quote.marketCap) || 0,
      pe: quote.trailingPE != null ? Number(quote.trailingPE) : null,
      pb: quote.priceToBook != null ? Number(quote.priceToBook) : null,
      roe: null,
      netMargin: null,
      beta: quote.beta != null ? Number(quote.beta) : null,
      dividendYield: quote.dividendYield != null ? Number(quote.dividendYield) / 100 : null,
      debtToEquity: null,
      week52High: Number(quote.fiftyTwoWeekHigh) || 0,
      week52Low: Number(quote.fiftyTwoWeekLow) || 0,
      changePercent: Number(quote.regularMarketChangePercent) || 0,
    }))
    .filter((result) => result.ticker && result.price > 0)
}

export async function enrichScreenerResults(results: ScreenerResult[], scoreWindow: number) {
  if (scoreWindow <= 0 || results.length === 0) return results

  const windowSize = Math.min(scoreWindow, results.length)
  const baseWindow = results.slice(0, windowSize)
  const trailingRows = results.slice(windowSize)

  const enrichedWindow = await measureStage('screener.enrich-score-window', () =>
    mapWithConcurrency(baseWindow, 4, async (row) => {
      try {
        const score = await buildOpportunityScore(row.ticker)
        return {
          ...row,
          opportunityScore: score.overall,
          opportunityRating: score.rating,
          valuationScore: score.pillars.valuation.score,
          qualityScore: score.pillars.quality.score,
          momentumScore: score.pillars.momentum.score,
          eventsScore: score.pillars.events.score,
          reasons: score.summary,
          scoreSource: 'yahoo-enrichment' as const,
          scoreStatus: 'ready' as const,
        }
      } catch {
        return {
          ...row,
          scoreSource: 'yahoo-enrichment' as const,
          scoreStatus: 'unavailable' as const,
        }
      }
    }),
  )

  return [...enrichedWindow, ...trailingRows]
}

export async function runScreener(
  filters: ScreenerFilters,
  options?: { scoreWindow?: number },
): Promise<ScreenerResult[]> {
  const primaryResults = await measureStage('screener.primary-provider', () =>
    screenStocks(filters))

  const filteredResults = await measureStage('screener.post-filter', async () =>
    primaryResults
      .map((result) => annotatePrimaryResult(result))
      .filter((result) => passesPostProviderFilters(result, filters))
      .slice(0, filters.limit || primaryResults.length))

  return enrichScreenerResults(filteredResults, options?.scoreWindow || 0)
}

export async function runEquivalentFastScreener(
  filters: ScreenerFilters,
  options?: { scoreWindow?: number },
) {
  if (!canUseYahooFastPath(filters)) {
    throw new Error('Equivalent fast path does not support the active filters')
  }

  const filteredResults = await measureStage('screener.yahoo-fast-filter', async () =>
    (await buildYahooFastScreenerResults(filters))
      .filter((result) => passesPostProviderFilters(result, filters))
      .slice(0, filters.limit || 100))

  return enrichScreenerResults(filteredResults, options?.scoreWindow || 0)
}
