'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from '@/components/motion/fade-in'
import type { OHLCV, TechnicalIndicators } from '@/lib/types'

const TIMEFRAMES = ['1M', '3M', '6M', '1Y', '3Y', '5Y'] as const
const SMA_COLORS = {
  sma20: '#f59e0b',
  sma50: '#6366f1',
  sma200: '#ec4899',
} as const

export function CandlestickChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rsiContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null)
  const rsiChartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null)
  const [timeframe, setTimeframe] = useState<string>('1Y')
  const [showVolume, setShowVolume] = useState(true)
  const [showSma, setShowSma] = useState<Record<string, boolean>>({ sma20: false, sma50: false, sma200: false })

  const range = timeframe.toLowerCase()

  const { data: history, isLoading: historyLoading } = useQuery<OHLCV[]>({
    queryKey: ['stock-history', ticker, range],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/history?range=${range}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { data: indicators } = useQuery<TechnicalIndicators>({
    queryKey: ['stock-indicators', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/indicators`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  // ── Main candlestick chart ─────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !history || history.length === 0) return

    const currentHistory = history
    let disposed = false
    let resizeHandler: (() => void) | null = null

    async function initChart() {
      const { createChart, CandlestickSeries, HistogramSeries, LineSeries } = await import('lightweight-charts')
      if (disposed || !containerRef.current) return

      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 400,
        layout: {
          background: { color: '#1a1a1f' },
          textColor: '#71717a',
          fontSize: 12,
        },
        grid: {
          vertLines: { color: '#2a2a3520' },
          horzLines: { color: '#2a2a3520' },
        },
        crosshair: { mode: 0 },
        rightPriceScale: { borderColor: '#2a2a35' },
        timeScale: { borderColor: '#2a2a35', timeVisible: false },
      })

      chartRef.current = chart

      // Candlesticks
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00c896',
        downColor: '#ff4757',
        borderDownColor: '#ff4757',
        borderUpColor: '#00c896',
        wickDownColor: '#ff4757',
        wickUpColor: '#00c896',
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

      // Volume
      if (showVolume) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        })
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
        volumeSeries.setData(
          currentHistory.map((d) => ({
            time: d.date,
            value: d.volume,
            color: d.close >= d.open ? '#00c89633' : '#ff475733',
          }))
        )
      }

      // SMA overlays
      if (indicators) {
        const dateSet = new Set(currentHistory.map((d) => d.date))
        Object.entries(showSma).forEach(([key, visible]) => {
          if (!visible) return
          const smaKey = key as keyof typeof SMA_COLORS
          const smaData = indicators[smaKey as keyof TechnicalIndicators] as Array<{ date: string; value: number }> | undefined
          if (!smaData) return
          const series = chart.addSeries(LineSeries, {
            color: SMA_COLORS[smaKey],
            lineWidth: 1,
            crosshairMarkerVisible: false,
            priceLineVisible: false,
            lastValueVisible: false,
          })
          series.setData(
            smaData
              .filter((d) => dateSet.has(d.date))
              .map((d) => ({ time: d.date, value: d.value }))
          )
        })
      }

      chart.timeScale().fitContent()

      resizeHandler = () => {
        if (containerRef.current && chart) {
          chart.applyOptions({ width: containerRef.current.clientWidth })
        }
      }
      window.addEventListener('resize', resizeHandler)
    }

    initChart()

    return () => {
      disposed = true
      if (resizeHandler) window.removeEventListener('resize', resizeHandler)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [history, indicators, showVolume, showSma])

  // ── RSI + MACD sub-chart ───────────────────────────────────────────
  useEffect(() => {
    if (!rsiContainerRef.current || !indicators || !history || history.length === 0) return

    const currentHistory = history
    let disposed = false
    let resizeHandler: (() => void) | null = null

    async function initRsiChart() {
      const { createChart, LineSeries, HistogramSeries } = await import('lightweight-charts')
      if (disposed || !rsiContainerRef.current) return

      if (rsiChartRef.current) {
        rsiChartRef.current.remove()
        rsiChartRef.current = null
      }

      const dateSet = new Set(currentHistory.map((d) => d.date))

      const chart = createChart(rsiContainerRef.current, {
        width: rsiContainerRef.current.clientWidth,
        height: 150,
        layout: {
          background: { color: '#1a1a1f' },
          textColor: '#71717a',
          fontSize: 11,
        },
        grid: {
          vertLines: { color: '#2a2a3520' },
          horzLines: { color: '#2a2a3520' },
        },
        rightPriceScale: { borderColor: '#2a2a35' },
        timeScale: { borderColor: '#2a2a35', visible: false },
      })

      rsiChartRef.current = chart

      // RSI
      if (indicators?.rsi && indicators.rsi.length > 0) {
        const rsiSeries = chart.addSeries(LineSeries, {
          color: '#6366f1',
          lineWidth: 1,
          priceScaleId: 'rsi',
          lastValueVisible: true,
          priceLineVisible: false,
        })
        rsiSeries.setData(
          indicators.rsi
            .filter((d) => dateSet.has(d.date))
            .map((d) => ({ time: d.date, value: d.value }))
        )
        chart.priceScale('rsi').applyOptions({ scaleMargins: { top: 0.05, bottom: 0.55 }, autoScale: true })
      }

      // MACD
      if (indicators?.macd && indicators.macd.length > 0) {
        const macdHistSeries = chart.addSeries(HistogramSeries, {
          priceScaleId: 'macd',
          lastValueVisible: false,
          priceLineVisible: false,
        })
        macdHistSeries.setData(
          indicators.macd
            .filter((d) => dateSet.has(d.date))
            .map((d) => ({
              time: d.date,
              value: d.histogram,
              color: d.histogram >= 0 ? '#00c89688' : '#ff475788',
            }))
        )

        const macdLine = chart.addSeries(LineSeries, {
          color: '#6366f1',
          lineWidth: 1,
          priceScaleId: 'macd',
          lastValueVisible: false,
          priceLineVisible: false,
        })
        macdLine.setData(
          indicators.macd
            .filter((d) => dateSet.has(d.date))
            .map((d) => ({ time: d.date, value: d.macd }))
        )

        const signalLine = chart.addSeries(LineSeries, {
          color: '#f59e0b',
          lineWidth: 1,
          priceScaleId: 'macd',
          lastValueVisible: false,
          priceLineVisible: false,
        })
        signalLine.setData(
          indicators.macd
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
      window.addEventListener('resize', resizeHandler)
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

        {Object.entries(SMA_COLORS).map(([key, color]) => (
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
          <span className="w-2 h-2 rounded-full bg-[#6366f1]" /> RSI (14)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#6366f1]" /> MACD
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Signal
        </span>
      </div>
      <div ref={rsiContainerRef} className="rounded-lg overflow-hidden border border-border" />
    </FadeIn>
  )
}
