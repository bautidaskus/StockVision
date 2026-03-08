const BASE_URL = 'https://finnhub.io/api/v1'

function apiKey(): string {
  return process.env.FINNHUB_API_KEY || ''
}

export async function getCompanyNews(ticker: string, daysBack = 30) {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - daysBack)

  const fromStr = from.toISOString().split('T')[0]
  const toStr = to.toISOString().split('T')[0]

  const url = `${BASE_URL}/company-news?symbol=${ticker}&from=${fromStr}&to=${toStr}&token=${apiKey()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`)
  const data = await res.json()

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
