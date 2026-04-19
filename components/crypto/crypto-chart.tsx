'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { FadeIn } from '@/components/motion/fade-in'

const TIMEFRAMES = ['1M', '3M', '6M', '1Y', '3Y', '5Y'] as const

export function CryptoChart({ id }: { id: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null)
  const [timeframe, setTimeframe] = useState<string>('1Y')

  const range = timeframe.toLowerCase()

  const { data: history, isLoading } = useQuery({
    queryKey: ['crypto-history', id, range],
    queryFn: async () => {
      const res = await fetch(`/api/crypto/${id}/history?range=${range}`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  useEffect(() => {
    if (!containerRef.current || !history?.prices || history.prices.length === 0) return

    let disposed = false
    let resizeHandler: (() => void) | null = null

    async function initChart() {
      const { createChart, AreaSeries, HistogramSeries } = await import('lightweight-charts')
      if (disposed || !containerRef.current) return

      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 400,
        layout: {
          background: { color: '#ffffff' },
          textColor: '#71717a',
          fontSize: 12,
        },
        grid: {
          vertLines: { color: '#e6e5df' },
          horzLines: { color: '#e6e5df' },
        },
        rightPriceScale: { borderColor: '#d8d6ce' },
        timeScale: { borderColor: '#d8d6ce' },
      })

      chartRef.current = chart

      // Deduplicate prices by date (CoinGecko might return duplicates)
      const priceMap = new Map<string, number>()
      for (const p of history.prices) {
        priceMap.set(p.date, p.close)
      }

      const prices = Array.from(priceMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, close]) => ({ time: date, value: close }))

      const isPositive = prices.length >= 2 && prices[prices.length - 1].value >= prices[0].value

      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: isPositive ? '#2d7a5f' : '#b04a3a',
        topColor: isPositive ? '#2d7a5f33' : '#b04a3a33',
        bottomColor: 'transparent',
        lineWidth: 2,
      })

      areaSeries.setData(prices)

      // Volume
      if (history.volumes?.length > 0) {
        const volumeMap = new Map<string, number>()
        for (const v of history.volumes) {
          volumeMap.set(v.date, v.volume)
        }

        const volumes = Array.from(volumeMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, volume]) => ({
            time: date,
            value: volume,
            color: '#1e4d7533',
          }))

        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        })

        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        })

        volumeSeries.setData(volumes)
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
  }, [history])

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />
  }

  return (
    <FadeIn className="space-y-3">
      <div className="flex bg-secondary rounded-lg p-0.5 w-fit">
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

      <div ref={containerRef} className="rounded-lg overflow-hidden border border-border" />
    </FadeIn>
  )
}
