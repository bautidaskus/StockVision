import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { OHLCV, StockOverview } from '@/lib/types'

const { getOverviewCachedMock, getHistoryCachedMock } = vi.hoisted(() => ({
  getOverviewCachedMock: vi.fn(),
  getHistoryCachedMock: vi.fn(),
}))

vi.mock('@/lib/services/stock-service', () => ({
  getOverviewCached: getOverviewCachedMock,
  getHistoryCached: getHistoryCachedMock,
}))

import { GET } from '@/app/api/batch/overview/route'

function makeOverview(ticker: string, price: number): StockOverview {
  return {
    ticker,
    name: ticker,
    sector: null,
    industry: null,
    description: '',
    price,
    change: 0,
    changePercent: 0,
    marketCap: null,
    pe: null,
    forwardPe: null,
    eps: null,
    dividendYield: null,
    beta: null,
    week52High: null,
    week52Low: null,
    sharesOutstanding: null,
    evToEbitda: null,
    priceToSales: null,
    priceToBook: null,
    pegRatio: null,
  }
}

function makeHistory(closes: number[]): OHLCV[] {
  return closes.map((close, i) => ({
    date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    open: close,
    high: close,
    low: close,
    close,
    volume: 0,
  }))
}

describe('GET /api/batch/overview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns overview + sparkline keyed by ticker', async () => {
    getOverviewCachedMock.mockImplementation(async (t: string) => makeOverview(t, t === 'MELI' ? 100 : 200))
    getHistoryCachedMock.mockResolvedValue(makeHistory([50, 55, 60]))

    const req = new NextRequest('http://localhost/api/batch/overview?tickers=MELI,MSFT&spark=1m')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.MELI.overview.price).toBe(100)
    expect(body.MELI.sparkline).toEqual([50, 55, 60])
    expect(body.MSFT.overview.price).toBe(200)
    expect(body.MSFT.sparkline).toEqual([50, 55, 60])
  })

  it('uppercases, trims and dedupes tickers', async () => {
    getOverviewCachedMock.mockImplementation(async (t: string) => makeOverview(t, 1))
    getHistoryCachedMock.mockResolvedValue([])

    const req = new NextRequest('http://localhost/api/batch/overview?tickers= meli , MELI,msft ')
    await GET(req)

    expect(getOverviewCachedMock).toHaveBeenCalledTimes(2)
    expect(getOverviewCachedMock).toHaveBeenCalledWith('MELI')
    expect(getOverviewCachedMock).toHaveBeenCalledWith('MSFT')
  })

  it('returns empty sparkline when history is missing', async () => {
    getOverviewCachedMock.mockResolvedValue(makeOverview('MELI', 1))
    getHistoryCachedMock.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/batch/overview?tickers=MELI')
    const res = await GET(req)
    const body = await res.json()

    expect(body.MELI.sparkline).toEqual([])
  })

  it('keeps other tickers when one provider throws', async () => {
    getOverviewCachedMock.mockImplementation(async (t: string) => {
      if (t === 'BOOM') throw new Error('nope')
      return makeOverview(t, 1)
    })
    getHistoryCachedMock.mockResolvedValue(makeHistory([1, 2]))

    const req = new NextRequest('http://localhost/api/batch/overview?tickers=MELI,BOOM')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.MELI.overview.ticker).toBe('MELI')
    expect(body.BOOM.overview).toBeNull()
    expect(body.BOOM.sparkline).toEqual([1, 2])
  })

  it('rejects when no tickers are provided', async () => {
    const req = new NextRequest('http://localhost/api/batch/overview?tickers=')
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('rejects when too many tickers are requested', async () => {
    const tooMany = Array.from({ length: 51 }, (_, i) => `T${i}`).join(',')
    const req = new NextRequest(`http://localhost/api/batch/overview?tickers=${tooMany}`)
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
