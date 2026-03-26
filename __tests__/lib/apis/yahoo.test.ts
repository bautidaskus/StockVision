import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock yahoo-finance2
vi.mock('yahoo-finance2', () => {
  const mockInstance = {
    quoteSummary: vi.fn(),
    search: vi.fn(),
    historical: vi.fn(),
    chart: vi.fn(),
    fundamentalsTimeSeries: vi.fn(),
  }
  return {
    default: class {
      quoteSummary = mockInstance.quoteSummary
      search = mockInstance.search
      historical = mockInstance.historical
      chart = mockInstance.chart
      fundamentalsTimeSeries = mockInstance.fundamentalsTimeSeries
      static _mockInstance = mockInstance
    },
  }
})

import { getYahooEarnings, getYahooFinancials, getYahooInsiders } from '@/lib/apis/yahoo'
import YahooFinance from 'yahoo-finance2'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockYf = (YahooFinance as any)._mockInstance

describe('getYahooEarnings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns earnings data with next date and history', async () => {
    mockYf.quoteSummary.mockResolvedValueOnce({
      calendarEvents: {
        earnings: {
          earningsDate: [new Date('2024-07-25')],
        },
      },
      earningsHistory: {
        earningsHistoryData: [
          {
            quarter: new Date('2024-03-31'),
            epsEstimate: 1.5,
            epsActual: 1.65,
            epsDifference: 0.15,
            surprisePercent: 10.0,
          },
        ],
      },
    })

    const result = await getYahooEarnings('AAPL')

    expect(result.nextEarningsDate).toBe('2024-07-25')
    expect(result.earningsHistory).toHaveLength(1)
    expect(result.earningsHistory[0]).toEqual({
      date: '2024-03-31',
      epsEstimate: 1.5,
      epsActual: 1.65,
      epsSurprise: 0.15,
      epsSurprisePercent: 10.0,
    })
  })

  it('returns null nextEarningsDate when not available', async () => {
    mockYf.quoteSummary.mockResolvedValueOnce({
      calendarEvents: {},
      earningsHistory: { earningsHistoryData: [] },
    })

    const result = await getYahooEarnings('XYZ')

    expect(result.nextEarningsDate).toBeNull()
    expect(result.earningsHistory).toHaveLength(0)
  })

  it('falls back to earningsChart quarterly data when earningsHistory is empty', async () => {
    mockYf.quoteSummary.mockResolvedValueOnce({
      calendarEvents: {
        earnings: {
          earningsDate: ['2026-04-30T20:00:00.000Z'],
        },
      },
      earningsHistory: { earningsHistoryData: [] },
      earnings: {
        earningsChart: {
          quarterly: [
            {
              periodEndDate: 1743379200,
              estimate: 1.5,
              actual: 1.65,
              difference: '0.15',
              surprisePct: '10.0',
            },
          ],
        },
      },
    })

    const result = await getYahooEarnings('AAPL')

    expect(result.nextEarningsDate).toBe('2026-04-30')
    expect(result.earningsHistory).toEqual([
      {
        date: '2025-03-31',
        epsEstimate: 1.5,
        epsActual: 1.65,
        epsSurprise: 0.15,
        epsSurprisePercent: 10,
      },
    ])
  })
})

describe('getYahooInsiders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns insider transactions with buy/sell classification', async () => {
    mockYf.quoteSummary.mockResolvedValueOnce({
      insiderTransactions: {
        transactions: [
          {
            filerName: 'Tim Cook',
            filerRelation: 'CEO',
            startDate: new Date('2024-05-01'),
            shares: 50000,
            value: 8500000,
            transactionText: 'Sale',
          },
          {
            filerName: 'Jeff Williams',
            filerRelation: 'COO',
            startDate: new Date('2024-04-15'),
            shares: 10000,
            value: 1700000,
            transactionText: 'Purchase',
          },
        ],
      },
    })

    const result = await getYahooInsiders('AAPL')

    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0].type).toBe('sell')
    expect(result.transactions[1].type).toBe('buy')
    expect(result.sellCount).toBe(1)
    expect(result.buyCount).toBe(1)
  })

  it('returns empty data when no transactions', async () => {
    mockYf.quoteSummary.mockResolvedValueOnce({
      insiderTransactions: { transactions: [] },
    })

    const result = await getYahooInsiders('XYZ')

    expect(result.transactions).toHaveLength(0)
    expect(result.buyCount).toBe(0)
    expect(result.sellCount).toBe(0)
    expect(result.netBuying).toBe(0)
  })
})

describe('getYahooFinancials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps fundamentalsTimeSeries data into combined financial statements', async () => {
    mockYf.fundamentalsTimeSeries.mockResolvedValueOnce([
      {
        date: new Date('2025-03-31'),
        totalRevenue: 1000,
        costOfRevenue: 400,
        grossProfit: 600,
        operatingIncome: 250,
        netIncome: 200,
        basicEPS: 1.2,
        dilutedEPS: 1.1,
        EBITDA: 300,
        totalAssets: 5000,
        totalLiabilitiesNetMinorityInterest: 3000,
        stockholdersEquity: 2000,
        totalDebt: 800,
        cashAndCashEquivalents: 500,
        operatingCashFlow: 350,
        freeCashFlow: 250,
      },
    ])

    const result = await getYahooFinancials('AAPL', 'quarterly', 4)

    expect(mockYf.fundamentalsTimeSeries).toHaveBeenCalled()
    expect(result.statements).toHaveLength(1)
    expect(result.statements[0]).toEqual({
      date: '2025-03-31',
      period: 'Q',
      revenue: 1000,
      costOfRevenue: 400,
      grossProfit: 600,
      grossProfitRatio: 0.6,
      operatingIncome: 250,
      netIncome: 200,
      netIncomeRatio: 0.2,
      eps: 1.2,
      epsDiluted: 1.1,
      ebitda: 300,
      totalAssets: 5000,
      totalLiabilities: 3000,
      totalEquity: 2000,
      totalDebt: 800,
      cashAndEquivalents: 500,
      operatingCashFlow: 350,
      freeCashFlow: 250,
      roe: 0.1,
      roa: 0.04,
      debtToEquity: 0.4,
    })
  })
})
