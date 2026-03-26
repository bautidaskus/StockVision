import type { OHLCV, TechnicalIndicators } from '@/lib/types'

type DatedPoint = {
  date: string
}

export function dedupeByDateAsc<T extends DatedPoint>(items: T[]): T[] {
  const byDate = new Map<string, T>()

  for (const item of items) {
    if (!item?.date) continue
    byDate.set(item.date, item)
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function normalizeOhlcvSeries(prices: OHLCV[]): OHLCV[] {
  return dedupeByDateAsc(prices).filter((price) =>
    Number.isFinite(price.open) &&
    Number.isFinite(price.high) &&
    Number.isFinite(price.low) &&
    Number.isFinite(price.close) &&
    Number.isFinite(price.volume)
  )
}

export function normalizeTechnicalIndicators(indicators: TechnicalIndicators): TechnicalIndicators {
  return {
    rsi: dedupeByDateAsc(indicators.rsi).filter((point) => Number.isFinite(point.value)),
    macd: dedupeByDateAsc(indicators.macd).filter((point) =>
      Number.isFinite(point.macd) &&
      Number.isFinite(point.signal) &&
      Number.isFinite(point.histogram)
    ),
    sma20: dedupeByDateAsc(indicators.sma20).filter((point) => Number.isFinite(point.value)),
    sma50: dedupeByDateAsc(indicators.sma50).filter((point) => Number.isFinite(point.value)),
    sma200: dedupeByDateAsc(indicators.sma200).filter((point) => Number.isFinite(point.value)),
  }
}
