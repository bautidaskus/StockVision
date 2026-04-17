import { describe, it, expect } from 'vitest'
import { pickSparkline } from '@/lib/services/sparkline'
import type { OHLCV } from '@/lib/types'

const series: OHLCV[] = Array.from({ length: 300 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
  open: 0,
  high: 0,
  low: 0,
  close: i + 1,
  volume: 0,
}))

describe('pickSparkline', () => {
  it('returns the last 30 closes for range=1m', () => {
    const result = pickSparkline(series, '1m')
    expect(result).toHaveLength(30)
    expect(result[result.length - 1]).toBe(300)
    expect(result[0]).toBe(271)
  })

  it('returns the last 90 closes for range=3m', () => {
    const result = pickSparkline(series, '3m')
    expect(result).toHaveLength(90)
  })

  it('falls back to 30 days for unknown ranges', () => {
    const result = pickSparkline(series, 'bogus')
    expect(result).toHaveLength(30)
  })

  it('returns [] for empty input', () => {
    expect(pickSparkline([], '1m')).toEqual([])
  })

  it('returns all closes when history is shorter than requested range', () => {
    const short = series.slice(0, 10)
    const result = pickSparkline(short, '1m')
    expect(result).toHaveLength(10)
    expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})
