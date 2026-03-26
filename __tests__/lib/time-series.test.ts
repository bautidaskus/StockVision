import { describe, expect, it } from 'vitest'
import { calculateIndicators } from '@/lib/indicators'
import { dedupeByDateAsc, normalizeTechnicalIndicators } from '@/lib/time-series'
import type { TechnicalIndicators } from '@/lib/types'

describe('dedupeByDateAsc', () => {
  it('sorts ascending and keeps the latest duplicate for each date', () => {
    const result = dedupeByDateAsc([
      { date: '2026-03-03', value: 3 },
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-02', value: 2 },
      { date: '2026-03-02', value: 22 },
    ])

    expect(result).toEqual([
      { date: '2026-03-01', value: 1 },
      { date: '2026-03-02', value: 22 },
      { date: '2026-03-03', value: 3 },
    ])
  })
})

describe('normalizeTechnicalIndicators', () => {
  it('removes duplicate dates from indicator series', () => {
    const indicators: TechnicalIndicators = {
      rsi: [
        { date: '2026-03-01', value: 40 },
        { date: '2026-03-01', value: 41 },
      ],
      macd: [
        { date: '2026-03-02', macd: 1, signal: 0.8, histogram: 0.2 },
        { date: '2026-03-02', macd: 1.2, signal: 0.9, histogram: 0.3 },
      ],
      sma20: [
        { date: '2026-03-03', value: 100 },
        { date: '2026-03-03', value: 101 },
      ],
      sma50: [],
      sma200: [],
    }

    const result = normalizeTechnicalIndicators(indicators)

    expect(result.rsi).toEqual([{ date: '2026-03-01', value: 41 }])
    expect(result.macd).toEqual([{ date: '2026-03-02', macd: 1.2, signal: 0.9, histogram: 0.3 }])
    expect(result.sma20).toEqual([{ date: '2026-03-03', value: 101 }])
  })
})

describe('calculateIndicators', () => {
  it('does not propagate duplicate OHLCV dates into calculated series', () => {
    const prices = Array.from({ length: 35 }, (_, index) => {
      const day = String(index + 1).padStart(2, '0')
      return {
        date: `2026-01-${day}`,
        open: 100 + index,
        high: 101 + index,
        low: 99 + index,
        close: 100 + index,
        volume: 1000 + index,
      }
    })

    prices.splice(20, 0, {
      date: '2026-01-21',
      open: 999,
      high: 1000,
      low: 998,
      close: 999,
      volume: 9999,
    })

    const result = calculateIndicators(prices)

    const sma20Dates = result.sma20.map((point) => point.date)
    const uniqueDates = new Set(sma20Dates)

    expect(uniqueDates.size).toBe(sma20Dates.length)
    expect(result.sma20[0]?.date).toBe('2026-01-20')
  })
})
