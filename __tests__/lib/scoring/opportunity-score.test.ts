import { describe, expect, it } from 'vitest'
import { buildOpportunityScoreFromContext } from '@/lib/scoring/opportunity-score'

const baseHistory = Array.from({ length: 260 }).map((_, index) => ({
  date: `2025-01-${String((index % 28) + 1).padStart(2, '0')}`,
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100 + index,
  volume: 1_000_000 + index,
}))

describe('buildOpportunityScoreFromContext', () => {
  it('returns an attractive score for a strong company profile', () => {
    const score = buildOpportunityScoreFromContext('AAPL', {
      overview: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        price: 360,
        change: 2,
        changePercent: 1,
        marketCap: 3_000_000_000_000,
        sector: 'Technology',
        industry: 'Consumer Electronics',
        description: '',
        website: '',
        pe: 18,
        forwardPe: 16,
        eps: 8,
        dividendYield: 0.005,
        beta: 1.1,
        week52High: 380,
        week52Low: 240,
        priceToBook: 4,
        pegRatio: 1.5,
        enterpriseToEbitda: 14,
        sharesOutstanding: 15_000_000_000,
        priceToSales: 5,
      },
      quarterlyFinancials: {
        statements: [],
        sourceSummary: ['yahoo'],
      },
      annualFinancials: {
        statements: [
          {
            date: '2025-12-31',
            period: 'FY',
            source: 'yahoo',
            filedAt: null,
            fiscalYear: 2025,
            fiscalPeriod: 'FY',
            revenue: 420_000_000_000,
            costOfRevenue: 190_000_000_000,
            grossProfit: 230_000_000_000,
            grossProfitRatio: 0.55,
            operatingIncome: 150_000_000_000,
            netIncome: 110_000_000_000,
            netIncomeRatio: 0.26,
            eps: 7.4,
            epsDiluted: 7.3,
            ebitda: 160_000_000_000,
            totalAssets: 380_000_000_000,
            totalLiabilities: 280_000_000_000,
            totalEquity: 100_000_000_000,
            totalDebt: 90_000_000_000,
            cashAndEquivalents: 50_000_000_000,
            currentAssets: 150_000_000_000,
            currentLiabilities: 100_000_000_000,
            sharesOutstandingPeriod: 15_000_000_000,
            operatingCashFlow: 125_000_000_000,
            freeCashFlow: 100_000_000_000,
            roe: 1.1,
            roa: 0.29,
            debtToEquity: 0.9,
          },
          {
            date: '2024-12-31',
            period: 'FY',
            source: 'yahoo',
            filedAt: null,
            fiscalYear: 2024,
            fiscalPeriod: 'FY',
            revenue: 390_000_000_000,
            costOfRevenue: 185_000_000_000,
            grossProfit: 205_000_000_000,
            grossProfitRatio: 0.525,
            operatingIncome: 135_000_000_000,
            netIncome: 95_000_000_000,
            netIncomeRatio: 0.243,
            eps: 6.1,
            epsDiluted: 6,
            ebitda: 145_000_000_000,
            totalAssets: 370_000_000_000,
            totalLiabilities: 285_000_000_000,
            totalEquity: 85_000_000_000,
            totalDebt: 100_000_000_000,
            cashAndEquivalents: 45_000_000_000,
            currentAssets: 140_000_000_000,
            currentLiabilities: 102_000_000_000,
            sharesOutstandingPeriod: 15_200_000_000,
            operatingCashFlow: 110_000_000_000,
            freeCashFlow: 85_000_000_000,
            roe: 1.12,
            roa: 0.26,
            debtToEquity: 1.17,
          },
        ],
        sourceSummary: ['yahoo'],
      },
      history: baseHistory,
      earnings: {
        nextEarningsDate: '2026-04-30',
        earningsHistory: [
          { date: '2025-12-31', epsEstimate: 2.5, epsActual: 2.8, epsSurprise: 0.3, epsSurprisePercent: 12 },
          { date: '2025-09-30', epsEstimate: 2.1, epsActual: 2.2, epsSurprise: 0.1, epsSurprisePercent: 4.8 },
        ],
      },
      insiders: {
        transactions: [],
        netBuying: 10_000,
        buyCount: 2,
        sellCount: 0,
      },
      recommendations: [
        { period: '0m', strongBuy: 10, buy: 20, hold: 5, sell: 1, strongSell: 0 },
      ],
    })

    expect(score.overall).not.toBeNull()
    expect((score.overall || 0) >= 60).toBe(true)
    expect(['Atractiva', 'Muy atractiva']).toContain(score.rating)
    expect(score.pillars.quality.score).not.toBeNull()
    expect(score.pillars.momentum.score).not.toBeNull()
  })
})
