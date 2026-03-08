const BASE_URL = 'https://api.coingecko.com/api/v3'

function headers(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY
  if (key) {
    return { 'x-cg-demo-api-key': key }
  }
  return {}
}

async function fetchCG(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { headers: headers() })
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`)
  return res.json()
}

export async function getCoinData(id: string) {
  return fetchCG(`/coins/${id}`, {
    localization: 'false',
    tickers: 'false',
    market_data: 'true',
    community_data: 'false',
    developer_data: 'false',
    sparkline: 'false',
  })
}

export async function getCoinMarketChart(id: string, days: string = '365') {
  return fetchCG(`/coins/${id}/market_chart`, {
    vs_currency: 'usd',
    days,
  })
}

export async function searchCoins(query: string) {
  return fetchCG('/search', { query })
}
