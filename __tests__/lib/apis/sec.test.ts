import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('getSecFinancials', () => {
  beforeEach(() => {
    vi.resetModules()
    mockFetch.mockReset()
  })

  it('maps SEC company facts into normalized financial statements', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [[320193, 'Apple Inc.', 'AAPL', 'Nasdaq']],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          facts: {
            dei: {
              EntityCommonStockSharesOutstanding: {
                units: {
                  shares: [{ end: '2024-12-31', val: 100, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY' }],
                },
              },
            },
            'us-gaap': {
              Revenues: {
                units: {
                  USD: [{ start: '2024-01-01', end: '2024-12-31', val: 1000, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY', frame: 'CY2024' }],
                },
              },
              CostOfRevenue: {
                units: {
                  USD: [{ start: '2024-01-01', end: '2024-12-31', val: 400, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY', frame: 'CY2024' }],
                },
              },
              GrossProfit: {
                units: {
                  USD: [{ start: '2024-01-01', end: '2024-12-31', val: 600, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY', frame: 'CY2024' }],
                },
              },
              OperatingIncomeLoss: {
                units: {
                  USD: [{ start: '2024-01-01', end: '2024-12-31', val: 250, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY', frame: 'CY2024' }],
                },
              },
              NetIncomeLoss: {
                units: {
                  USD: [{ start: '2024-01-01', end: '2024-12-31', val: 200, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY', frame: 'CY2024' }],
                },
              },
              EarningsPerShareBasic: {
                units: {
                  'USD/shares': [{ start: '2024-01-01', end: '2024-12-31', val: 1.2, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY', frame: 'CY2024' }],
                },
              },
              EarningsPerShareDiluted: {
                units: {
                  'USD/shares': [{ start: '2024-01-01', end: '2024-12-31', val: 1.1, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY', frame: 'CY2024' }],
                },
              },
              NetCashProvidedByUsedInOperatingActivities: {
                units: {
                  USD: [{ start: '2024-01-01', end: '2024-12-31', val: 350, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY', frame: 'CY2024' }],
                },
              },
              PaymentsToAcquirePropertyPlantAndEquipment: {
                units: {
                  USD: [{ start: '2024-01-01', end: '2024-12-31', val: 100, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY', frame: 'CY2024' }],
                },
              },
              Assets: {
                units: {
                  USD: [{ end: '2024-12-31', val: 5000, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY' }],
                },
              },
              Liabilities: {
                units: {
                  USD: [{ end: '2024-12-31', val: 3000, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY' }],
                },
              },
              StockholdersEquity: {
                units: {
                  USD: [{ end: '2024-12-31', val: 2000, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY' }],
                },
              },
              CashAndCashEquivalentsAtCarryingValue: {
                units: {
                  USD: [{ end: '2024-12-31', val: 500, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY' }],
                },
              },
              AssetsCurrent: {
                units: {
                  USD: [{ end: '2024-12-31', val: 1200, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY' }],
                },
              },
              LiabilitiesCurrent: {
                units: {
                  USD: [{ end: '2024-12-31', val: 800, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY' }],
                },
              },
              LongTermDebtCurrent: {
                units: {
                  USD: [{ end: '2024-12-31', val: 100, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY' }],
                },
              },
              LongTermDebtNoncurrent: {
                units: {
                  USD: [{ end: '2024-12-31', val: 700, form: '10-K', filed: '2025-02-01', fy: 2024, fp: 'FY' }],
                },
              },
            },
          },
        }),
      })

    const { getSecFinancials } = await import('@/lib/apis/sec')
    const result = await getSecFinancials('AAPL', 'annual', 2)

    expect(result.statements).toHaveLength(1)
    expect(result.statements[0]).toMatchObject({
      date: '2024-12-31',
      source: 'sec',
      revenue: 1000,
      grossProfit: 600,
      netIncome: 200,
      eps: 1.2,
      epsDiluted: 1.1,
      totalAssets: 5000,
      totalLiabilities: 3000,
      totalEquity: 2000,
      totalDebt: 800,
      currentAssets: 1200,
      currentLiabilities: 800,
      sharesOutstandingPeriod: 100,
      freeCashFlow: 250,
    })
  })
})
