'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchBar } from '@/components/search-bar'
import { WatchlistCard } from '@/components/watchlist-card'
import { PortfolioCard } from '@/components/portfolio-card'
import { PortfolioSummary } from '@/components/portfolio-summary'
import { AddPositionDialog } from '@/components/add-position-dialog'
import { useWatchlist } from '@/lib/store/watchlist'
import { usePortfolio } from '@/lib/store/portfolio'
import { TrendingUp, Eye, Briefcase, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FadeIn } from '@/components/motion/fade-in'
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger-container'
import type { BatchOverviewResponse, PortfolioPosition } from '@/lib/types'

export default function HomePage() {
  const items = useWatchlist((s) => s.items)
  const positions = usePortfolio((s) => s.positions)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<PortfolioPosition | null>(null)

  const stockTickers = useMemo(
    () =>
      items
        .filter((i) => i.type === 'stock')
        .map((i) => i.ticker.toUpperCase())
        .sort()
        .join(','),
    [items],
  )

  const { data: batch } = useQuery<BatchOverviewResponse>({
    queryKey: ['watchlist-batch', stockTickers],
    enabled: stockTickers.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/batch/overview?tickers=${stockTickers}&spark=1m`, { signal })
      if (!res.ok) throw new Error('batch failed')
      return res.json()
    },
  })

  function handleEditPosition(pos: PortfolioPosition) {
    setEditingPosition(pos)
    setDialogOpen(true)
  }

  function handleAddPosition() {
    setEditingPosition(null)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-10">
      {/* Hero */}
      <FadeIn className="text-center space-y-4 pt-8">
        <div className="flex items-center justify-center gap-3 mb-2">
          <TrendingUp className="w-10 h-10 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">StockVision</h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Análisis de inversiones con inteligencia artificial. Buscá cualquier acción, ETF o criptomoneda.
        </p>
        <div className="pt-4">
          <SearchBar />
        </div>
      </FadeIn>

      {/* Watchlist */}
      <FadeIn delay={0.1}>
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Watchlist</h2>
          <span className="text-sm text-muted-foreground">({items.length})</span>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
            <Eye className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>Tu watchlist está vacía.</p>
            <p className="text-sm mt-1">Buscá un activo y agregalo con la estrella.</p>
          </div>
        ) : (
          <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => (
              <StaggerItem key={item.ticker}>
                <WatchlistCard
                  item={item}
                  initialData={item.type === 'stock' ? batch?.[item.ticker.toUpperCase()] : undefined}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        )}
      </FadeIn>

      {/* Portfolio */}
      <FadeIn delay={0.2}>
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Portafolio</h2>
          <span className="text-sm text-muted-foreground">({positions.length})</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-1"
            onClick={handleAddPosition}
          >
            <Plus className="w-4 h-4" />
            Agregar
          </Button>
        </div>

        {positions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
            <Briefcase className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p>Tu portafolio está vacío.</p>
            <p className="text-sm mt-1">Agregá posiciones para trackear tu P&L.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <PortfolioSummary positions={positions} />
            <StaggerContainer className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {positions.map((pos) => (
                <StaggerItem key={pos.ticker}>
                  <PortfolioCard
                    position={pos}
                    onEdit={() => handleEditPosition(pos)}
                  />
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        )}

        <AddPositionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingPosition={editingPosition}
        />
      </FadeIn>

      {/* Quick Access */}
      <FadeIn delay={0.3}>
        <h2 className="text-lg font-semibold mb-4">Acceso Rápido</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { ticker: 'AAPL', name: 'Apple', type: 'stock' as const },
            { ticker: 'MSFT', name: 'Microsoft', type: 'stock' as const },
            { ticker: 'GOOGL', name: 'Alphabet', type: 'stock' as const },
            { ticker: 'AMZN', name: 'Amazon', type: 'stock' as const },
            { ticker: 'TSLA', name: 'Tesla', type: 'stock' as const },
            { ticker: 'NVDA', name: 'NVIDIA', type: 'stock' as const },
            { ticker: 'bitcoin', name: 'Bitcoin', type: 'crypto' as const },
            { ticker: 'ethereum', name: 'Ethereum', type: 'crypto' as const },
          ].map((item) => (
            <a
              key={item.ticker}
              href={item.type === 'crypto' ? `/crypto/${item.ticker}` : `/stock/${item.ticker}`}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/40 transition-colors"
            >
              <div className="font-mono-numbers font-semibold text-sm">{item.ticker.toUpperCase()}</div>
              <div className="text-xs text-muted-foreground">{item.name}</div>
            </a>
          ))}
        </div>
      </FadeIn>
    </div>
  )
}
