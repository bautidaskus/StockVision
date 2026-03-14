'use client'

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useWatchlist } from '@/lib/store/watchlist'
import { formatCurrency, formatPercent, colorForValue } from '@/lib/format'
import type { WatchlistItem } from '@/lib/types'
import { SparklineChart } from './sparkline-chart'

export function WatchlistCard({ item }: { item: WatchlistItem }) {
  const router = useRouter()
  const removeItem = useWatchlist((s) => s.removeItem)

  const { data: overview, isLoading } = useQuery({
    queryKey: ['watchlist-overview', item.ticker, item.type],
    queryFn: async () => {
      const url = item.type === 'crypto'
        ? `/api/crypto/${item.ticker}/overview`
        : `/api/stock/${item.ticker}/overview`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch overview')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: history } = useQuery({
    queryKey: ['watchlist-history', item.ticker, item.type],
    queryFn: async () => {
      const url = item.type === 'crypto'
        ? `/api/crypto/${item.ticker}/history?range=1m`
        : `/api/stock/${item.ticker}/history?range=1m`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch history')
      return res.json()
    },
    staleTime: 10 * 60 * 1000,
  })

  const price = item.type === 'crypto' ? overview?.price : overview?.price
  const changePercent = item.type === 'crypto' ? overview?.changePercent24h : overview?.changePercent
  const name = overview?.name || item.name

  const sparkData = item.type === 'crypto'
    ? (Array.isArray(history?.prices) ? history.prices : []).map((p: { close: number }) => p.close)
    : (Array.isArray(history) ? history : []).map((p: { close: number }) => p.close)

  function handleClick() {
    if (item.type === 'crypto') {
      router.push(`/crypto/${item.ticker}`)
    } else {
      router.push(`/stock/${item.ticker}`)
    }
  }

  return (
    <Card
      className="p-4 bg-card border-border hover:border-primary/40 transition-colors cursor-pointer group relative"
      onClick={handleClick}
    >
      <button
        onClick={(e) => { e.stopPropagation(); removeItem(item.ticker) }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-secondary"
      >
        <X className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-mono-numbers font-semibold text-sm">{item.ticker.toUpperCase()}</div>
              <div className="text-xs text-muted-foreground truncate max-w-[120px]">{name}</div>
            </div>
          </div>
          <div className="font-mono-numbers text-lg font-semibold">
            {price ? formatCurrency(price) : '—'}
          </div>
          <div className={`font-mono-numbers text-sm ${colorForValue(changePercent || 0)}`}>
            {changePercent != null ? formatPercent(changePercent) : '—'}
          </div>
          {sparkData.length > 2 && (
            <div className="mt-2 h-8">
              <SparklineChart data={sparkData} positive={(changePercent || 0) >= 0} />
            </div>
          )}
        </>
      )}
    </Card>
  )
}
