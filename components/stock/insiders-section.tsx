'use client'

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatLargeNumber } from '@/lib/format'
import type { InsiderData } from '@/lib/types'

export function InsidersSection({ ticker }: { ticker: string }) {
  const { data, isLoading } = useQuery<InsiderData>({
    queryKey: ['stock-insiders', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/insiders`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!data || !data.transactions || data.transactions.length === 0) {
    return (
      <Card className="p-6 bg-card border-border text-center text-muted-foreground">
        No hay datos de insiders disponibles para {ticker}.
      </Card>
    )
  }

  const isNetBuying = data.netBuying > 0

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center gap-4 flex-wrap">
        <Badge
          variant="outline"
          className={`text-base px-4 py-1.5 ${
            isNetBuying
              ? 'bg-green-600/20 text-green-400 border-green-600/30'
              : 'bg-red-600/20 text-red-400 border-red-600/30'
          }`}
        >
          {isNetBuying ? 'Compra Neta' : 'Venta Neta'}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {data.buyCount} compras · {data.sellCount} ventas
        </span>
      </div>

      {/* Transactions table */}
      <Card className="p-6 bg-card border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Transacciones Recientes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 pr-4">Nombre</th>
                <th className="text-left py-2 px-4">Cargo</th>
                <th className="text-left py-2 px-4">Fecha</th>
                <th className="text-right py-2 px-4">Acciones</th>
                <th className="text-right py-2 px-4">Valor</th>
                <th className="text-center py-2 pl-4">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((tx, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2.5 pr-4 max-w-[200px] truncate">{tx.name}</td>
                  <td className="py-2.5 px-4 text-muted-foreground max-w-[150px] truncate">{tx.position}</td>
                  <td className="py-2.5 px-4 font-mono-numbers">
                    {tx.date ? new Date(tx.date + 'T00:00:00').toLocaleDateString('es-AR') : 'N/A'}
                  </td>
                  <td className="text-right py-2.5 px-4 font-mono-numbers">
                    {formatLargeNumber(Math.abs(tx.shares))}
                  </td>
                  <td className="text-right py-2.5 px-4 font-mono-numbers">
                    {tx.value != null ? `$${formatLargeNumber(tx.value)}` : 'N/A'}
                  </td>
                  <td className="text-center py-2.5 pl-4">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        tx.type === 'buy'
                          ? 'bg-green-600/20 text-green-400 border-green-600/30'
                          : tx.type === 'sell'
                          ? 'bg-red-600/20 text-red-400 border-red-600/30'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {tx.type === 'buy' ? 'Compra' : tx.type === 'sell' ? 'Venta' : 'Otro'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
