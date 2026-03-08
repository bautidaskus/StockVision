const BASE_URL = 'https://www.alphavantage.co/query'

function apiKey(): string {
  return process.env.ALPHA_VANTAGE_API_KEY || ''
}

async function fetchAV(params: Record<string, string>) {
  const url = new URL(BASE_URL)
  url.searchParams.set('apikey', apiKey())
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Alpha Vantage error: ${res.status}`)
  const data = await res.json()

  // Check for rate limit / error messages
  if (data['Note']) throw new Error('Alpha Vantage rate limit reached (5/min)')
  if (data['Information']) throw new Error('Alpha Vantage daily limit reached (25/day)')
  if (data['Error Message']) throw new Error(`Alpha Vantage: ${data['Error Message']}`)

  return data
}

export async function getOverview(ticker: string) {
  const data = await fetchAV({ function: 'OVERVIEW', symbol: ticker })
  return data
}

export async function getGlobalQuote(ticker: string) {
  const data = await fetchAV({ function: 'GLOBAL_QUOTE', symbol: ticker })
  return data['Global Quote'] || null
}

export async function getDailyTimeSeries(ticker: string) {
  const data = await fetchAV({
    function: 'TIME_SERIES_DAILY_ADJUSTED',
    symbol: ticker,
    outputsize: 'full',
  })
  return data['Time Series (Daily)'] || {}
}

export async function getRSI(ticker: string) {
  const data = await fetchAV({
    function: 'RSI',
    symbol: ticker,
    interval: 'daily',
    time_period: '14',
    series_type: 'close',
  })
  return data['Technical Analysis: RSI'] || {}
}

export async function getMACD(ticker: string) {
  const data = await fetchAV({
    function: 'MACD',
    symbol: ticker,
    interval: 'daily',
    series_type: 'close',
  })
  return data['Technical Analysis: MACD'] || {}
}

export async function getSMA(ticker: string, period: number) {
  const data = await fetchAV({
    function: 'SMA',
    symbol: ticker,
    interval: 'daily',
    time_period: String(period),
    series_type: 'close',
  })
  return data[`Technical Analysis: SMA`] || {}
}
