'use client'

import { useQueries } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { CountUp } from '@/components/motion/count-up'
import { formatCurrency, formatPercent, colorForValue } from '@/lib/format'
import type { PortfolioPosition } from '@/lib/types'

export function PortfolioSummary({ positions }: { positions: PortfolioPosition[] }) {
  const queries = useQueries({
    queries: positions.map((pos) => ({
      queryKey: ['portfolio-overview', pos.ticker, pos.type],
      queryFn: async () => {
        const url = pos.type === 'crypto'
          ? `/api/crypto/${pos.ticker}/overview`
          : `/api/stock/${pos.ticker}/overview`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch overview')
        return res.json()
      },
      staleTime: 5 * 60 * 1000,
    })),
  })

  let totalValue = 0
  let totalCost = 0
  let allLoaded = true

  positions.forEach((pos, i) => {
    const overview = queries[i]?.data
    if (!overview?.price) {
      allLoaded = false
      return
    }
    totalValue += pos.quantity * overview.price
    totalCost += pos.quantity * pos.averageCost
  })

  const totalPnl = totalValue - totalCost
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  if (!allLoaded) return null

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="p-4 bg-card-glass border-border text-center">
        <p className="text-xs text-muted-foreground mb-1">Valor Total</p>
        <CountUp
          value={totalValue}
          format={formatCurrency}
          className="font-mono-numbers font-semibold text-lg"
        />
      </Card>
      <Card className="p-4 bg-card-glass border-border text-center">
        <p className="text-xs text-muted-foreground mb-1">Costo Total</p>
        <CountUp
          value={totalCost}
          format={formatCurrency}
          className="font-mono-numbers font-semibold text-lg"
        />
      </Card>
      <Card className="p-4 bg-card-glass border-border text-center">
        <p className="text-xs text-muted-foreground mb-1">P&L Total</p>
        <CountUp
          value={totalPnl}
          format={formatCurrency}
          className={`font-mono-numbers font-semibold text-lg ${colorForValue(totalPnl)}`}
        />
        <CountUp
          value={totalPnlPercent}
          format={formatPercent}
          className={`font-mono-numbers text-xs ${colorForValue(totalPnl)}`}
        />
      </Card>
    </div>
  )
}
