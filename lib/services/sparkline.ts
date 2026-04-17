import type { OHLCV } from '@/lib/types'

const RANGE_DAYS: Record<string, number> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
}

export function pickSparkline(history: OHLCV[], range: string): number[] {
  if (!history.length) return []
  const days = RANGE_DAYS[range] ?? 30
  return history.slice(-days).map((p) => p.close)
}
