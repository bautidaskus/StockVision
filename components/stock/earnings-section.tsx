'use client'

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarDays } from 'lucide-react'
import { formatQuarter } from '@/lib/format'
import type { EarningsData } from '@/lib/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts'

export function EarningsSection({ ticker }: { ticker: string }) {
  const { data, isLoading } = useQuery<EarningsData>({
    queryKey: ['stock-earnings', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/earnings`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!data || (!data.nextEarningsDate && data.earningsHistory.length === 0)) {
    return (
      <Card className="p-6 bg-card border-border text-center text-muted-foreground">
        No hay datos de earnings disponibles para {ticker}.
      </Card>
    )
  }

  const chartData = [...data.earningsHistory].reverse().map((item) => ({
    quarter: item.date ? formatQuarter(item.date) : 'N/A',
    'EPS Estimado': item.epsEstimate,
    'EPS Real': item.epsActual,
    beat: item.epsActual != null && item.epsEstimate != null
      ? item.epsActual >= item.epsEstimate
      : null,
  }))

  return (
    <div className="space-y-6">
      {/* Next earnings date */}
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <CalendarDays className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Próximo Earnings</p>
            <p className="text-lg font-semibold font-mono-numbers">
              {data.nextEarningsDate
                ? new Date(data.nextEarningsDate + 'T00:00:00').toLocaleDateString('es-AR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'No disponible'}
            </p>
          </div>
        </div>
      </Card>

      {/* EPS history chart */}
      {chartData.length > 0 && (
        <Card className="p-6 bg-card border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Historial de EPS
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} barGap={4}>
              <XAxis dataKey="quarter" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1f', border: '1px solid #2a2a35', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
                formatter={(value) => [`$${Number(value)?.toFixed(2) ?? 'N/A'}`]}
              />
              <Legend />
              <Bar dataKey="EPS Estimado" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="EPS Real" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.beat === null ? '#666' : entry.beat ? '#00c896' : '#ff4757'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Surprise table */}
      {data.earningsHistory.length > 0 && (
        <Card className="p-6 bg-card border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Detalle de Sorpresas
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 pr-4">Trimestre</th>
                  <th className="text-right py-2 px-4">Estimado</th>
                  <th className="text-right py-2 px-4">Real</th>
                  <th className="text-right py-2 pl-4">Sorpresa</th>
                </tr>
              </thead>
              <tbody>
                {data.earningsHistory.map((item, i) => {
                  const beat = item.epsActual != null && item.epsEstimate != null
                    ? item.epsActual >= item.epsEstimate
                    : null
                  return (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2.5 pr-4">{item.date ? formatQuarter(item.date) : 'N/A'}</td>
                      <td className="text-right py-2.5 px-4 font-mono-numbers">
                        {item.epsEstimate != null ? `$${item.epsEstimate.toFixed(2)}` : 'N/A'}
                      </td>
                      <td className="text-right py-2.5 px-4 font-mono-numbers">
                        {item.epsActual != null ? `$${item.epsActual.toFixed(2)}` : 'N/A'}
                      </td>
                      <td className={`text-right py-2.5 pl-4 font-mono-numbers ${
                        beat === null ? '' : beat ? 'text-green' : 'text-red'
                      }`}>
                        {item.epsSurprisePercent != null
                          ? `${item.epsSurprisePercent >= 0 ? '+' : ''}${item.epsSurprisePercent.toFixed(1)}%`
                          : 'N/A'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
