import { beforeEach, describe, expect, it, vi } from 'vitest'

const { screenStocksMock, buildOpportunityScoreMock } = vi.hoisted(() => ({
  screenStocksMock: vi.fn(),
  buildOpportunityScoreMock: vi.fn(),
}))

vi.mock('@/lib/apis/fmp', () => ({
  screenStocks: screenStocksMock,
}))

vi.mock('@/lib/scoring/opportunity-score', () => ({
  buildOpportunityScore: buildOpportunityScoreMock,
}))

import { runScreener } from '@/lib/screener/service'
import type { ScreenerResult } from '@/lib/types'

const baseResults: ScreenerResult[] = [
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    exchange: 'NASDAQ',
    price: 180,
    marketCap: 2_000_000_000_000,
    pe: 30,
    pb: 40,
    roe: 0.25,
    netMargin: 0.22,
    beta: 1.2,
    dividendYield: 0.005,
    debtToEquity: 1.2,
    week52High: 220,
    week52Low: 150,
    changePercent: 1.4,
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft',
    sector: 'Technology',
    industry: 'Software',
    exchange: 'NASDAQ',
    price: 420,
    marketCap: 1_800_000_000_000,
    pe: 32,
    pb: 12,
    roe: 0.28,
    netMargin: 0.31,
    beta: 0.9,
    dividendYield: 0.007,
    debtToEquity: 0.5,
    week52High: 430,
    week52Low: 300,
    changePercent: 0.9,
  },
  {
    ticker: 'KO',
    name: 'Coca-Cola',
    sector: 'Consumer Defensive',
    industry: 'Beverages',
    exchange: 'NYSE',
    price: 60,
    marketCap: 250_000_000_000,
    pe: 24,
    pb: 8,
    roe: 0.12,
    netMargin: 0.18,
    beta: 0.4,
    dividendYield: 0.03,
    debtToEquity: 1.8,
    week52High: 66,
    week52Low: 55,
    changePercent: -0.2,
  },
]

describe('runScreener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    screenStocksMock.mockResolvedValue(baseResults)
  })

  it('anota resultados primarios y aplica filtros post-proveedor', async () => {
    const results = await runScreener({
      exchange: 'NASDAQ',
      pctFromHighMax: -5,
      limit: 50,
    })

    expect(screenStocksMock).toHaveBeenCalledWith({
      exchange: 'NASDAQ',
      pctFromHighMax: -5,
      limit: 50,
    })
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      ticker: 'AAPL',
      primaryDataSource: 'fmp-screener',
      scoreSource: null,
      scoreStatus: 'not-requested',
      opportunityScore: null,
    })
  })

  it('solo enriquece la ventana solicitada de scores', async () => {
    buildOpportunityScoreMock
      .mockResolvedValueOnce({
        overall: 81,
        rating: 'Muy atractiva',
        summary: ['Alta calidad'],
        pillars: {
          valuation: { score: 77 },
          quality: { score: 84 },
          momentum: { score: 80 },
          events: { score: 69 },
        },
      })
      .mockRejectedValueOnce(new Error('upstream failed'))

    const results = await runScreener(
      { limit: 3 },
      { scoreWindow: 2 },
    )

    expect(buildOpportunityScoreMock).toHaveBeenCalledTimes(2)
    expect(results[0]).toMatchObject({
      ticker: 'AAPL',
      opportunityScore: 81,
      opportunityRating: 'Muy atractiva',
      scoreSource: 'yahoo-enrichment',
      scoreStatus: 'ready',
      reasons: ['Alta calidad'],
    })
    expect(results[1]).toMatchObject({
      ticker: 'MSFT',
      scoreSource: 'yahoo-enrichment',
      scoreStatus: 'unavailable',
    })
    expect(results[2]).toMatchObject({
      ticker: 'KO',
      scoreStatus: 'not-requested',
      opportunityScore: null,
    })
  })
})
