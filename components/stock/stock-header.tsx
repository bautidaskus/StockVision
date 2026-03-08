'use client'

import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Star, StarOff } from 'lucide-react'
import { useWatchlist } from '@/lib/store/watchlist'
import { formatCurrency, formatLargeNumber, formatPercent, colorForValue, safeFixed } from '@/lib/format'
import type { StockOverview } from '@/lib/types'

export function StockHeader({ ticker }: { ticker: string }) {
  const { data: overview, isLoading, error } = useQuery<StockOverview>({
    queryKey: ['stock-overview', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/overview`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { addItem, removeItem, hasItem } = useWatchlist()
  const isWatched = hasItem(ticker)

  if (error) {
    return (
      <div className="p-6 bg-card rounded-lg border border-border">
        <p className="text-red">Error al cargar datos de {ticker}. Verificá el ticker e intentá de nuevo.</p>
      </div>
    )
  }

  if (isLoading || !overview) {
    return (
      <div className="p-6 bg-card rounded-lg border border-border space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
        <div className="flex gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-card rounded-lg border border-border">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{overview.name}</h1>
            <span className="font-mono-numbers text-lg text-muted-foreground">{overview.ticker}</span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            {overview.sector && overview.sector !== 'N/A' && (
              <Badge variant="secondary">{overview.sector}</Badge>
            )}
            {overview.industry && overview.industry !== 'N/A' && (
              <Badge variant="outline" className="text-muted-foreground">{overview.industry}</Badge>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            if (isWatched) {
              removeItem(ticker)
            } else {
              addItem({ ticker, name: overview.name, type: 'stock' })
            }
          }}
          className="p-2 rounded-lg hover:bg-secondary transition-colors"
          title={isWatched ? 'Quitar de watchlist' : 'Agregar a watchlist'}
        >
          {isWatched ? (
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          ) : (
            <StarOff className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </div>

      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-4xl font-bold font-mono-numbers">
          {formatCurrency(overview.price)}
        </span>
        <span className={`text-xl font-mono-numbers font-semibold ${colorForValue(overview.change)}`}>
          {overview.change >= 0 ? '+' : ''}{formatCurrency(overview.change, 2)}
        </span>
        <span className={`text-xl font-mono-numbers ${colorForValue(overview.changePercent)}`}>
          ({formatPercent(overview.changePercent)})
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <MetricItem label="Market Cap" value={`$${formatLargeNumber(overview.marketCap)}`} />
        <MetricItem label="P/E Ratio" value={safeFixed(overview.pe)} />
        <MetricItem label="EPS" value={overview.eps ? formatCurrency(overview.eps) : 'N/A'} />
        <MetricItem label="Beta" value={safeFixed(overview.beta)} />
        <MetricItem label="52W High" value={formatCurrency(overview.week52High)} />
        <MetricItem label="52W Low" value={formatCurrency(overview.week52Low)} />
        <MetricItem label="Div Yield" value={overview.dividendYield != null && !isNaN(overview.dividendYield) ? `${(overview.dividendYield * 100).toFixed(2)}%` : 'N/A'} />
        <MetricItem label="Shares Out" value={formatLargeNumber(overview.sharesOutstanding)} />
      </div>
    </div>
  )
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-mono-numbers font-medium">{value}</div>
    </div>
  )
}
