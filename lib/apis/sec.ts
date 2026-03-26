import type { FinancialStatement } from '@/lib/types'

const SEC_HEADERS = {
  'User-Agent': 'StockVision support@stockvision.local',
  Accept: 'application/json',
}

type SecTickerExchangePayload = {
  fields?: string[]
  data?: Array<[number, string, string, string | null]>
}

type SecFact = {
  start?: string
  end: string
  val: number
  filed?: string
  fy?: number
  fp?: string
  form?: string
  frame?: string
  accn?: string
}

type SecCompanyFacts = {
  cik?: number
  entityName?: string
  facts?: Record<string, Record<string, { units?: Record<string, SecFact[]> }>>
}

type MetricSelector = {
  taxonomy: 'us-gaap' | 'dei'
  tag: string
  units: string[]
}

type MetricSpec = {
  kind: 'duration' | 'instant'
  selectors: MetricSelector[]
}

type UniverseEntry = {
  cik: number
  ticker: string
  name: string
  exchange: string
}

const METRICS: Record<string, MetricSpec> = {
  revenue: {
    kind: 'duration',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'RevenueFromContractWithCustomerExcludingAssessedTax', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'SalesRevenueNet', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'Revenues', units: ['USD'] },
    ],
  },
  costOfRevenue: {
    kind: 'duration',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'CostOfGoodsSold', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'CostOfSales', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'CostOfRevenue', units: ['USD'] },
    ],
  },
  grossProfit: {
    kind: 'duration',
    selectors: [{ taxonomy: 'us-gaap', tag: 'GrossProfit', units: ['USD'] }],
  },
  operatingIncome: {
    kind: 'duration',
    selectors: [{ taxonomy: 'us-gaap', tag: 'OperatingIncomeLoss', units: ['USD'] }],
  },
  netIncome: {
    kind: 'duration',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'NetIncomeLoss', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'ProfitLoss', units: ['USD'] },
    ],
  },
  eps: {
    kind: 'duration',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'EarningsPerShareBasic', units: ['USD/shares', 'pure'] },
      { taxonomy: 'us-gaap', tag: 'EarningsPerShareBasicAndDiluted', units: ['USD/shares', 'pure'] },
    ],
  },
  epsDiluted: {
    kind: 'duration',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'EarningsPerShareDiluted', units: ['USD/shares', 'pure'] },
      { taxonomy: 'us-gaap', tag: 'EarningsPerShareBasicAndDiluted', units: ['USD/shares', 'pure'] },
    ],
  },
  operatingCashFlow: {
    kind: 'duration',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'NetCashProvidedByUsedInOperatingActivities', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations', units: ['USD'] },
    ],
  },
  capitalExpenditure: {
    kind: 'duration',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'PaymentsToAcquirePropertyPlantAndEquipment', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'PropertyPlantAndEquipmentAdditions', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'CapitalExpendituresIncurredButNotYetPaid', units: ['USD'] },
    ],
  },
  totalAssets: {
    kind: 'instant',
    selectors: [{ taxonomy: 'us-gaap', tag: 'Assets', units: ['USD'] }],
  },
  totalLiabilities: {
    kind: 'instant',
    selectors: [{ taxonomy: 'us-gaap', tag: 'Liabilities', units: ['USD'] }],
  },
  totalEquity: {
    kind: 'instant',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'StockholdersEquity', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest', units: ['USD'] },
    ],
  },
  cashAndEquivalents: {
    kind: 'instant',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'CashAndCashEquivalentsAtCarryingValue', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', units: ['USD'] },
    ],
  },
  currentAssets: {
    kind: 'instant',
    selectors: [{ taxonomy: 'us-gaap', tag: 'AssetsCurrent', units: ['USD'] }],
  },
  currentLiabilities: {
    kind: 'instant',
    selectors: [{ taxonomy: 'us-gaap', tag: 'LiabilitiesCurrent', units: ['USD'] }],
  },
  currentDebt: {
    kind: 'instant',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'LongTermDebtCurrent', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'LongTermDebtAndCapitalLeaseObligationsCurrent', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'LongTermDebtAndFinanceLeaseObligationsCurrent', units: ['USD'] },
    ],
  },
  longTermDebt: {
    kind: 'instant',
    selectors: [
      { taxonomy: 'us-gaap', tag: 'LongTermDebtNoncurrent', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'LongTermDebtAndCapitalLeaseObligations', units: ['USD'] },
      { taxonomy: 'us-gaap', tag: 'LongTermDebtAndFinanceLeaseObligationsNoncurrent', units: ['USD'] },
    ],
  },
  sharesOutstandingPeriod: {
    kind: 'instant',
    selectors: [{ taxonomy: 'dei', tag: 'EntityCommonStockSharesOutstanding', units: ['shares'] }],
  },
}

let universePromise: Promise<UniverseEntry[]> | null = null
const companyFactsCache = new Map<string, Promise<SecCompanyFacts | null>>()

async function fetchSecJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: SEC_HEADERS,
    next: { revalidate: 86400 },
  })
  if (!res.ok) throw new Error(`SEC error: ${res.status}`)
  return res.json()
}

function normalizeDate(value?: string): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toISOString().split('T')[0]
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function diffDays(start?: string, end?: string): number | null {
  if (!start || !end) return null
  const startDate = new Date(start)
  const endDate = new Date(end)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000)
}

function factFiledAt(fact: SecFact): string {
  return normalizeDate(fact.filed || fact.end)
}

function isQuarterlyDurationFact(fact: SecFact) {
  const days = diffDays(fact.start, fact.end)
  const frame = fact.frame || ''
  if (/Q[1-4]$/.test(frame)) return true
  if (fact.form?.startsWith('10-Q') && days != null) return days >= 70 && days <= 110
  return false
}

function isAnnualDurationFact(fact: SecFact) {
  const days = diffDays(fact.start, fact.end)
  const frame = fact.frame || ''
  if (/CY\d{4}$/.test(frame)) return true
  if (fact.form?.startsWith('10-K') && days != null) return days >= 300
  return false
}

function isQuarterlyInstantFact(fact: SecFact) {
  return fact.form?.startsWith('10-Q') || /^Q[1-3]$/.test(fact.fp || '')
}

function isAnnualInstantFact(fact: SecFact) {
  return fact.form?.startsWith('10-K') || fact.fp === 'FY'
}

function collectFacts(companyFacts: SecCompanyFacts, selectors: MetricSelector[]): SecFact[] {
  const out: SecFact[] = []

  for (const selector of selectors) {
    const metric = companyFacts.facts?.[selector.taxonomy]?.[selector.tag]
    if (!metric?.units) continue

    for (const unit of selector.units) {
      const facts = metric.units[unit]
      if (!Array.isArray(facts)) continue
      out.push(...facts)
    }
  }

  return out.filter((fact) => toNumber(fact.val) != null)
}

function selectFactsByEnd(facts: SecFact[], period: 'quarterly' | 'annual', kind: 'duration' | 'instant') {
  const selected = new Map<string, SecFact>()

  for (const fact of facts) {
    const end = normalizeDate(fact.end)
    if (!end) continue

    const matches = kind === 'duration'
      ? (period === 'quarterly' ? isQuarterlyDurationFact(fact) : isAnnualDurationFact(fact))
      : (period === 'quarterly' ? isQuarterlyInstantFact(fact) : isAnnualInstantFact(fact))

    if (!matches) continue

    const current = selected.get(end)
    if (!current || factFiledAt(fact) > factFiledAt(current)) {
      selected.set(end, fact)
    }
  }

  return selected
}

function mergeDateMaps(...maps: Map<string, SecFact>[]) {
  const dates = new Set<string>()
  for (const map of maps) {
    for (const key of Array.from(map.keys())) dates.add(key)
  }
  return Array.from(dates).sort((a, b) => b.localeCompare(a))
}

function shouldExcludeUniverseEntry(entry: UniverseEntry) {
  const title = entry.name.toUpperCase()
  const ticker = entry.ticker.toUpperCase()
  return (
    !/^[A-Z][A-Z.-]{0,6}$/.test(ticker) ||
    ticker.endsWith('W') ||
    ticker.endsWith('U') ||
    ticker.endsWith('R') ||
    title.includes('ETF') ||
    title.includes('TRUST') ||
    title.includes('FUND') ||
    title.includes('ACQUISITION') ||
    title.includes('SPAC') ||
    title.includes('WARRANT') ||
    title.includes('RIGHT')
  )
}

export async function getSecTickerUniverse(limit = 300): Promise<UniverseEntry[]> {
  if (!universePromise) {
    universePromise = fetchSecJson<SecTickerExchangePayload>('https://www.sec.gov/files/company_tickers_exchange.json')
      .then((payload) =>
        (payload.data || [])
          .map(([cik, name, ticker, exchange]) => ({
            cik,
            name,
            ticker,
            exchange: exchange || '',
          }))
          .filter((entry) => ['Nasdaq', 'NYSE', 'NYSE American'].includes(entry.exchange))
          .filter((entry) => !shouldExcludeUniverseEntry(entry))
      )
      .catch(() => [])
  }

  const universe = await universePromise
  return universe.slice(0, limit)
}

export async function getSecCikForTicker(ticker: string): Promise<number | null> {
  const normalizedTicker = ticker.toUpperCase()
  const universe = await getSecTickerUniverse(12000)
  const match = universe.find((entry) => entry.ticker.toUpperCase() === normalizedTicker)
  return match?.cik ?? null
}

export async function getSecCompanyFacts(ticker: string): Promise<SecCompanyFacts | null> {
  const normalizedTicker = ticker.toUpperCase()
  if (!companyFactsCache.has(normalizedTicker)) {
    companyFactsCache.set(
      normalizedTicker,
      (async () => {
        const cik = await getSecCikForTicker(normalizedTicker)
        if (!cik) return null
        const cikPadded = String(cik).padStart(10, '0')
        try {
          return await fetchSecJson<SecCompanyFacts>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cikPadded}.json`)
        } catch {
          return null
        }
      })()
    )
  }

  return companyFactsCache.get(normalizedTicker) || null
}

export async function getSecFinancials(
  ticker: string,
  period: 'quarterly' | 'annual' = 'quarterly',
  limit = 8,
): Promise<{ statements: FinancialStatement[] }> {
  const companyFacts = await getSecCompanyFacts(ticker)
  if (!companyFacts) return { statements: [] }

  const revenueFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.revenue.selectors), period, 'duration')
  const costFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.costOfRevenue.selectors), period, 'duration')
  const grossFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.grossProfit.selectors), period, 'duration')
  const operatingFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.operatingIncome.selectors), period, 'duration')
  const incomeFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.netIncome.selectors), period, 'duration')
  const epsFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.eps.selectors), period, 'duration')
  const dilutedEpsFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.epsDiluted.selectors), period, 'duration')
  const ocfFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.operatingCashFlow.selectors), period, 'duration')
  const capexFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.capitalExpenditure.selectors), period, 'duration')
  const assetsFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.totalAssets.selectors), period, 'instant')
  const liabilitiesFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.totalLiabilities.selectors), period, 'instant')
  const equityFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.totalEquity.selectors), period, 'instant')
  const cashFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.cashAndEquivalents.selectors), period, 'instant')
  const currentAssetsFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.currentAssets.selectors), period, 'instant')
  const currentLiabilitiesFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.currentLiabilities.selectors), period, 'instant')
  const currentDebtFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.currentDebt.selectors), period, 'instant')
  const longDebtFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.longTermDebt.selectors), period, 'instant')
  const sharesFacts = selectFactsByEnd(collectFacts(companyFacts, METRICS.sharesOutstandingPeriod.selectors), period, 'instant')

  const dates = mergeDateMaps(
    revenueFacts,
    incomeFacts,
    assetsFacts,
    liabilitiesFacts,
    equityFacts,
    ocfFacts,
    sharesFacts,
  )

  const statements: FinancialStatement[] = dates.map((date) => {
    const revenue = toNumber(revenueFacts.get(date)?.val)
    const grossProfit = toNumber(grossFacts.get(date)?.val)
    const netIncome = toNumber(incomeFacts.get(date)?.val)
    const totalAssets = toNumber(assetsFacts.get(date)?.val)
    const totalEquity = toNumber(equityFacts.get(date)?.val)
    const currentDebt = toNumber(currentDebtFacts.get(date)?.val)
    const longTermDebt = toNumber(longDebtFacts.get(date)?.val)
    const totalDebt = currentDebt != null || longTermDebt != null
      ? (currentDebt || 0) + (longTermDebt || 0)
      : null

    const latestFiled = [
      revenueFacts.get(date),
      incomeFacts.get(date),
      assetsFacts.get(date),
      liabilitiesFacts.get(date),
      equityFacts.get(date),
      ocfFacts.get(date),
    ]
      .filter(Boolean)
      .map((fact) => factFiledAt(fact as SecFact))
      .sort()
      .at(-1) || null

    const operatingCashFlow = toNumber(ocfFacts.get(date)?.val)
    const capex = toNumber(capexFacts.get(date)?.val)

    return {
      date,
      period: period === 'quarterly' ? 'Q' : 'FY',
      source: 'sec' as const,
      filedAt: latestFiled,
      fiscalYear: revenueFacts.get(date)?.fy ?? assetsFacts.get(date)?.fy ?? null,
      fiscalPeriod: revenueFacts.get(date)?.fp ?? assetsFacts.get(date)?.fp ?? null,
      revenue,
      costOfRevenue: toNumber(costFacts.get(date)?.val),
      grossProfit,
      grossProfitRatio: revenue != null && grossProfit != null && revenue !== 0 ? grossProfit / revenue : null,
      operatingIncome: toNumber(operatingFacts.get(date)?.val),
      netIncome,
      netIncomeRatio: revenue != null && netIncome != null && revenue !== 0 ? netIncome / revenue : null,
      eps: toNumber(epsFacts.get(date)?.val),
      epsDiluted: toNumber(dilutedEpsFacts.get(date)?.val),
      ebitda: null,
      totalAssets,
      totalLiabilities: toNumber(liabilitiesFacts.get(date)?.val),
      totalEquity,
      totalDebt,
      cashAndEquivalents: toNumber(cashFacts.get(date)?.val),
      currentAssets: toNumber(currentAssetsFacts.get(date)?.val),
      currentLiabilities: toNumber(currentLiabilitiesFacts.get(date)?.val),
      sharesOutstandingPeriod: toNumber(sharesFacts.get(date)?.val),
      operatingCashFlow,
      freeCashFlow: operatingCashFlow != null && capex != null ? operatingCashFlow - Math.abs(capex) : operatingCashFlow,
      roe: totalEquity != null && netIncome != null && totalEquity !== 0 ? netIncome / totalEquity : null,
      roa: totalAssets != null && netIncome != null && totalAssets !== 0 ? netIncome / totalAssets : null,
      debtToEquity: totalEquity != null && totalDebt != null && totalEquity !== 0 ? totalDebt / totalEquity : null,
    }
  })
    .filter((statement) => statement.date && (
      statement.revenue != null ||
      statement.totalAssets != null ||
      statement.netIncome != null
    ))
    .slice(0, limit)

  return { statements }
}
