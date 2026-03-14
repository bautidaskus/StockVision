const BASE_URL = 'https://finnhub.io/api/v1'

function apiKey(): string {
  return process.env.FINNHUB_API_KEY || ''
}

async function fetchFinnhub(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`)
  url.searchParams.set('token', apiKey())
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`)
  return res.json()
}

// ─── Search ────────────────────────────────────────────────────────

export async function searchSymbols(query: string) {
  const data = await fetchFinnhub('/search', { q: query })
  // data.result is an array of { description, displaySymbol, symbol, type }
  return (data?.result || [])
    .filter((r: Record<string, string>) => r.type === 'Common Stock' || r.type === 'ETP')
    .map((r: Record<string, string>) => ({
      symbol: r.symbol || '',
      name: r.description || '',
      type: r.type || '',
    }))
}

// ─── Quote (Real-time) ─────────────────────────────────────────────

export async function getQuoteFinnhub(ticker: string) {
  const data = await fetchFinnhub('/quote', { symbol: ticker })
  // { c: current, d: change, dp: change%, h: high, l: low, o: open, pc: prev close, t: timestamp }
  return {
    price: data.c || 0,
    change: data.d || 0,
    changePercent: data.dp || 0,
    high: data.h || 0,
    low: data.l || 0,
    open: data.o || 0,
    prevClose: data.pc || 0,
    timestamp: data.t || 0,
  }
}

// ─── Candles (Historical OHLCV) ────────────────────────────────────

export async function getCandles(ticker: string, fromDate: Date, toDate: Date, resolution = 'D') {
  const from = Math.floor(fromDate.getTime() / 1000)
  const to = Math.floor(toDate.getTime() / 1000)

  const data = await fetchFinnhub('/stock/candle', {
    symbol: ticker,
    resolution,
    from: String(from),
    to: String(to),
  })

  if (data.s !== 'ok' || !data.c) return []

  // data has arrays: c(close), h(high), l(low), o(open), v(volume), t(timestamp)
  return data.t.map((timestamp: number, i: number) => ({
    date: new Date(timestamp * 1000).toISOString().split('T')[0],
    open: data.o[i] || 0,
    high: data.h[i] || 0,
    low: data.l[i] || 0,
    close: data.c[i] || 0,
    volume: data.v[i] || 0,
  }))
}

// ─── Basic Financials (metrics) ────────────────────────────────────

export async function getBasicFinancials(ticker: string) {
  const data = await fetchFinnhub('/stock/metric', { symbol: ticker, metric: 'all' })
  const m = data?.metric || {}
  return {
    pe: m.peNormalizedAnnual || m.peTTM || null,
    eps: m.epsNormalizedAnnual || m.epsTTM || null,
    beta: m.beta || null,
    week52High: m['52WeekHigh'] || 0,
    week52Low: m['52WeekLow'] || 0,
    marketCap: m.marketCapitalization ? m.marketCapitalization * 1e6 : 0, // Finnhub returns in millions
    dividendYield: m.dividendYieldIndicatedAnnual ? m.dividendYieldIndicatedAnnual / 100 : null,
    sharesOutstanding: m.shareOutstanding ? m.shareOutstanding * 1e6 : 0,
    revenuePerShare: m.revenuePerShareAnnual || null,
    bookValuePerShare: m.bookValuePerShareAnnual || null,
    priceToBook: m.pbAnnual || null,
    priceToSales: m.psAnnual || null,
  }
}

// ─── Company News ──────────────────────────────────────────────────

// ─── Recommendation Trends ──────────────────────────────────────

export async function getRecommendationTrends(ticker: string) {
  const data = await fetchFinnhub('/stock/recommendation', { symbol: ticker })
  if (!Array.isArray(data)) return []
  return data.map((item: Record<string, unknown>) => ({
    period: String(item.period || ''),
    strongBuy: Number(item.strongBuy) || 0,
    buy: Number(item.buy) || 0,
    hold: Number(item.hold) || 0,
    sell: Number(item.sell) || 0,
    strongSell: Number(item.strongSell) || 0,
  }))
}

// ─── Company News ──────────────────────────────────────────────────

export async function getCompanyNews(ticker: string, daysBack = 30) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - daysBack)

  const fromStr = from.toISOString().split('T')[0]
  const toStr = to.toISOString().split('T')[0]

  const data = await fetchFinnhub('/company-news', {
    symbol: ticker,
    from: fromStr,
    to: toStr,
  })

  // Return only the first 10 news items
  return (data || []).slice(0, 10).map((item: Record<string, unknown>) => ({
    headline: item.headline || '',
    summary: item.summary || '',
    url: item.url || '',
    datetime: item.datetime || 0,
    source: item.source || '',
    image: item.image || '',
  }))
}
