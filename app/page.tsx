'use client'

import { useState } from 'react'
import { SearchBar } from '@/components/search-bar'
import { WatchlistCard } from '@/components/watchlist-card'
import { PortfolioCard } from '@/components/portfolio-card'
import { PortfolioSummary } from '@/components/portfolio-summary'
import { AddPositionDialog } from '@/components/add-position-dialog'
import { useWatchlist } from '@/lib/store/watchlist'
import { usePortfolio } from '@/lib/store/portfolio'
import { TrendingUp, Eye, Briefcase, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PortfolioPosition } from '@/lib/types'

export default function HomePage() {
  const items = useWatchlist((s) => s.items)
  const positions = usePortfolio((s) => s.positions)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<PortfolioPosition | null>(null)

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
      <div className="text-center space-y-4 pt-8">
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
      </div>

      {/* Watchlist */}
      <div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((item) => (
              <WatchlistCard key={item.ticker} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Portfolio */}
      <div>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {positions.map((pos) => (
                <PortfolioCard
                  key={pos.ticker}
                  position={pos}
                  onEdit={() => handleEditPosition(pos)}
                />
              ))}
            </div>
          </div>
        )}

        <AddPositionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingPosition={editingPosition}
        />
      </div>

      {/* Quick Access */}
      <div>
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
      </div>
    </div>
  )
}
