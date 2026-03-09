/* eslint-disable @typescript-eslint/no-explicit-any */
import YahooFinance from 'yahoo-finance2'

const yf = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] })

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

  const result: any[] = await yf.historical(ticker, {
    period1: from,
    period2: now,
    interval: '1d',
  })

  return (result || []).map((d: any) => ({
    date: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date),
    open: d.open || 0,
    high: d.high || 0,
    low: d.low || 0,
    close: d.close || 0,
    volume: d.volume || 0,
  }))
}

// ─── Financials (Income Statement, Balance Sheet, Cash Flow) ───────

export async function getYahooFinancials(ticker: string, period: 'quarterly' | 'annual' = 'quarterly', limit = 8) {
  const result: any = await yf.quoteSummary(ticker, {
    modules: [
      'incomeStatementHistory',
      'incomeStatementHistoryQuarterly',
      'balanceSheetHistory',
      'balanceSheetHistoryQuarterly',
      'cashflowStatementHistory',
      'cashflowStatementHistoryQuarterly',
      'earningsHistory',
    ],
  })

  const isQuarterly = period === 'quarterly'

  const incomeStatements: any[] = isQuarterly
    ? result.incomeStatementHistoryQuarterly?.incomeStatementHistory || []
    : result.incomeStatementHistory?.incomeStatementHistory || []

  const balanceSheets: any[] = isQuarterly
    ? result.balanceSheetHistoryQuarterly?.balanceSheetStatements || []
    : result.balanceSheetHistory?.balanceSheetStatements || []

  const cashFlows: any[] = isQuarterly
    ? result.cashflowStatementHistoryQuarterly?.cashflowStatements || []
    : result.cashflowStatementHistory?.cashflowStatements || []

  // Build EPS lookup by quarter date from earningsHistory
  const earningsData: any[] = result.earningsHistory?.earningsHistoryData || []
  const epsMap: Record<string, number> = {}
  for (const e of earningsData) {
    const date = e.quarter instanceof Date
      ? e.quarter.toISOString().split('T')[0]
      : String(e.quarter || '')
    if (date && e.epsActual != null) {
      epsMap[date] = Number(e.epsActual)
    }
  }

  // Merge into combined statements (most recent first from Yahoo)
  const statements = incomeStatements.slice(0, limit).map((inc: any, i: number) => {
    const bal: any = balanceSheets[i] || {}
    const cf: any = cashFlows[i] || {}

    const incDate = inc.endDate instanceof Date ? inc.endDate.toISOString().split('T')[0] : String(inc.endDate)
    const revenue = Number(inc.totalRevenue) || 0
    const grossProfit = Number(inc.grossProfit) || 0
    const netIncome = Number(inc.netIncome) || 0
    const totalEquity = Number(bal.totalStockholderEquity) || 0

    return {
      date: incDate,
      period: isQuarterly ? 'Q' : 'FY',
      revenue,
      costOfRevenue: Number(inc.costOfRevenue) || 0,
      grossProfit,
      grossProfitRatio: revenue > 0 ? grossProfit / revenue : 0,
      operatingIncome: Number(inc.operatingIncome) || 0,
      netIncome,
      netIncomeRatio: revenue > 0 ? netIncome / revenue : 0,
      eps: epsMap[incDate] ?? (revenue > 0 && inc.netIncome ? Number(inc.netIncome) / (Number(inc.basicAverageShares) || 1) : 0),
      epsDiluted: epsMap[incDate] ?? (revenue > 0 && inc.netIncome ? Number(inc.netIncome) / (Number(inc.dilutedAverageShares) || Number(inc.basicAverageShares) || 1) : 0),
      ebitda: Number(inc.ebitda) || 0,
      totalAssets: Number(bal.totalAssets) || 0,
      totalLiabilities: Number(bal.totalLiab) || 0,
      totalEquity,
      totalDebt: Number(bal.longTermDebt) || 0,
      cashAndEquivalents: Number(bal.cash) || 0,
      operatingCashFlow: Number(cf.totalCashFromOperatingActivities) || 0,
      freeCashFlow:
        (Number(cf.totalCashFromOperatingActivities) || 0) +
        (Number(cf.capitalExpenditures) || 0), // capex is negative
      roe: totalEquity > 0 ? netIncome / totalEquity : null,
      roa: Number(bal.totalAssets) > 0 ? netIncome / Number(bal.totalAssets) : null,
      debtToEquity: totalEquity > 0 ? (Number(bal.longTermDebt) || 0) / totalEquity : null,
    }
  })

  return { statements }
}
