'use client'

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { AnalystRecommendation } from '@/lib/types'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface RecommendationsResponse {
  recommendations: AnalystRecommendation[]
  consensus: string
  totalAnalysts: number
}

function consensusColor(consensus: string) {
  if (consensus.includes('Compra')) return 'bg-green-600/20 text-green-400 border-green-600/30'
  if (consensus.includes('Mantener')) return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
  if (consensus.includes('Vender') || consensus.includes('Venta')) return 'bg-red-600/20 text-red-400 border-red-600/30'
  return 'bg-muted text-muted-foreground'
}

export function RecommendationsSection({ ticker }: { ticker: string }) {
  const { data, isLoading } = useQuery<RecommendationsResponse>({
    queryKey: ['stock-recommendations', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/recommendations`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!data || !data.recommendations || data.recommendations.length === 0) {
    return (
      <Card className="p-6 bg-card border-border text-center text-muted-foreground">
        No hay datos de analistas disponibles para {ticker}.
      </Card>
    )
  }

  const latest = data.recommendations[0]
  const distributionData = [
    { name: 'Compra Fuerte', value: latest.strongBuy, fill: '#00c896' },
    { name: 'Compra', value: latest.buy, fill: '#4ade80' },
    { name: 'Mantener', value: latest.hold, fill: '#facc15' },
    { name: 'Vender', value: latest.sell, fill: '#f97316' },
    { name: 'Venta Fuerte', value: latest.strongSell, fill: '#ff4757' },
  ]

  const historyData = data.recommendations.slice(0, 4).reverse().map((rec) => ({
    period: rec.period.slice(0, 7), // YYYY-MM
    'Compra Fuerte': rec.strongBuy,
    Compra: rec.buy,
    Mantener: rec.hold,
    Vender: rec.sell,
    'Venta Fuerte': rec.strongSell,
  }))

  return (
    <div className="space-y-6">
      {/* Consensus header */}
      <div className="flex items-center gap-4">
        <Badge variant="outline" className={`text-base px-4 py-1.5 ${consensusColor(data.consensus)}`}>
          {data.consensus}
        </Badge>
        <span className="text-sm text-muted-foreground">
          Basado en {data.totalAnalysts} analistas
        </span>
      </div>

      {/* Current distribution */}
      <Card className="p-6 bg-card border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Distribución Actual
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={distributionData} layout="vertical">
            <XAxis type="number" stroke="#666" fontSize={12} />
            <YAxis type="category" dataKey="name" stroke="#666" fontSize={12} width={100} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1a1a1f', border: '1px solid #2a2a35', borderRadius: 8 }}
              labelStyle={{ color: '#fff' }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Historical trends */}
      {historyData.length > 1 && (
        <Card className="p-6 bg-card border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Tendencia Histórica
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={historyData}>
              <XAxis dataKey="period" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1a1a1f', border: '1px solid #2a2a35', borderRadius: 8 }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Bar dataKey="Compra Fuerte" stackId="a" fill="#00c896" />
              <Bar dataKey="Compra" stackId="a" fill="#4ade80" />
              <Bar dataKey="Mantener" stackId="a" fill="#facc15" />
              <Bar dataKey="Vender" stackId="a" fill="#f97316" />
              <Bar dataKey="Venta Fuerte" stackId="a" fill="#ff4757" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
