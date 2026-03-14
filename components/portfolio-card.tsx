'use client'

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePortfolio } from '@/lib/store/portfolio'
import { formatCurrency, formatPercent, colorForValue } from '@/lib/format'
import type { PortfolioPosition } from '@/lib/types'

interface PortfolioCardProps {
  position: PortfolioPosition
  onEdit: () => void
}

export function PortfolioCard({ position, onEdit }: PortfolioCardProps) {
  const router = useRouter()
  const removePosition = usePortfolio((s) => s.removePosition)

  const { data: overview, isLoading } = useQuery({
    queryKey: ['portfolio-overview', position.ticker, position.type],
    queryFn: async () => {
      const url = position.type === 'crypto'
        ? `/api/crypto/${position.ticker}/overview`
        : `/api/stock/${position.ticker}/overview`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch overview')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const currentPrice = position.type === 'crypto' ? overview?.price : overview?.price
  const costBasis = position.quantity * position.averageCost
  const currentValue = currentPrice ? position.quantity * currentPrice : null
  const pnl = currentValue != null ? currentValue - costBasis : null
  const pnlPercent = costBasis > 0 && pnl != null ? (pnl / costBasis) * 100 : null

  function handleClick() {
    if (position.type === 'crypto') {
      router.push(`/crypto/${position.ticker}`)
    } else {
      router.push(`/stock/${position.ticker}`)
    }
  }

  return (
    <Card
      className="p-4 bg-card border-border hover:border-primary/40 transition-colors cursor-pointer group relative"
      onClick={handleClick}
    >
      {/* Action buttons */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          className="p-1 rounded hover:bg-secondary"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); removePosition(position.ticker) }}
          className="p-1 rounded hover:bg-secondary"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ) : (
        <>
          <div className="mb-2">
            <div className="font-mono-numbers font-semibold text-sm">{position.ticker.toUpperCase()}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[140px]">{position.name}</div>
          </div>

          <div className="font-mono-numbers text-lg font-semibold">
            {currentPrice ? formatCurrency(currentPrice) : '—'}
          </div>

          <div className="text-xs text-muted-foreground mt-1">
            {position.quantity} × {formatCurrency(position.averageCost)}
          </div>

          {pnl != null && pnlPercent != null && (
            <div className={`font-mono-numbers text-sm mt-1 ${colorForValue(pnl)}`}>
              {formatCurrency(pnl)} ({formatPercent(pnlPercent)})
            </div>
          )}

          {currentValue != null && (
            <div className="text-xs text-muted-foreground mt-0.5 font-mono-numbers">
              Valor: {formatCurrency(currentValue)}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
