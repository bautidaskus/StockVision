/**
 * Calculate technical indicators from price data locally.
 * Eliminates the need for 5 separate Alpha Vantage API calls.
 */

import type { OHLCV, TechnicalIndicators } from './types'
import { normalizeOhlcvSeries } from './time-series'

export function calculateIndicators(prices: OHLCV[]): TechnicalIndicators {
  const normalized = normalizeOhlcvSeries(prices)

  if (normalized.length < 2) {
    return { rsi: [], macd: [], sma20: [], sma50: [], sma200: [] }
  }

  // Prices should be sorted chronologically (oldest first)
  const sorted = normalized
  const closes = sorted.map((p) => p.close)
  const dates = sorted.map((p) => p.date)

  return {
    rsi: calculateRSI(closes, dates, 14),
    macd: calculateMACD(closes, dates),
    sma20: calculateSMA(closes, dates, 20),
    sma50: calculateSMA(closes, dates, 50),
    sma200: calculateSMA(closes, dates, 200),
  }
}

function calculateSMA(
  closes: number[],
  dates: string[],
  period: number,
): Array<{ date: string; value: number }> {
  const result: Array<{ date: string; value: number }> = []

  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += closes[j]
    }
    result.push({ date: dates[i], value: sum / period })
  }

  return result
}

function calculateRSI(
  closes: number[],
  dates: string[],
  period: number,
): Array<{ date: string; value: number }> {
  if (closes.length < period + 1) return []

  const result: Array<{ date: string; value: number }> = []
  const changes: number[] = []

  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1])
  }

  // Initial average gain/loss
  let avgGain = 0
  let avgLoss = 0
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i]
    else avgLoss += Math.abs(changes[i])
  }
  avgGain /= period
  avgLoss /= period

  // First RSI value
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
  const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs)
  result.push({ date: dates[period], value: rsi })

  // Subsequent RSI values using smoothed averages
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    const currentRs = avgLoss === 0 ? 100 : avgGain / avgLoss
    const currentRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + currentRs)
    result.push({ date: dates[i + 1], value: currentRsi })
  }

  return result
}

function calculateMACD(
  closes: number[],
  dates: string[],
): Array<{ date: string; macd: number; signal: number; histogram: number }> {
  if (closes.length < 26) return []

  const ema12 = calculateEMA(closes, 12)
  const ema26 = calculateEMA(closes, 26)

  // MACD line = EMA12 - EMA26 (starts at index 25 where both EMAs exist)
  const macdLine: number[] = []
  const macdStartIndex = 25 // ema26 starts at index 25

  for (let i = macdStartIndex; i < closes.length; i++) {
    macdLine.push(ema12[i] - ema26[i])
  }

  // Signal line = 9-EMA of MACD line
  const signalLine = calculateEMA(macdLine, 9)

  const result: Array<{ date: string; macd: number; signal: number; histogram: number }> = []
  const signalStartIndex = 8 // signal starts at index 8 of macdLine

  for (let i = signalStartIndex; i < macdLine.length; i++) {
    const dateIndex = macdStartIndex + i
    if (dateIndex < dates.length) {
      result.push({
        date: dates[dateIndex],
        macd: macdLine[i],
        signal: signalLine[i],
        histogram: macdLine[i] - signalLine[i],
      })
    }
  }

  return result
}

function calculateEMA(data: number[], period: number): number[] {
  const ema: number[] = new Array(data.length).fill(0)
  const multiplier = 2 / (period + 1)

  // Start with SMA for first EMA value
  let sum = 0
  for (let i = 0; i < period; i++) {
    sum += data[i]
  }
  ema[period - 1] = sum / period

  // Calculate EMA for rest
  for (let i = period; i < data.length; i++) {
    ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1]
  }

  return ema
}
