import { getSecTickerUniverse } from '@/lib/apis/sec'
import {
  getYahooEarnings,
  getYahooHistory,
  getYahooInsiders,
  getYahooQuote,
  getYahooRecommendationTrend,
  getYahooScreenerSymbols,
} from '@/lib/apis/yahoo'
import { getNormalizedFinancials } from '@/lib/fundamentals'
import { buildOpportunityScoreFromContext } from '@/lib/scoring/opportunity-score'
import { DEFAULT_UNIVERSE } from '@/lib/data/default-universe'
import { measureStage } from '@/lib/observability/performance'
import type { OpportunityScoreContext } from '@/lib/scoring/opportunity-score'
import type { ScreenerFilters, ScreenerResult } from '@/lib/types'

const UNIVERSE_SCREENER_IDS = [
  'day_gainers',
  'day_losers',
  'most_actives',
  'undervalued_growth_stocks',
  'growth_technology_stocks',
  'most_shorted_stocks',
]

function normalizeExchange(exchange: string) {
  if (exchange === 'Nasdaq') return 'NASDAQ'
  if (exchange === 'NYSE') return 'NYSE'
  if (exchange === 'NYSE American') return 'AMEX'
  return exchange.toUpperCase()
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const current = index++
      results[current] = await fn(items[current], current)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()))
  return results
}

async function getRankingUniverse(filters: ScreenerFilters, limit = 80) {
  const secUniverse = await getSecTickerUniverse(300).catch(() => [])
  const secMap = new Map(secUniverse.map((entry) => [entry.ticker.toUpperCase(), entry]))

  const yahooSymbols = await getYahooScreenerSymbols(UNIVERSE_SCREENER_IDS, 20).catch(() => [])
  const tickers = new Set<string>(DEFAULT_UNIVERSE)

  for (const entry of secUniverse.slice(0, 120)) {
    tickers.add(entry.ticker.toUpperCase())
  }
  for (const ticker of yahooSymbols) {
    tickers.add(ticker.toUpperCase())
  }

  const universe = Array.from(tickers)
    .map((ticker) => {
      const sec = secMap.get(ticker)
      return {
        ticker,
        exchange: sec ? normalizeExchange(sec.exchange) : '',
      }
    })
    .filter((entry) => !filters.exchange || entry.exchange === filters.exchange)
    .slice(0, limit)

  return universe
}

function passesFilters(result: ScreenerResult, filters: ScreenerFilters) {
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

async function buildScreenerRow(ticker: string, exchange: string): Promise<ScreenerResult | null> {
  try {
    const [overview, quarterlyFinancials, annualFinancials, history, earnings, insiders, recommendations] = await Promise.all([
      getYahooQuote(ticker),
      getNormalizedFinancials(ticker, 'quarterly', 8).catch(() => ({ statements: [], sourceSummary: [] as Array<'yahoo' | 'sec' | 'merged'> })),
      getNormalizedFinancials(ticker, 'annual', 4).catch(() => ({ statements: [], sourceSummary: [] as Array<'yahoo' | 'sec' | 'merged'> })),
      getYahooHistory(ticker, 3).catch(() => []),
      getYahooEarnings(ticker).catch(() => ({ nextEarningsDate: null, earningsHistory: [] })),
      getYahooInsiders(ticker).catch(() => ({ transactions: [], netBuying: 0, buyCount: 0, sellCount: 0 })),
      getYahooRecommendationTrend(ticker).catch(() => []),
    ])

    if (!overview?.price || !overview.symbol) return null

    const context: OpportunityScoreContext = {
      overview,
      quarterlyFinancials,
      annualFinancials,
      history,
      earnings,
      insiders,
      recommendations,
    }

    const score = buildOpportunityScoreFromContext(ticker, context)
    const latestAnnual = annualFinancials.statements[0]

    return {
      ticker: overview.symbol,
      name: overview.name || overview.symbol,
      sector: overview.sector || 'N/A',
      industry: overview.industry || 'N/A',
      exchange,
      price: overview.price || 0,
      marketCap: overview.marketCap || 0,
      pe: overview.pe ?? null,
      pb: overview.priceToBook ?? null,
      roe: latestAnnual?.roe ?? null,
      netMargin: latestAnnual?.netIncomeRatio ?? null,
      beta: overview.beta ?? null,
      dividendYield: overview.dividendYield ?? null,
      debtToEquity: latestAnnual?.debtToEquity ?? null,
      week52High: overview.week52High || 0,
      week52Low: overview.week52Low || 0,
      changePercent: overview.changePercent || 0,
      opportunityScore: score.overall,
      opportunityRating: score.rating,
      valuationScore: score.pillars.valuation.score,
      qualityScore: score.pillars.quality.score,
      momentumScore: score.pillars.momentum.score,
      eventsScore: score.pillars.events.score,
      reasons: score.summary,
    }
  } catch {
    return null
  }
}

export async function rankStocks(filters: ScreenerFilters): Promise<ScreenerResult[]> {
  const universe = await measureStage('screener.build-universe', () =>
    getRankingUniverse(filters, Math.max(filters.limit || 50, 80)))
  const rows = await measureStage('screener.enrich-universe', () =>
    mapWithConcurrency(universe, 5, (entry) => buildScreenerRow(entry.ticker, entry.exchange)), {
      universeSize: universe.length,
    })

  return measureStage('screener.filter-sort', async () =>
    rows
      .filter((row): row is ScreenerResult => row !== null)
      .filter((row) => passesFilters(row, filters))
      .sort((a, b) => {
        const scoreDiff = (b.opportunityScore || -1) - (a.opportunityScore || -1)
        if (scoreDiff !== 0) return scoreDiff
        return b.marketCap - a.marketCap
      })
      .slice(0, filters.limit || 50))
}
