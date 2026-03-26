/* eslint-disable @typescript-eslint/no-explicit-any */
import YahooFinance from 'yahoo-finance2'
import type { AnalystRecommendation, FinancialStatement, NewsItem } from '@/lib/types'

const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey', 'ripHistorical'] })

function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().split('T')[0]
  if (typeof value === 'number') return new Date(value * 1000).toISOString().split('T')[0]
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]
    return value
  }
  return ''
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toNumberOrNull(value)
    if (parsed != null) return parsed
  }
  return null
}

// ─── Search ────────────────────────────────────────────────────────

export async function searchYahoo(query: string, limit = 8) {
  const result: any = await yf.search(query, { newsCount: 0 })
  return (result.quotes || [])
    .filter((q: any) => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
    .slice(0, limit)
    .map((q: any) => ({
      symbol: q.symbol || '',
      name: q.shortname || q.longname || q.symbol || '',
      exchange: q.exchDisp || q.exchange || '',
      quoteType: q.quoteType || '',
    }))
}

// ─── Quote + Profile (combined via quoteSummary) ───────────────────

export async function getYahooQuote(ticker: string) {
  const result: any = await yf.quoteSummary(ticker, {
    modules: ['price', 'summaryProfile', 'summaryDetail', 'defaultKeyStatistics'],
  })

  const price = result.price || {}
  const profile = result.summaryProfile || {}
  const detail = result.summaryDetail || {}
  const stats = result.defaultKeyStatistics || {}

  return {
    // Price data
    symbol: price.symbol || ticker,
    name: price.shortName || price.longName || ticker,
    price: price.regularMarketPrice || 0,
    change: price.regularMarketChange || 0,
    changePercent: price.regularMarketChangePercent
      ? price.regularMarketChangePercent * 100
      : 0,
    marketCap: price.marketCap || 0,

    // Profile
    sector: profile.sector || 'N/A',
    industry: profile.industry || 'N/A',
    description: profile.longBusinessSummary || '',
    website: profile.website || '',

    // Valuation
    pe: detail.trailingPE || null,
    forwardPe: detail.forwardPE || null,
    eps: stats.trailingEps || null,
    dividendYield: detail.dividendYield || null,
    beta: detail.beta || null,
    week52High: detail.fiftyTwoWeekHigh || 0,
    week52Low: detail.fiftyTwoWeekLow || 0,
    priceToSales: detail.priceToSalesTrailing12Months || null,
    priceToBook: stats.priceToBook || null,
    pegRatio: stats.pegRatio || null,
    enterpriseToEbitda: stats.enterpriseToEbitda || null,

    // Shares
    sharesOutstanding: stats.sharesOutstanding || 0,
  }
}

// ─── Historical Prices ─────────────────────────────────────────────

export async function getYahooHistory(ticker: string, years = 5) {
  const now = new Date()
  const from = new Date()
  from.setFullYear(from.getFullYear() - years)

  const result: any = await yf.chart(ticker, {
    period1: from,
    period2: now,
    interval: '1d',
  })

  return (result?.quotes || [])
    .map((d: any) => ({
      date: toIsoDate(d.date),
      open: toNumberOrNull(d.open),
      high: toNumberOrNull(d.high),
      low: toNumberOrNull(d.low),
      close: toNumberOrNull(d.close),
      volume: toNumberOrNull(d.volume),
    }))
    .filter((d: any) =>
      d.date &&
      d.open != null &&
      d.high != null &&
      d.low != null &&
      d.close != null &&
      d.volume != null
    )
    .map((d: any) => ({
      date: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }))
}

// ─── Earnings ───────────────────────────────────────────────────────

export async function getYahooEarnings(ticker: string) {
  const result: any = await yf.quoteSummary(ticker, {
    modules: ['calendarEvents', 'earnings', 'earningsHistory', 'earningsTrend'],
  })

  // Next earnings date
  const calEvents = result.calendarEvents || {}
  const earningsDates =
    calEvents.earnings?.earningsDate ||
    result.earnings?.earningsChart?.earningsDate ||
    []
  const nextEarningsDate = earningsDates.length > 0
    ? toIsoDate(earningsDates[0])
    : null

  // Legacy earnings history (often empty now)
  const historyData: any[] = result.earningsHistory?.earningsHistoryData || []
  let earningsHistory = historyData.map((e: any) => ({
    date: toIsoDate(e.quarter),
    epsEstimate: toNumberOrNull(e.epsEstimate),
    epsActual: toNumberOrNull(e.epsActual),
    epsSurprise: toNumberOrNull(e.epsDifference),
    epsSurprisePercent: toNumberOrNull(e.surprisePercent),
  }))

  // Current Yahoo data tends to expose actual quarterly EPS here instead.
  if (earningsHistory.length === 0) {
    const quarterly: any[] = result.earnings?.earningsChart?.quarterly || []
    earningsHistory = quarterly.map((entry: any) => ({
      date: toIsoDate(entry.periodEndDate || entry.reportedDate || entry.date),
      epsEstimate: toNumberOrNull(entry.estimate),
      epsActual: toNumberOrNull(entry.actual),
      epsSurprise: toNumberOrNull(entry.difference),
      epsSurprisePercent: toNumberOrNull(entry.surprisePct),
    }))
  }

  return {
    nextEarningsDate,
    earningsHistory: earningsHistory
      .filter((item) => item.date || item.epsEstimate != null || item.epsActual != null)
      .sort((a, b) => b.date.localeCompare(a.date)),
  }
}

// ─── Insider Transactions ───────────────────────────────────────────

export async function getYahooInsiders(ticker: string) {
  const result: any = await yf.quoteSummary(ticker, {
    modules: ['insiderTransactions'],
  })

  const rawTransactions: any[] = result.insiderTransactions?.transactions || []

  let buyCount = 0
  let sellCount = 0
  let netBuying = 0

  const transactions = rawTransactions.map((t: any) => {
    const shares = Number(t.shares) || 0
    const value = t.value != null ? Number(t.value) : null
    const text = String(t.transactionText || '').toLowerCase()

    let type: 'buy' | 'sell' | 'other' = 'other'
    if (text.includes('purchase') || text.includes('buy') || text.includes('acquisition')) {
      type = 'buy'
      buyCount++
      netBuying += shares
    } else if (text.includes('sale') || text.includes('sell') || text.includes('disposition')) {
      type = 'sell'
      sellCount++
      netBuying -= shares
    }

    const date = t.startDate instanceof Date
      ? t.startDate.toISOString().split('T')[0]
      : String(t.startDate || '')

    return {
      name: String(t.filerName || 'Unknown'),
      position: String(t.filerRelation || 'N/A'),
      date,
      shares,
      value,
      type,
    }
  })

  return { transactions, netBuying, buyCount, sellCount }
}

// ─── Financials (Income Statement, Balance Sheet, Cash Flow) ───────

export async function getYahooFinancials(ticker: string, period: 'quarterly' | 'annual' = 'quarterly', limit = 8) {
  const now = new Date()
  const from = new Date()
  from.setFullYear(from.getFullYear() - (period === 'quarterly' ? 5 : 10))

  const result: any[] = await yf.fundamentalsTimeSeries(ticker, {
    period1: from.toISOString().split('T')[0],
    period2: now.toISOString().split('T')[0],
    type: period === 'quarterly' ? 'quarterly' : 'annual',
    module: 'all',
  })

  const statements: FinancialStatement[] = (result || [])
    .map((entry: any) => {
      const date = toIsoDate(entry.date)
      const revenue = pickNumber(entry.totalRevenue, entry.operatingRevenue)
      const grossProfit = pickNumber(entry.grossProfit)
      const netIncome = pickNumber(
        entry.netIncome,
        entry.netIncomeCommonStockholders,
        entry.netIncomeContinuousOperations,
      )
      const totalAssets = pickNumber(entry.totalAssets)
      const totalLiabilities = pickNumber(
        entry.totalLiabilitiesNetMinorityInterest,
        entry.totalLiabilities,
      )
      const totalEquity = pickNumber(
        entry.stockholdersEquity,
        entry.totalEquityGrossMinorityInterest,
        entry.commonStockEquity,
      )
      const operatingCashFlow = pickNumber(
        entry.operatingCashFlow,
        entry.cashFlowFromContinuingOperatingActivities,
      )
      const totalDebt = pickNumber(
        entry.totalDebt,
        entry.longTermDebt,
        entry.longTermDebtAndCapitalLeaseObligation,
      )

      return {
        date,
        period: period === 'quarterly' ? 'Q' : 'FY',
        source: 'yahoo' as const,
        filedAt: null,
        fiscalYear: null,
        fiscalPeriod: null,
        revenue,
        costOfRevenue: pickNumber(entry.costOfRevenue, entry.reconciledCostOfRevenue),
        grossProfit,
        grossProfitRatio: revenue != null && grossProfit != null && revenue !== 0 ? grossProfit / revenue : null,
        operatingIncome: pickNumber(entry.operatingIncome, entry.totalOperatingIncomeAsReported),
        netIncome,
        netIncomeRatio: revenue != null && netIncome != null && revenue !== 0 ? netIncome / revenue : null,
        eps: pickNumber(entry.basicEPS, entry.reportedNormalizedBasicEPS, entry.normalizedBasicEPS),
        epsDiluted: pickNumber(entry.dilutedEPS, entry.reportedNormalizedDilutedEPS, entry.normalizedDilutedEPS),
        ebitda: pickNumber(entry.EBITDA, entry.normalizedEBITDA),
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalDebt,
        cashAndEquivalents: pickNumber(
          entry.cashAndCashEquivalents,
          entry.cashCashEquivalentsAndShortTermInvestments,
          entry.cashFinancial,
        ),
        currentAssets: pickNumber(entry.currentAssets),
        currentLiabilities: pickNumber(entry.currentLiabilities),
        sharesOutstandingPeriod: pickNumber(entry.ordinarySharesNumber, entry.shareIssued),
        operatingCashFlow,
        freeCashFlow: pickNumber(entry.freeCashFlow),
        roe: totalEquity != null && netIncome != null && totalEquity !== 0 ? netIncome / totalEquity : null,
        roa: totalAssets != null && netIncome != null && totalAssets !== 0 ? netIncome / totalAssets : null,
        debtToEquity: totalEquity != null && totalDebt != null && totalEquity !== 0 ? totalDebt / totalEquity : null,
      }
    })
    .filter((entry) => entry.date && entry.revenue != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)

  return { statements }
}

export async function getYahooRecommendationTrend(ticker: string): Promise<AnalystRecommendation[]> {
  const result: any = await yf.quoteSummary(ticker, {
    modules: ['recommendationTrend'],
  })

  const trend: any[] = result.recommendationTrend?.trend || []

  return trend.map((item: any) => ({
    period: String(item.period || ''),
    strongBuy: Number(item.strongBuy) || 0,
    buy: Number(item.buy) || 0,
    hold: Number(item.hold) || 0,
    sell: Number(item.sell) || 0,
    strongSell: Number(item.strongSell) || 0,
  }))
}

export async function getYahooNews(query: string, limit = 10): Promise<NewsItem[]> {
  const result: any = await yf.search(query, {
    quotesCount: 0,
    newsCount: limit,
  })

  return (result.news || []).slice(0, limit).map((item: any) => ({
    headline: String(item.title || ''),
    summary: String(item.summary || ''),
    url: String(item.link || ''),
    datetime: Math.floor(new Date(item.providerPublishTime || Date.now()).getTime() / 1000),
    source: String(item.publisher || ''),
    image: item.thumbnail?.resolutions?.[0]?.url || '',
  }))
}

export async function getYahooScreenerSymbols(scrIds: string[], count = 25): Promise<string[]> {
  const results = await Promise.all(
    scrIds.map((scrId) =>
      yf.screener({ scrIds: scrId, count }).catch(() => null)
    )
  )

  const symbols = new Set<string>()
  for (const result of results) {
    for (const quote of result?.quotes || []) {
      const symbol = String(quote.symbol || '').toUpperCase()
      if (/^[A-Z][A-Z.-]{0,6}$/.test(symbol)) {
        symbols.add(symbol)
      }
    }
  }

  return Array.from(symbols)
}
