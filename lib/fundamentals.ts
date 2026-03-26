import { getSecFinancials } from '@/lib/apis/sec'
import { getYahooFinancials } from '@/lib/apis/yahoo'
import type { FinancialStatement } from '@/lib/types'

const CORE_FIELDS: Array<keyof FinancialStatement> = [
  'revenue',
  'netIncome',
  'totalAssets',
  'totalLiabilities',
  'totalEquity',
  'operatingCashFlow',
  'epsDiluted',
]

type FinancialsResult = {
  statements: FinancialStatement[]
  sourceSummary: Array<'yahoo' | 'sec' | 'merged'>
}

function hasMaterialMissingFields(statements: FinancialStatement[]) {
  if (statements.length === 0) return true

  const recent = statements.slice(0, Math.min(4, statements.length))
  let missing = 0

  for (const statement of recent) {
    for (const field of CORE_FIELDS) {
      if (statement[field] == null) missing += 1
    }
  }

  return missing >= Math.max(3, recent.length * 2)
}

function mergeStatement(primary?: FinancialStatement, fallback?: FinancialStatement): FinancialStatement | null {
  if (!primary && !fallback) return null
  if (!primary) return fallback || null
  if (!fallback) return primary

  const merged: FinancialStatement = {
    ...primary,
    source: primary.source === 'sec' || fallback.source === 'sec' ? 'merged' : primary.source,
    filedAt: primary.filedAt || fallback.filedAt || null,
    fiscalYear: primary.fiscalYear ?? fallback.fiscalYear ?? null,
    fiscalPeriod: primary.fiscalPeriod ?? fallback.fiscalPeriod ?? null,
  }

  const mutable = merged as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(fallback)) {
    if (mutable[key] == null && value != null) {
      mutable[key] = value
    }
  }

  if (merged.totalDebt == null) {
    merged.totalDebt = fallback.totalDebt ?? null
  }

  if (merged.freeCashFlow == null && merged.operatingCashFlow != null && fallback.freeCashFlow != null) {
    merged.freeCashFlow = fallback.freeCashFlow
  }

  return merged
}

function sortStatements(statements: FinancialStatement[]) {
  return [...statements].sort((a, b) => b.date.localeCompare(a.date))
}

export async function getNormalizedFinancials(
  ticker: string,
  period: 'quarterly' | 'annual' = 'quarterly',
  limit = 8,
): Promise<FinancialsResult> {
  const yahoo = await getYahooFinancials(ticker, period, limit).catch(() => ({ statements: [] as FinancialStatement[] }))

  let sec = { statements: [] as FinancialStatement[] }
  if (hasMaterialMissingFields(yahoo.statements)) {
    sec = await getSecFinancials(ticker, period, limit).catch(() => ({ statements: [] as FinancialStatement[] }))
  }

  const byDate = new Map<string, FinancialStatement>()

  for (const statement of sec.statements) byDate.set(statement.date, statement)
  for (const statement of yahoo.statements) {
    byDate.set(statement.date, mergeStatement(statement, byDate.get(statement.date) || undefined) || statement)
  }

  // If Yahoo had nothing for a date SEC knows about, keep the SEC statement.
  for (const statement of sec.statements) {
    if (!byDate.has(statement.date)) byDate.set(statement.date, statement)
  }

  const merged = sortStatements(Array.from(byDate.values())).slice(0, limit)

  const sourceSummary = new Set<'yahoo' | 'sec' | 'merged'>()
  for (const statement of merged) {
    sourceSummary.add(statement.source || 'yahoo')
  }

  return {
    statements: merged,
    sourceSummary: Array.from(sourceSummary),
  }
}
