import { NextRequest, NextResponse } from 'next/server'
import { getIncomeStatement, getBalanceSheet, getCashFlowStatement, getKeyMetrics, getAnalystEstimates, getRatios } from '@/lib/apis/fmp'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const period = (request.nextUrl.searchParams.get('period') || 'quarterly') as 'quarterly' | 'annual'
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '8')
  const key = cacheKey('financials', ticker, period, String(limit))

  try {
    const cached = await getCached(key)
    if (cached) return NextResponse.json(cached)

    const [income, balance, cashFlow, metrics, estimates, ratios] = await Promise.all([
      getIncomeStatement(ticker, period, limit),
      getBalanceSheet(ticker, period, limit),
      getCashFlowStatement(ticker, period, limit),
      getKeyMetrics(ticker, period, limit),
      getAnalystEstimates(ticker).catch(() => []),
      getRatios(ticker, period, 4).catch(() => []),
    ])

    // Merge income, balance, and cash flow into combined statements
    const statements = (income || []).map((inc: Record<string, unknown>, i: number) => {
      const bal = (balance || [])[i] || {}
      const cf = (cashFlow || [])[i] || {}
      const met = (metrics || [])[i] || {}

      return {
        date: inc.date,
        period: inc.period,
        revenue: inc.revenue || 0,
        costOfRevenue: inc.costOfRevenue || 0,
        grossProfit: inc.grossProfit || 0,
        grossProfitRatio: inc.grossProfitRatio || 0,
        operatingIncome: inc.operatingIncome || 0,
        netIncome: inc.netIncome || 0,
        netIncomeRatio: inc.netIncomeRatio || 0,
        eps: inc.eps || 0,
        epsDiluted: inc.epsdiluted || 0,
        ebitda: inc.ebitda || 0,
        totalAssets: bal.totalAssets || 0,
        totalLiabilities: bal.totalLiabilities || 0,
        totalEquity: bal.totalStockholdersEquity || 0,
        totalDebt: bal.totalDebt || 0,
        cashAndEquivalents: bal.cashAndCashEquivalents || 0,
        operatingCashFlow: cf.operatingCashFlow || 0,
        freeCashFlow: cf.freeCashFlow || 0,
        roe: met.roe != null ? met.roe : null,
        roa: met.roa != null ? met.roa : null,
        debtToEquity: met.debtToEquity != null ? met.debtToEquity : null,
      }
    })

    // Format analyst estimates
    const analystData = estimates?.[0]
      ? {
          targetHigh: estimates[0].estimatedRevenueHigh || 0,
          targetLow: estimates[0].estimatedRevenueLow || 0,
          targetMean: estimates[0].estimatedRevenueAvg || 0,
          targetMedian: estimates[0].estimatedRevenueAvg || 0,
          strongBuy: 0,
          buy: 0,
          hold: 0,
          sell: 0,
          strongSell: 0,
        }
      : null

    const result = {
      statements,
      estimates: analystData,
      ratios: ratios || [],
    }

    await setCached(key, result, CACHE_TTL.FINANCIALS)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Financials error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch financials'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
