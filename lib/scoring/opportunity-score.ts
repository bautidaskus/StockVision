import { getYahooEarnings, getYahooHistory, getYahooInsiders, getYahooQuote, getYahooRecommendationTrend } from '@/lib/apis/yahoo'
import { getNormalizedFinancials } from '@/lib/fundamentals'
import type { FinancialStatement, OpportunityRating, OpportunityScore, ScorePillar, ScoreSignal } from '@/lib/types'

export interface OpportunityScoreContext {
  overview: Awaited<ReturnType<typeof getYahooQuote>>
  quarterlyFinancials: Awaited<ReturnType<typeof getNormalizedFinancials>>
  annualFinancials: Awaited<ReturnType<typeof getNormalizedFinancials>>
  history: Awaited<ReturnType<typeof getYahooHistory>>
  earnings: Awaited<ReturnType<typeof getYahooEarnings>>
  insiders: Awaited<ReturnType<typeof getYahooInsiders>>
  recommendations: Awaited<ReturnType<typeof getYahooRecommendationTrend>>
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value))
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value))
  if (valid.length === 0) return null
  return valid.reduce((sum, value) => sum + value, 0) / valid.length
}

function pillar(score: number | null, weight: number, confidence: number, signals: ScoreSignal[]): ScorePillar {
  return {
    score: score != null ? Math.round(score) : null,
    weight,
    confidence: Math.round(confidence),
    signals,
  }
}

function formatPct(value: number) {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function formatNum(value: number) {
  return value.toFixed(2)
}

function scoreInverse(value: number, thresholds: [number, number, number], scores: [number, number, number, number]) {
  if (value <= thresholds[0]) return scores[0]
  if (value <= thresholds[1]) return scores[1]
  if (value <= thresholds[2]) return scores[2]
  return scores[3]
}

function scoreDirect(value: number, thresholds: [number, number, number], scores: [number, number, number, number]) {
  if (value >= thresholds[2]) return scores[0]
  if (value >= thresholds[1]) return scores[1]
  if (value >= thresholds[0]) return scores[2]
  return scores[3]
}

function getYearOverYearGrowth(current?: FinancialStatement, previous?: FinancialStatement, field: keyof FinancialStatement = 'revenue') {
  const curr = current?.[field]
  const prev = previous?.[field]
  if (typeof curr !== 'number' || typeof prev !== 'number' || prev === 0) return null
  return (curr - prev) / Math.abs(prev)
}

function getSignal(label: string, value: string, impact: ScoreSignal['impact']): ScoreSignal {
  return { label, value, impact }
}

function computeValuationScore(input: {
  pe: number | null
  forwardPe: number | null
  evToEbitda: number | null
  priceToSales: number | null
  priceToBook: number | null
  marketCap: number
  annual?: FinancialStatement
}) {
  const signals: ScoreSignal[] = []
  const components: number[] = []

  if (input.pe != null && input.pe > 0) {
    const score = scoreInverse(input.pe, [15, 25, 40], [85, 65, 45, 20])
    components.push(score)
    signals.push(getSignal('P/E', formatNum(input.pe), score >= 65 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  if (input.forwardPe != null && input.forwardPe > 0) {
    const score = scoreInverse(input.forwardPe, [14, 22, 35], [85, 68, 45, 20])
    components.push(score)
    signals.push(getSignal('Forward P/E', formatNum(input.forwardPe), score >= 65 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  if (input.evToEbitda != null && input.evToEbitda > 0) {
    const score = scoreInverse(input.evToEbitda, [10, 16, 24], [82, 64, 45, 20])
    components.push(score)
    signals.push(getSignal('EV/EBITDA', formatNum(input.evToEbitda), score >= 64 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  if (input.priceToSales != null && input.priceToSales > 0) {
    const score = scoreInverse(input.priceToSales, [2, 5, 10], [78, 60, 42, 22])
    components.push(score)
    signals.push(getSignal('P/S', formatNum(input.priceToSales), score >= 60 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  if (input.priceToBook != null && input.priceToBook > 0) {
    const score = scoreInverse(input.priceToBook, [2, 5, 10], [76, 58, 42, 18])
    components.push(score)
    signals.push(getSignal('P/B', formatNum(input.priceToBook), score >= 58 ? 'positive' : score <= 25 ? 'negative' : 'neutral'))
  }

  if (input.annual?.freeCashFlow != null && input.marketCap > 0) {
    const fcfYield = input.annual.freeCashFlow / input.marketCap
    const score = scoreDirect(fcfYield, [0.02, 0.05, 0.08], [88, 72, 55, 25])
    components.push(score)
    signals.push(getSignal('FCF Yield', formatPct(fcfYield), score >= 70 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  return pillar(average(components), components.length > 0 ? (components.length / 6) * 100 : 0, components.length > 0 ? (components.length / 6) * 100 : 0, signals)
}

function computePiotroskiScore(latest?: FinancialStatement, previous?: FinancialStatement) {
  const checks: Array<boolean | null> = []
  if (!latest || !previous) return null

  checks.push(
    typeof latest.netIncome === 'number' && latest.netIncome > 0,
    typeof latest.operatingCashFlow === 'number' && latest.operatingCashFlow > 0,
    typeof latest.roa === 'number' && latest.roa > 0,
    typeof latest.operatingCashFlow === 'number' && typeof latest.netIncome === 'number' ? latest.operatingCashFlow > latest.netIncome : null,
    typeof latest.debtToEquity === 'number' && typeof previous.debtToEquity === 'number' ? latest.debtToEquity < previous.debtToEquity : null,
    typeof latest.currentAssets === 'number' && typeof latest.currentLiabilities === 'number' &&
      typeof previous.currentAssets === 'number' && typeof previous.currentLiabilities === 'number' &&
      latest.currentLiabilities !== 0 && previous.currentLiabilities !== 0
      ? (latest.currentAssets / latest.currentLiabilities) > (previous.currentAssets / previous.currentLiabilities)
      : null,
    typeof latest.sharesOutstandingPeriod === 'number' && typeof previous.sharesOutstandingPeriod === 'number'
      ? latest.sharesOutstandingPeriod <= previous.sharesOutstandingPeriod
      : null,
    typeof latest.grossProfitRatio === 'number' && typeof previous.grossProfitRatio === 'number'
      ? latest.grossProfitRatio > previous.grossProfitRatio
      : null,
    typeof latest.revenue === 'number' && typeof latest.totalAssets === 'number' &&
      typeof previous.revenue === 'number' && typeof previous.totalAssets === 'number' &&
      latest.totalAssets !== 0 && previous.totalAssets !== 0
      ? (latest.revenue / latest.totalAssets) > (previous.revenue / previous.totalAssets)
      : null,
  )

  const valid = checks.filter((value): value is boolean => value !== null)
  if (valid.length === 0) return null

  const positives = valid.filter(Boolean).length
  return {
    positives,
    total: valid.length,
    score: (positives / valid.length) * 100,
  }
}

function computeQualityScore(annual: FinancialStatement[]) {
  const latest = annual[0]
  const previous = annual[1]
  const signals: ScoreSignal[] = []
  const components: number[] = []

  if (latest?.roe != null) {
    const score = scoreDirect(latest.roe, [0.05, 0.12, 0.2], [88, 74, 56, 20])
    components.push(score)
    signals.push(getSignal('ROE', formatPct(latest.roe), score >= 70 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  if (latest?.netIncomeRatio != null) {
    const score = scoreDirect(latest.netIncomeRatio, [0.05, 0.1, 0.2], [84, 70, 55, 18])
    components.push(score)
    signals.push(getSignal('Margen neto', formatPct(latest.netIncomeRatio), score >= 70 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  if (latest?.debtToEquity != null) {
    const score = scoreInverse(latest.debtToEquity, [0.5, 1, 2], [86, 70, 48, 18])
    components.push(score)
    signals.push(getSignal('Deuda/Capital', formatNum(latest.debtToEquity), score >= 70 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  if (latest?.freeCashFlow != null && latest?.revenue != null && latest.revenue !== 0) {
    const fcfMargin = latest.freeCashFlow / latest.revenue
    const score = scoreDirect(fcfMargin, [0.03, 0.08, 0.15], [86, 72, 55, 20])
    components.push(score)
    signals.push(getSignal('FCF margin', formatPct(fcfMargin), score >= 70 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  const revenueGrowth = getYearOverYearGrowth(latest, previous, 'revenue')
  if (revenueGrowth != null) {
    const score = scoreDirect(revenueGrowth, [0, 0.05, 0.12], [84, 70, 55, 22])
    components.push(score)
    signals.push(getSignal('Revenue YoY', formatPct(revenueGrowth), score >= 70 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  const piotroski = computePiotroskiScore(latest, previous)
  if (piotroski) {
    components.push(piotroski.score)
    signals.push(getSignal('Piotroski', `${piotroski.positives}/${piotroski.total}`, piotroski.score >= 70 ? 'positive' : piotroski.score <= 35 ? 'negative' : 'neutral'))
  }

  return pillar(average(components), components.length > 0 ? (components.length / 6) * 100 : 0, components.length > 0 ? (components.length / 6) * 100 : 0, signals)
}

function simpleMovingAverage(values: number[], period: number) {
  if (values.length < period) return null
  const slice = values.slice(-period)
  return slice.reduce((sum, value) => sum + value, 0) / period
}

function computeMomentumScore(history: Array<{ close: number }>, price: number, week52High: number) {
  const closes = history.map((point) => point.close)
  const signals: ScoreSignal[] = []
  const components: number[] = []

  const close6m = closes.length > 126 ? closes[closes.length - 126] : null
  const close12m = closes.length > 252 ? closes[closes.length - 252] : null
  const ret6 = close6m ? (price / close6m) - 1 : null
  const ret12 = close12m ? (price / close12m) - 1 : null
  const sma50 = simpleMovingAverage(closes, 50)
  const sma200 = simpleMovingAverage(closes, 200)

  if (ret6 != null) {
    const score = scoreDirect(ret6, [0, 0.05, 0.15], [84, 70, 55, 18])
    components.push(score)
    signals.push(getSignal('Retorno 6M', formatPct(ret6), score >= 70 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  if (ret12 != null) {
    const score = scoreDirect(ret12, [0, 0.1, 0.2], [88, 72, 55, 18])
    components.push(score)
    signals.push(getSignal('Retorno 12M', formatPct(ret12), score >= 70 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  if (sma200 != null) {
    const above200 = price > sma200
    components.push(above200 ? 75 : 28)
    signals.push(getSignal('Precio vs SMA200', above200 ? 'Arriba' : 'Abajo', above200 ? 'positive' : 'negative'))
  }

  if (sma50 != null && sma200 != null) {
    const golden = sma50 > sma200
    components.push(golden ? 72 : 32)
    signals.push(getSignal('SMA50 vs SMA200', golden ? 'Alcista' : 'Débil', golden ? 'positive' : 'negative'))
  }

  if (week52High > 0) {
    const distance = (price / week52High) - 1
    const score = distance >= -0.1 ? 72 : distance >= -0.25 ? 58 : distance >= -0.4 ? 40 : 18
    components.push(score)
    signals.push(getSignal('Distancia 52W high', formatPct(distance), score >= 65 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))
  }

  return pillar(average(components), components.length > 0 ? (components.length / 5) * 100 : 0, components.length > 0 ? (components.length / 5) * 100 : 0, signals)
}

function computeConsensusScore(recommendations: Awaited<ReturnType<typeof getYahooRecommendationTrend>>) {
  const latest = recommendations[0]
  if (!latest) return null
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell
  if (total === 0) return null
  const weighted = latest.strongBuy * 5 + latest.buy * 4 + latest.hold * 3 + latest.sell * 2 + latest.strongSell
  return ((weighted / total) - 1) / 4 * 100
}

function computeEventsScore(input: {
  earningsHistory: Array<{ epsEstimate: number | null; epsActual: number | null; epsSurprisePercent: number | null }>
  recommendations: Awaited<ReturnType<typeof getYahooRecommendationTrend>>
  insiders: Awaited<ReturnType<typeof getYahooInsiders>>
}) {
  const signals: ScoreSignal[] = []
  const components: number[] = []

  const recentEarnings = input.earningsHistory.slice(0, 4)
  if (recentEarnings.length > 0) {
    const beatCount = recentEarnings.filter((item) =>
      item.epsActual != null &&
      item.epsEstimate != null &&
      item.epsActual >= item.epsEstimate
    ).length
    const beatRate = beatCount / recentEarnings.length
    const avgSurprise = average(recentEarnings.map((item) => item.epsSurprisePercent))

    const score = clamp((beatRate * 70) + ((avgSurprise || 0) * 1.5) + 20)
    components.push(score)
    signals.push(getSignal('Earnings beats', `${beatCount}/${recentEarnings.length}`, score >= 70 ? 'positive' : score <= 30 ? 'negative' : 'neutral'))

    if (avgSurprise != null) {
      signals.push(getSignal('Sorpresa promedio', `${avgSurprise >= 0 ? '+' : ''}${avgSurprise.toFixed(1)}%`, avgSurprise > 0 ? 'positive' : avgSurprise < 0 ? 'negative' : 'neutral'))
    }
  }

  const consensusScore = computeConsensusScore(input.recommendations)
  if (consensusScore != null) {
    components.push(consensusScore)
    signals.push(getSignal('Consenso analistas', `${Math.round(consensusScore)}/100`, consensusScore >= 65 ? 'positive' : consensusScore <= 35 ? 'negative' : 'neutral'))
  }

  const insiderActivityCount = input.insiders.buyCount + input.insiders.sellCount
  if (insiderActivityCount > 0) {
    const score = input.insiders.netBuying > 0 ? 72 : input.insiders.netBuying < 0 ? 28 : 50
    components.push(score)
    signals.push(getSignal('Actividad insider', `${input.insiders.buyCount} compras / ${input.insiders.sellCount} ventas`, score >= 65 ? 'positive' : score <= 35 ? 'negative' : 'neutral'))
  }

  return pillar(average(components), components.length > 0 ? (components.length / 3) * 100 : 0, components.length > 0 ? (components.length / 3) * 100 : 0, signals)
}

function getRating(score: number | null): OpportunityRating {
  if (score == null) return 'Sin datos'
  if (score >= 75) return 'Muy atractiva'
  if (score >= 60) return 'Atractiva'
  if (score >= 45) return 'Neutral'
  if (score >= 30) return 'Débil'
  return 'Evitar'
}

function buildSummary(pillars: OpportunityScore['pillars']) {
  return Object.values(pillars)
    .flatMap((pillar) => pillar.signals)
    .filter((signal) => signal.impact !== 'neutral')
    .slice(0, 4)
    .map((signal) => `${signal.label}: ${signal.value}`)
}

export async function buildOpportunityScore(ticker: string): Promise<OpportunityScore> {
  const normalizedTicker = ticker.toUpperCase()

  const context: OpportunityScoreContext = await Promise.all([
    getYahooQuote(normalizedTicker),
    getNormalizedFinancials(normalizedTicker, 'quarterly', 8).catch(() => ({ statements: [], sourceSummary: [] as Array<'yahoo' | 'sec' | 'merged'> })),
    getNormalizedFinancials(normalizedTicker, 'annual', 4).catch(() => ({ statements: [], sourceSummary: [] as Array<'yahoo' | 'sec' | 'merged'> })),
    getYahooHistory(normalizedTicker, 3).catch(() => []),
    getYahooEarnings(normalizedTicker).catch(() => ({ nextEarningsDate: null, earningsHistory: [] })),
    getYahooInsiders(normalizedTicker).catch(() => ({ transactions: [], netBuying: 0, buyCount: 0, sellCount: 0 })),
    getYahooRecommendationTrend(normalizedTicker).catch(() => []),
  ]).then(([overview, quarterlyFinancials, annualFinancials, history, earnings, insiders, recommendations]) => ({
    overview,
    quarterlyFinancials,
    annualFinancials,
    history,
    earnings,
    insiders,
    recommendations,
  }))

  return buildOpportunityScoreFromContext(normalizedTicker, context)
}

export function buildOpportunityScoreFromContext(
  ticker: string,
  {
    overview,
    quarterlyFinancials,
    annualFinancials,
    history,
    earnings,
    insiders,
    recommendations,
  }: OpportunityScoreContext,
): OpportunityScore {
  const normalizedTicker = ticker.toUpperCase()

  const annual = annualFinancials.statements
  const valuation = computeValuationScore({
    pe: overview.pe,
    forwardPe: overview.forwardPe,
    evToEbitda: overview.enterpriseToEbitda ?? null,
    priceToSales: overview.priceToSales ?? null,
    priceToBook: overview.priceToBook ?? null,
    marketCap: overview.marketCap || 0,
    annual: annual[0],
  })
  const quality = computeQualityScore(annual)
  const momentum = computeMomentumScore(history, overview.price || 0, overview.week52High || 0)
  const events = computeEventsScore({
    earningsHistory: earnings.earningsHistory,
    recommendations,
    insiders,
  })

  const weightedPillars = [
    { score: valuation.score, weight: valuation.weight ? 30 : 0 },
    { score: quality.score, weight: quality.weight ? 30 : 0 },
    { score: momentum.score, weight: momentum.weight ? 25 : 0 },
    { score: events.score, weight: events.weight ? 15 : 0 },
  ].filter((pillar) => pillar.score != null && pillar.weight > 0)

  const totalWeight = weightedPillars.reduce((sum, pillar) => sum + pillar.weight, 0)
  const overall = totalWeight > 0
    ? weightedPillars.reduce((sum, pillar) => sum + (pillar.score as number) * pillar.weight, 0) / totalWeight
    : null

  const confidence = average([valuation.confidence, quality.confidence, momentum.confidence, events.confidence]) || 0

  const result: OpportunityScore = {
    ticker: normalizedTicker,
    name: overview.name || normalizedTicker,
    overall: overall != null ? Math.round(overall) : null,
    rating: getRating(overall),
    confidence: Math.round(confidence),
    asOfDate: new Date().toISOString().split('T')[0],
    summary: buildSummary({ valuation, quality, momentum, events }),
    pillars: {
      valuation: { ...valuation, weight: 30 },
      quality: { ...quality, weight: 30 },
      momentum: { ...momentum, weight: 25 },
      events: { ...events, weight: 15 },
    },
  }

  // Use quarterly statements to enrich the summary when the annual set is thin.
  if (result.summary.length === 0 && quarterlyFinancials.statements[0]?.netIncomeRatio != null) {
    result.summary.push(`Margen neto reciente: ${formatPct(quarterlyFinancials.statements[0].netIncomeRatio)}`)
  }

  return result
}
