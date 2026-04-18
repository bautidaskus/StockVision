'use client'

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Pencil, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePortfolio } from '@/lib/store/portfolio'
import { formatCurrency, formatCurrencyArs, formatPercent, colorForValue } from '@/lib/format'
import { cedearPriceArs, cedearPriceUsd } from '@/lib/cedears'
import { useMep } from '@/lib/hooks/use-mep'
import type { PortfolioPosition } from '@/lib/types'

interface PortfolioCardProps {
  position: PortfolioPosition
  onEdit: () => void
}

export function PortfolioCard({ position, onEdit }: PortfolioCardProps) {
  const router = useRouter()
  const removePosition = usePortfolio((s) => s.removePosition)

  const isCedear = position.type === 'cedear'
  const priceTicker = isCedear ? (position.underlying ?? position.ticker.replace(/\.BA$/, '')) : position.ticker

  const { data: overview, isLoading } = useQuery({
    queryKey: ['portfolio-overview', priceTicker, position.type],
    queryFn: async () => {
      const url = position.type === 'crypto'
        ? `/api/crypto/${priceTicker}/overview`
        : `/api/stock/${priceTicker}/overview`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch overview')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  const { data: mep } = useMep()

  const underlyingPriceUsd = overview?.price as number | undefined

  let primaryPrice: number | null = null
  let primaryFormat: (v: number | null | undefined) => string = formatCurrency
  let secondaryLabel: string | null = null
  let secondaryValue: string | null = null
  let costBasis = 0
  let currentValue: number | null = null
  let pnl: number | null = null
  let pnlPercent: number | null = null

  if (isCedear) {
    const ratio = position.ratio ?? 1
    const cedearArs = cedearPriceArs(underlyingPriceUsd, ratio, mep?.mid)
    const cedearUsd = cedearPriceUsd(underlyingPriceUsd, ratio)

    primaryPrice = cedearArs
    primaryFormat = formatCurrencyArs

    costBasis = position.quantity * position.averageCost
    currentValue = cedearArs != null ? position.quantity * cedearArs : null
    pnl = currentValue != null ? currentValue - costBasis : null
    pnlPercent = costBasis > 0 && pnl != null ? (pnl / costBasis) * 100 : null

    if (cedearUsd != null) {
      secondaryLabel = 'USD'
      secondaryValue = formatCurrency(cedearUsd)
    }
  } else {
    primaryPrice = underlyingPriceUsd ?? null
    primaryFormat = formatCurrency
    costBasis = position.quantity * position.averageCost
    currentValue = underlyingPriceUsd != null ? position.quantity * underlyingPriceUsd : null
    pnl = currentValue != null ? currentValue - costBasis : null
    pnlPercent = costBasis > 0 && pnl != null ? (pnl / costBasis) * 100 : null
  }

  function handleClick() {
    if (position.type === 'crypto') {
      router.push(`/crypto/${position.ticker}`)
    } else if (isCedear) {
      router.push(`/stock/${priceTicker}`)
    } else {
      router.push(`/stock/${position.ticker}`)
    }
  }

  const costFormat = isCedear ? formatCurrencyArs : formatCurrency

  return (
    <Card
      className="p-4 bg-card border-border hover:border-primary/40 transition-colors cursor-pointer group relative"
      onClick={handleClick}
    >
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
            <div className="font-mono-numbers font-semibold text-sm flex items-center gap-1.5">
              {position.ticker.toUpperCase()}
              {isCedear && (
                <span className="text-[10px] uppercase tracking-wide text-primary bg-primary/10 rounded px-1 py-0.5">
                  CEDEAR
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate max-w-[140px]">{position.name}</div>
          </div>

          <div className="font-mono-numbers text-lg font-semibold">
            {primaryPrice != null ? primaryFormat(primaryPrice) : '—'}
          </div>

          {secondaryValue && (
            <div className="font-mono-numbers text-xs text-muted-foreground">
              ≈ {secondaryValue} {secondaryLabel}
            </div>
          )}

          <div className="text-xs text-muted-foreground mt-1">
            {position.quantity} × {costFormat(position.averageCost)}
          </div>

          {pnl != null && pnlPercent != null && (
            <div className={`font-mono-numbers text-sm mt-1 ${colorForValue(pnl)}`}>
              {isCedear ? formatCurrencyArs(pnl) : formatCurrency(pnl)} ({formatPercent(pnlPercent)})
            </div>
          )}

          {currentValue != null && (
            <div className="text-xs text-muted-foreground mt-0.5 font-mono-numbers">
              Valor: {isCedear ? formatCurrencyArs(currentValue) : formatCurrency(currentValue)}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
