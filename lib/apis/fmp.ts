import { measureProvider } from '@/lib/observability/performance'

const BASE_URL = 'https://financialmodelingprep.com/api/v3'

function apiKey(): string {
  return process.env.FMP_API_KEY || ''
}

async function fetchFMP(endpoint: string, params: Record<string, string> = {}) {
  return measureProvider('fmp', endpoint, async () => {
    const url = new URL(`${BASE_URL}${endpoint}`)
    url.searchParams.set('apikey', apiKey())
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`FMP error: ${res.status}`)
    const data = await res.json()
    // FMP returns { "Error Message": "..." } on some errors
    if (data && typeof data === 'object' && !Array.isArray(data) && data['Error Message']) {
      throw new Error(`FMP: ${data['Error Message']}`)
    }
    return data
  }, { params })
}

// ─── Quote & Profile (replaces Alpha Vantage for overview) ─────────

export async function getQuote(ticker: string) {
  const data = await fetchFMP(`/quote/${ticker}`)
  return Array.isArray(data) ? data[0] : null
}

export async function getProfile(ticker: string) {
  const data = await fetchFMP(`/profile/${ticker}`)
  return Array.isArray(data) ? data[0] : null
}

// ─── Historical Prices (replaces Alpha Vantage for history) ────────

export async function getHistoricalPrice(ticker: string) {
  const data = await fetchFMP(`/historical-price-full/${ticker}`, {
    serietype: 'line',
  })
  // Returns { symbol, historical: [{ date, open, high, low, close, volume, ... }] }
  return data?.historical || []
}

export async function getHistoricalPriceFull(ticker: string) {
  const data = await fetchFMP(`/historical-price-full/${ticker}`)
  return data?.historical || []
}

// ─── Financials ────────────────────────────────────────────────────

export async function getIncomeStatement(ticker: string, period: 'quarterly' | 'annual' = 'quarterly', limit = 8) {
  return fetchFMP(`/income-statement/${ticker}`, { period, limit: String(limit) })
}

export async function getBalanceSheet(ticker: string, period: 'quarterly' | 'annual' = 'quarterly', limit = 8) {
  return fetchFMP(`/balance-sheet-statement/${ticker}`, { period, limit: String(limit) })
}

export async function getCashFlowStatement(ticker: string, period: 'quarterly' | 'annual' = 'quarterly', limit = 8) {
  return fetchFMP(`/cash-flow-statement/${ticker}`, { period, limit: String(limit) })
}

export async function getKeyMetrics(ticker: string, period: 'quarterly' | 'annual' = 'quarterly', limit = 8) {
  return fetchFMP(`/key-metrics/${ticker}`, { period, limit: String(limit) })
}

export async function getAnalystEstimates(ticker: string) {
  return fetchFMP(`/analyst-estimates/${ticker}`, { limit: '1' })
}

export async function getRatios(ticker: string, period: 'quarterly' | 'annual' = 'quarterly', limit = 4) {
  return fetchFMP(`/ratios/${ticker}`, { period, limit: String(limit) })
}

// ─── Search ────────────────────────────────────────────────────────

export async function searchTicker(query: string, limit = 10) {
  return fetchFMP('/search', { query, limit: String(limit) })
}

// ─── Stock Screener ────────────────────────────────────────────────

export async function screenStocks(filters: import('@/lib/types').ScreenerFilters): Promise<import('@/lib/types').ScreenerResult[]> {
  const params: Record<string, string> = {
    isEtf: 'false',
    isActivelyTrading: 'true',
    limit: String(filters.limit || 50),
  }

  // Exchange y sector
  if (filters.exchange) params.exchange = filters.exchange
  if (filters.sector) params.sector = filters.sector

  // Market cap (FMP acepta en USD directamente)
  if (filters.marketCapMin != null) params.marketCapMoreThan = String(filters.marketCapMin)
  if (filters.marketCapMax != null) params.marketCapLessThan = String(filters.marketCapMax)

  // P/E
  if (filters.peMin != null) params.priceEarningsRatioMoreThan = String(filters.peMin)
  if (filters.peMax != null) params.priceEarningsRatioLessThan = String(filters.peMax)

  // P/B
  if (filters.pbMin != null) params.priceToBookRatioMoreThan = String(filters.pbMin)
  if (filters.pbMax != null) params.priceToBookRatioLessThan = String(filters.pbMax)

  // Profitability
  if (filters.roeMin != null) params.returnOnEquityMoreThan = String(filters.roeMin / 100)
  if (filters.netMarginMin != null) params.netProfitMarginMoreThan = String(filters.netMarginMin / 100)

  // Beta
  if (filters.betaMin != null) params.betaMoreThan = String(filters.betaMin)
  if (filters.betaMax != null) params.betaLessThan = String(filters.betaMax)

  // Capital structure
  if (filters.debtToEquityMax != null) params.debtToEquityLessThan = String(filters.debtToEquityMax)

  // Dividend (FMP acepta en porcentaje, ej: 2 para 2%)
  if (filters.dividendMin != null) params.dividendMoreThan = String(filters.dividendMin)

  // Volumen mínimo para evitar acciones illíquidas
  params.volumeMoreThan = '100000'

  const data = await fetchFMP('/stock-screener', params)

  if (!Array.isArray(data)) return []

  return data.map((item: Record<string, unknown>) => ({
    ticker: String(item.symbol || ''),
    name: String(item.companyName || ''),
    sector: String(item.sector || 'N/A'),
    industry: String(item.industry || 'N/A'),
    exchange: String(item.exchangeShortName || ''),
    price: Number(item.price) || 0,
    marketCap: Number(item.marketCap) || 0,
    pe: pickNumber(item, ['priceEarningsRatio', 'pe']) ?? null,
    pb: pickNumber(item, ['priceToBookRatio', 'priceToBook', 'pb']) ?? null,
    roe: pickNumber(item, ['returnOnEquity', 'returnOnEquityTTM', 'roe']) ?? null,
    netMargin: pickNumber(item, ['netProfitMargin', 'netProfitMarginTTM', 'netMargin']) ?? null,
    beta: item.beta != null ? Number(item.beta) : null,
    dividendYield: item.dividendYield != null ? Number(item.dividendYield) : null,
    week52High: pickNumber(item, ['52WeekHigh', 'yearHigh', 'week52High']) || 0,
    week52Low: pickNumber(item, ['52WeekLow', 'yearLow', 'week52Low']) || 0,
    changePercent: Number(item.changesPercentage) || 0,
  }))
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (value == null || value === '') continue
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return parsed
  }
  return null
}
