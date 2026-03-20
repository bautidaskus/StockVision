'use client'

import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Star, StarOff } from 'lucide-react'
import { useWatchlist } from '@/lib/store/watchlist'
import { FadeIn } from '@/components/motion/fade-in'
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger-container'
import { formatCurrency, formatLargeNumber, formatPercent, colorForValue } from '@/lib/format'
import type { CryptoOverview } from '@/lib/types'

export function CryptoHeader({ id }: { id: string }) {
  const { data: overview, isLoading, error } = useQuery<CryptoOverview>({
    queryKey: ['crypto-overview', id],
    queryFn: async () => {
      const res = await fetch(`/api/crypto/${id}/overview`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  const { addItem, removeItem, hasItem } = useWatchlist()
  const isWatched = hasItem(id)

  if (error) {
    return (
      <div className="p-6 bg-card rounded-lg border border-border">
        <p className="text-red">Error al cargar datos de {id}. Verificá el ID e intentá de nuevo.</p>
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
        </div>
      </div>
    )
  }

  const decimals = overview.price >= 1 ? 2 : overview.price >= 0.01 ? 4 : 6

  return (
    <FadeIn>
      <div className="p-6 bg-card rounded-lg border border-border">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {overview.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={overview.image} alt={overview.name} className="w-8 h-8 rounded-full" />
              )}
              <h1 className="text-2xl font-bold">{overview.name}</h1>
              <span className="font-mono-numbers text-lg text-muted-foreground">{overview.symbol}</span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="secondary">#{overview.marketCapRank}</Badge>
              <Badge variant="outline" className="text-muted-foreground">Crypto</Badge>
            </div>
          </div>
          <button
            onClick={() => {
              if (isWatched) {
                removeItem(id)
              } else {
                addItem({ ticker: id, name: overview.name, type: 'crypto' })
              }
            }}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            {isWatched ? (
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            ) : (
              <StarOff className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </div>

        <FadeIn delay={0.1} className="flex items-baseline gap-3 mb-4">
          <span className="text-4xl font-bold font-mono-numbers">
            {formatCurrency(overview.price, decimals)}
          </span>
          <span className={`text-xl font-mono-numbers font-semibold ${colorForValue(overview.changePercent24h)}`}>
            ({formatPercent(overview.changePercent24h)})
          </span>
          <span className="text-sm text-muted-foreground">24h</span>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <StaggerItem><MetricItem label="Market Cap" value={`$${formatLargeNumber(overview.marketCap)}`} /></StaggerItem>
          <StaggerItem><MetricItem label="Volumen 24h" value={`$${formatLargeNumber(overview.volume24h)}`} /></StaggerItem>
          <StaggerItem><MetricItem label="Circulating Supply" value={formatLargeNumber(overview.circulatingSupply)} /></StaggerItem>
          <StaggerItem><MetricItem label="Total Supply" value={overview.totalSupply ? formatLargeNumber(overview.totalSupply) : 'N/A'} /></StaggerItem>
          <StaggerItem><MetricItem label="ATH" value={formatCurrency(overview.ath, decimals)} /></StaggerItem>
          <StaggerItem><MetricItem label="ATH Date" value={overview.athDate ? new Date(overview.athDate).toLocaleDateString('es-AR') : 'N/A'} /></StaggerItem>
          <StaggerItem><MetricItem label="ATL" value={formatCurrency(overview.atl, decimals)} /></StaggerItem>
          <StaggerItem><MetricItem label="Max Supply" value={overview.maxSupply ? formatLargeNumber(overview.maxSupply) : 'Ilimitado'} /></StaggerItem>
        </StaggerContainer>
      </div>
    </FadeIn>
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
