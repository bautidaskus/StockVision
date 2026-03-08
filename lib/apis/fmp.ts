const BASE_URL = 'https://financialmodelingprep.com/api/v3'

function apiKey(): string {
  return process.env.FMP_API_KEY || ''
}

async function fetchFMP(endpoint: string, params: Record<string, string> = {}) {
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
