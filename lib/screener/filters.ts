import type { ScreenerFilters } from '@/lib/types'

export const DEFAULT_SCREENER_LIMIT = 100
export const DEFAULT_SCORE_WINDOW = 10
export const MAX_SCORE_WINDOW = 20

function parseNumber(value: string | null) {
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function normalizeScreenerFilters(filters: ScreenerFilters): ScreenerFilters {
  return {
    exchange: filters.exchange || undefined,
    sector: filters.sector || undefined,
    marketCapMin: filters.marketCapMin,
    marketCapMax: filters.marketCapMax,
    peMin: filters.peMin,
    peMax: filters.peMax,
    pbMin: filters.pbMin,
    pbMax: filters.pbMax,
    roeMin: filters.roeMin,
    netMarginMin: filters.netMarginMin,
    betaMin: filters.betaMin,
    betaMax: filters.betaMax,
    debtToEquityMax: filters.debtToEquityMax,
    dividendMin: filters.dividendMin,
    pctFromHighMax: filters.pctFromHighMax,
    limit: filters.limit || DEFAULT_SCREENER_LIMIT,
  }
}

export function parseScreenerFilters(searchParams: URLSearchParams): ScreenerFilters {
  return normalizeScreenerFilters({
    exchange: (searchParams.get('exchange') as ScreenerFilters['exchange']) || undefined,
    sector: searchParams.get('sector') || undefined,
    marketCapMin: parseNumber(searchParams.get('marketCapMin')),
    marketCapMax: parseNumber(searchParams.get('marketCapMax')),
    peMin: parseNumber(searchParams.get('peMin')),
    peMax: parseNumber(searchParams.get('peMax')),
    pbMin: parseNumber(searchParams.get('pbMin')),
    pbMax: parseNumber(searchParams.get('pbMax')),
    roeMin: parseNumber(searchParams.get('roeMin')),
    netMarginMin: parseNumber(searchParams.get('netMarginMin')),
    betaMin: parseNumber(searchParams.get('betaMin')),
    betaMax: parseNumber(searchParams.get('betaMax')),
    debtToEquityMax: parseNumber(searchParams.get('debtToEquityMax')),
    dividendMin: parseNumber(searchParams.get('dividendMin')),
    pctFromHighMax: parseNumber(searchParams.get('pctFromHighMax')),
    limit: parseNumber(searchParams.get('limit')) || DEFAULT_SCREENER_LIMIT,
  })
}

export function parseScoreWindow(searchParams: URLSearchParams) {
  const requested = parseNumber(searchParams.get('scoreWindow')) || 0
  return Math.max(0, Math.min(requested, MAX_SCORE_WINDOW))
}

export function buildScreenerSearchParams(
  filters: ScreenerFilters,
  options?: { scoreWindow?: number },
) {
  const params = new URLSearchParams()
  const normalized = normalizeScreenerFilters(filters)

  if (normalized.exchange) params.set('exchange', normalized.exchange)
  if (normalized.sector) params.set('sector', normalized.sector)
  if (normalized.marketCapMin != null) params.set('marketCapMin', String(normalized.marketCapMin))
  if (normalized.marketCapMax != null) params.set('marketCapMax', String(normalized.marketCapMax))
  if (normalized.peMin != null) params.set('peMin', String(normalized.peMin))
  if (normalized.peMax != null) params.set('peMax', String(normalized.peMax))
  if (normalized.pbMin != null) params.set('pbMin', String(normalized.pbMin))
  if (normalized.pbMax != null) params.set('pbMax', String(normalized.pbMax))
  if (normalized.roeMin != null) params.set('roeMin', String(normalized.roeMin))
  if (normalized.netMarginMin != null) params.set('netMarginMin', String(normalized.netMarginMin))
  if (normalized.betaMin != null) params.set('betaMin', String(normalized.betaMin))
  if (normalized.betaMax != null) params.set('betaMax', String(normalized.betaMax))
  if (normalized.debtToEquityMax != null) params.set('debtToEquityMax', String(normalized.debtToEquityMax))
  if (normalized.dividendMin != null) params.set('dividendMin', String(normalized.dividendMin))
  if (normalized.pctFromHighMax != null) params.set('pctFromHighMax', String(normalized.pctFromHighMax))
  params.set('limit', String(normalized.limit || DEFAULT_SCREENER_LIMIT))

  if (options?.scoreWindow && options.scoreWindow > 0) {
    params.set('scoreWindow', String(Math.min(options.scoreWindow, MAX_SCORE_WINDOW)))
  }

  return params
}

export function buildScreenerQueryString(
  filters: ScreenerFilters,
  options?: { scoreWindow?: number },
) {
  return buildScreenerSearchParams(filters, options).toString()
}
