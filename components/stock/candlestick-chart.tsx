'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from '@/components/motion/fade-in'
import { normalizeOhlcvSeries, normalizeTechnicalIndicators } from '@/lib/time-series'
import type { OHLCV, TechnicalIndicators } from '@/lib/types'
import type { ISeriesApi } from 'lightweight-charts'

const TIMEFRAMES = ['1M', '3M', '6M', '1Y', '3Y', '5Y'] as const
const SMA_COLORS = {
  sma20: '#a88438',
  sma50: '#1e4d75',
  sma200: '#9a8b5f',
} as const
type SmaKey = keyof typeof SMA_COLORS

export function CandlestickChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null)
  const rsiChartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const smaSeriesRef = useRef<Partial<Record<SmaKey, ISeriesApi<'Line'>>>>({})
  const [timeframe, setTimeframe] = useState<string>('1Y')
  const [showVolume, setShowVolume] = useState(true)
  const [showSma, setShowSma] = useState<Record<SmaKey, boolean>>({ sma20: false, sma50: false, sma200: false })
  const [chartError, setChartError] = useState<string | null>(null)

  const range = timeframe.toLowerCase()

  const { data: history, isLoading: historyLoading, error: historyError } = useQuery<OHLCV[]>({
    queryKey: ['stock-history', ticker, range],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/history?range=${range}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: indicators, error: indicatorsError } = useQuery<TechnicalIndicators>({
    queryKey: ['stock-indicators', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/indicators`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  // ── Effect A: create chart + candles. Rebuilds only when the price data changes.
  useEffect(() => {
    const currentHistory = history ? normalizeOhlcvSeries(history) : []
    setChartError(null)
    if (!containerRef.current || currentHistory.length === 0) return

    let disposed = false
    let resizeHandler: (() => void) | null = null

    async function initChart() {
      try {
        const { createChart, CandlestickSeries } = await import('lightweight-charts')
        if (disposed || !containerRef.current) return

        if (chartRef.current) {
          chartRef.current.remove()
          chartRef.current = null
        }
        volumeSeriesRef.current = null
        smaSeriesRef.current = {}

        const chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: 400,
          layout: { background: { color: '#ffffff' }, textColor: '#58574f', fontSize: 12 },
          grid: {
            vertLines: { color: '#e6e5df' },
            horzLines: { color: '#e6e5df' },
          },
          crosshair: { mode: 0 },
          rightPriceScale: { borderColor: '#d8d6ce' },
          timeScale: { borderColor: '#d8d6ce', timeVisible: false },
        })
        chartRef.current = chart

        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#2d7a5f',
          downColor: '#b04a3a',
          borderDownColor: '#b04a3a',
          borderUpColor: '#2d7a5f',
          wickDownColor: '#b04a3a',
          wickUpColor: '#2d7a5f',
        })
        candleSeries.setData(
          currentHistory.map((d) => ({
            time: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          }))
        )

        chart.timeScale().fitContent()

        resizeHandler = () => {
          if (containerRef.current && chartRef.current) {
            chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
          }
        }
        window.addEventListener('resize', resizeHandler)
      } catch (error) {
        console.error('Candlestick chart error:', error)
        if (!disposed) setChartError('No se pudo renderizar el gráfico principal.')
      }
    }

    initChart()

    return () => {
      disposed = true
      if (resizeHandler) window.removeEventListener('resize', resizeHandler)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
      volumeSeriesRef.current = null
      smaSeriesRef.current = {}
    }
  }, [history])

  // ── Effect B: toggle volume series without rebuilding the chart.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const currentHistory = history ? normalizeOhlcvSeries(history) : []
    if (currentHistory.length === 0) return

    let cancelled = false
    ;(async () => {
      const { HistogramSeries } = await import('lightweight-charts')
      if (cancelled || !chartRef.current) return

      if (showVolume && !volumeSeriesRef.current) {
        const series = chartRef.current.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        })
        chartRef.current.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
        series.setData(
          currentHistory.map((d) => ({
            time: d.date,
            value: d.volume,
            color: d.close >= d.open ? '#2d7a5f66' : '#b04a3a66',
          }))
        )
        volumeSeriesRef.current = series
      } else if (!showVolume && volumeSeriesRef.current) {
        chartRef.current.removeSeries(volumeSeriesRef.current)
        volumeSeriesRef.current = null
      }
    })()

    return () => { cancelled = true }
  }, [history, showVolume])

  // ── Effect C: add/remove SMA overlays without rebuilding the chart.
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !indicators) return
    const currentHistory = history ? normalizeOhlcvSeries(history) : []
    if (currentHistory.length === 0) return
    const currentIndicators = normalizeTechnicalIndicators(indicators)
    const dateSet = new Set(currentHistory.map((d) => d.date))

    let cancelled = false
    ;(async () => {
      const { LineSeries } = await import('lightweight-charts')
      if (cancelled || !chartRef.current) return

      for (const key of Object.keys(SMA_COLORS) as SmaKey[]) {
        const shouldShow = showSma[key]
        const existing = smaSeriesRef.current[key]

        if (shouldShow && !existing) {
          const smaData = currentIndicators[key] as Array<{ date: string; value: number }> | undefined
          if (!smaData) continue
          const series = chartRef.current.addSeries(LineSeries, {
            color: SMA_COLORS[key],
            lineWidth: 1,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
          })
          series.setData(
            smaData.filter((d) => dateSet.has(d.date)).map((d) => ({ time: d.date, value: d.value }))
          )
          smaSeriesRef.current[key] = series
        } else if (!shouldShow && existing) {
          chartRef.current.removeSeries(existing)
          delete smaSeriesRef.current[key]
        }
      }
    })()

    return () => { cancelled = true }
  }, [history, indicators, showSma])

  // ── RSI + MACD sub-chart ───────────────────────────────────────────
  useEffect(() => {
    const currentHistory = history ? normalizeOhlcvSeries(history) : []
    const currentIndicators = indicators ? normalizeTechnicalIndicators(indicators) : null

    if (!rsiContainerRef.current || !currentIndicators || currentHistory.length === 0) return

    let disposed = false
    let resizeHandler: (() => void) | null = null

    async function initRsiChart() {
      try {
        const { createChart, LineSeries, HistogramSeries } = await import('lightweight-charts')
        if (disposed || !rsiContainerRef.current) return

        const safeIndicators = currentIndicators!

        if (rsiChartRef.current) {
          rsiChartRef.current.remove()
          rsiChartRef.current = null
        }

        const dateSet = new Set(currentHistory.map((d) => d.date))

        const chart = createChart(rsiContainerRef.current, {
          width: rsiContainerRef.current.clientWidth,
          height: 150,
          layout: {
            background: { color: '#ffffff' },
            textColor: '#58574f',
            fontSize: 11,
          },
          grid: {
            vertLines: { color: '#e6e5df' },
            horzLines: { color: '#e6e5df' },
          },
          rightPriceScale: { borderColor: '#d8d6ce' },
          timeScale: { borderColor: '#d8d6ce', visible: false },
        })

        rsiChartRef.current = chart

        // RSI
        if (safeIndicators.rsi.length > 0) {
          const rsiSeries = chart.addSeries(LineSeries, {
            color: '#1e4d75',
            lineWidth: 1,
            priceScaleId: 'rsi',
            lastValueVisible: true,
            priceLineVisible: false,
          })
          rsiSeries.setData(
            safeIndicators.rsi
              .filter((d) => dateSet.has(d.date))
              .map((d) => ({ time: d.date, value: d.value }))
          )
          chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.05, bottom: 0.55 }, autoScale: true })
        }

        // MACD
        if (safeIndicators.macd.length > 0) {
          const macdHistSeries = chart.addSeries(HistogramSeries, {
            priceScaleId: 'macd',
            lastValueVisible: false,
            priceLineVisible: false,
          })
          macdHistSeries.setData(
            safeIndicators.macd
              .filter((d) => dateSet.has(d.date))
              .map((d) => ({
                time: d.date,
                value: d.histogram,
                color: d.histogram >= 0 ? '#2d7a5f88' : '#b04a3a88',
              }))
          )

          const macdLine = chart.addSeries(LineSeries, {
            color: '#1e4d75',
            lineWidth: 1,
            priceScaleId: 'macd',
            lastValueVisible: false,
            priceLineVisible: false,
          })
          macdLine.setData(
            safeIndicators.macd
              .filter((d) => dateSet.has(d.date))
              .map((d) => ({ time: d.date, value: d.macd }))
          )

          const signalLine = chart.addSeries(LineSeries, {
            color: '#a88438',
            lineWidth: 1,
            priceScaleId: 'macd',
            lastValueVisible: false,
            priceLineVisible: false,
          })
          signalLine.setData(
            safeIndicators.macd
              .filter((d) => dateSet.has(d.date))
              .map((d) => ({ time: d.date, value: d.signal }))
          )

          chart.priceScale('macd').applyOptions({ scaleMargins: { top: 0.55, bottom: 0.05 }, autoScale: true })
        }

        chart.timeScale().fitContent()

        resizeHandler = () => {
          if (rsiContainerRef.current && chart) {
            chart.applyOptions({ width: rsiContainerRef.current.clientWidth })
          }
        }
      }
      catch (error) {
        console.error('Indicators chart error:', error)
        if (!disposed) setChartError((current) => current ?? 'No se pudieron renderizar RSI/MACD.')
      }
      if (resizeHandler) {
        window.addEventListener('resize', resizeHandler)
      }
    }

    initRsiChart()

    return () => {
      disposed = true
      if (resizeHandler) window.removeEventListener('resize', resizeHandler)
      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
      }
    }
  }, [indicators, history])

  if (historyLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-[150px] w-full" />
      </div>
    )
  }

  if (historyError) {
    return (
      <Card className="p-6 bg-card border-border text-center text-muted-foreground">
        No se pudo cargar el histórico de precios para {ticker}.
      </Card>
    )
  }

  if (!history || normalizeOhlcvSeries(history).length === 0) {
    return (
      <Card className="p-6 bg-card border-border text-center text-muted-foreground">
        No hay datos históricos disponibles para {ticker}.
      </Card>
    )
  }

  if (chartError) {
    return (
      <Card className="p-6 bg-card border-border text-center text-muted-foreground space-y-2">
        <p>{chartError}</p>
        {indicatorsError && <p className="text-xs">También falló la carga de indicadores técnicos.</p>}
      </Card>
    )
  }

  return (
    <FadeIn className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-secondary rounded-lg p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                timeframe === tf
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        <button
          onClick={() => setShowVolume(!showVolume)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
            showVolume ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground'
          }`}
        >
          Vol
        </button>

        {(Object.entries(SMA_COLORS) as [SmaKey, string][]).map(([key, color]) => (
          <button
            key={key}
            onClick={() => setShowSma((prev) => ({ ...prev, [key]: !prev[key] }))}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
              showSma[key] ? 'border-opacity-100 bg-opacity-10' : 'border-border text-muted-foreground'
            }`}
            style={showSma[key] ? { borderColor: color, color, backgroundColor: `${color}15` } : {}}
          >
            {key.toUpperCase().replace('SMA', 'SMA ')}
          </button>
        ))}
      </div>

      {/* Main chart */}
      <div ref={containerRef} className="rounded-lg overflow-hidden border border-border" />

      {/* RSI + MACD legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" /> RSI (14)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" /> MACD
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[var(--warn)]" /> Signal
        </span>
      </div>
      <div ref={rsiContainerRef} className="rounded-lg overflow-hidden border border-border" />
    </FadeIn>
  )
}
