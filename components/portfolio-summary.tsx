'use client'

import { useQueries } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { CountUp } from '@/components/motion/count-up'
import { formatCurrency, formatCurrencyArs, formatPercent, colorForValue } from '@/lib/format'
import { cedearPriceArs, cedearPriceUsd } from '@/lib/cedears'
import { useMep } from '@/lib/hooks/use-mep'
import type { PortfolioPosition } from '@/lib/types'

export function PortfolioSummary({ positions }: { positions: PortfolioPosition[] }) {
  const queries = useQueries({
    queries: positions.map((pos) => {
      const priceTicker =
        pos.type === 'cedear'
          ? (pos.underlying ?? pos.ticker.replace(/\.BA$/, ''))
          : pos.ticker
      return {
        queryKey: ['portfolio-overview', priceTicker, pos.type],
        queryFn: async () => {
          const url = pos.type === 'crypto'
            ? `/api/crypto/${priceTicker}/overview`
            : `/api/stock/${priceTicker}/overview`
          const res = await fetch(url)
          if (!res.ok) throw new Error('Failed to fetch overview')
          return res.json()
        },
        staleTime: 5 * 60 * 1000,
      }
    }),
  })

  const { data: mep } = useMep()

  const hasCedear = positions.some((p) => p.type === 'cedear')

  let totalValueUsd = 0
  let totalCostUsd = 0
  let totalValueArs = 0
  let totalCostArs = 0
  let allLoaded = true
  let cedearUsdStale = false

  positions.forEach((pos, i) => {
    const overview = queries[i]?.data
    const underlyingUsd = overview?.price as number | undefined
    if (!underlyingUsd) {
      allLoaded = false
      return
    }

    if (pos.type === 'cedear') {
      const ratio = pos.ratio ?? 1
      const priceArs = cedearPriceArs(underlyingUsd, ratio, mep?.mid)
      const priceUsd = cedearPriceUsd(underlyingUsd, ratio)
      if (priceArs == null || priceUsd == null) {
        allLoaded = false
        return
      }
      totalValueArs += pos.quantity * priceArs
      totalCostArs += pos.quantity * pos.averageCost

      // USD conversion of ARS values uses today's MEP — mark as approximate.
      if (!mep?.mid) {
        cedearUsdStale = true
      } else {
        totalValueUsd += pos.quantity * priceUsd
        totalCostUsd += (pos.quantity * pos.averageCost) / mep.mid
      }
    } else {
      totalValueUsd += pos.quantity * underlyingUsd
      totalCostUsd += pos.quantity * pos.averageCost
    }
  })

  if (!allLoaded) return null

  const totalPnlUsd = totalValueUsd - totalCostUsd
  const totalPnlPercentUsd = totalCostUsd > 0 ? (totalPnlUsd / totalCostUsd) * 100 : 0

  const totalPnlArs = totalValueArs - totalCostArs
  const totalPnlPercentArs = totalCostArs > 0 ? (totalPnlArs / totalCostArs) * 100 : 0

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 bg-card-glass border-border text-center">
          <p className="text-xs text-muted-foreground mb-1">
            Valor Total {hasCedear && <span className="text-[10px]">(USD)</span>}
          </p>
          <CountUp
            value={totalValueUsd}
            format={formatCurrency}
            className="font-mono-numbers font-semibold text-lg"
          />
          {cedearUsdStale && (
            <p className="text-[10px] text-muted-foreground mt-1">MEP no disponible</p>
          )}
        </Card>
        <Card className="p-4 bg-card-glass border-border text-center">
          <p className="text-xs text-muted-foreground mb-1">
            Costo Total {hasCedear && <span className="text-[10px]">(USD)</span>}
          </p>
          <CountUp
            value={totalCostUsd}
            format={formatCurrency}
            className="font-mono-numbers font-semibold text-lg"
          />
        </Card>
        <Card className="p-4 bg-card-glass border-border text-center">
          <p className="text-xs text-muted-foreground mb-1">P&L Total</p>
          <CountUp
            value={totalPnlUsd}
            format={formatCurrency}
            className={`font-mono-numbers font-semibold text-lg ${colorForValue(totalPnlUsd)}`}
          />
          <CountUp
            value={totalPnlPercentUsd}
            format={formatPercent}
            className={`font-mono-numbers text-xs ${colorForValue(totalPnlUsd)}`}
          />
        </Card>
      </div>

      {hasCedear && totalCostArs > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-4 bg-card-glass border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Valor CEDEARs (ARS)</p>
            <CountUp
              value={totalValueArs}
              format={formatCurrencyArs}
              className="font-mono-numbers font-semibold text-lg"
            />
          </Card>
          <Card className="p-4 bg-card-glass border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Costo CEDEARs (ARS)</p>
            <CountUp
              value={totalCostArs}
              format={formatCurrencyArs}
              className="font-mono-numbers font-semibold text-lg"
            />
          </Card>
          <Card className="p-4 bg-card-glass border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">P&L CEDEARs (ARS)</p>
            <CountUp
              value={totalPnlArs}
              format={formatCurrencyArs}
              className={`font-mono-numbers font-semibold text-lg ${colorForValue(totalPnlArs)}`}
            />
            <CountUp
              value={totalPnlPercentArs}
              format={formatPercent}
              className={`font-mono-numbers text-xs ${colorForValue(totalPnlArs)}`}
            />
          </Card>
        </div>
      )}
    </div>
  )
}
