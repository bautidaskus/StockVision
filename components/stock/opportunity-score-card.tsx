'use client'

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { OpportunityScore } from '@/lib/types'

const PILLAR_LABELS = {
  valuation: 'Valuation',
  quality: 'Quality',
  momentum: 'Momentum',
  events: 'Events',
} as const

function ratingClass(rating: OpportunityScore['rating']) {
  switch (rating) {
    case 'Muy atractiva':
      return 'bg-green-600/20 text-green-400 border-green-600/30'
    case 'Atractiva':
      return 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30'
    case 'Neutral':
      return 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30'
    case 'Débil':
      return 'bg-orange-600/20 text-orange-400 border-orange-600/30'
    case 'Evitar':
      return 'bg-red-600/20 text-red-400 border-red-600/30'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

export function OpportunityScoreCard({ ticker }: { ticker: string }) {
  const { data, isLoading, error } = useQuery<OpportunityScore>({
    queryKey: ['stock-score', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/score`)
      if (!res.ok) throw new Error('Failed to fetch score')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card className="p-5 bg-card border-border">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-16 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (error || !data) {
    return (
      <Card className="p-5 bg-card border-border">
        <p className="text-sm text-muted-foreground">No se pudo calcular el Opportunity Score para {ticker}.</p>
      </Card>
    )
  }

  return (
    <Card className="p-5 bg-card border-border space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opportunity Score</div>
          <div className="flex items-end gap-3">
            <div className="text-5xl font-bold font-mono-numbers">
              {data.overall != null ? data.overall : 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground pb-1">/100</div>
          </div>
          <Badge variant="outline" className={ratingClass(data.rating)}>
            {data.rating}
          </Badge>
          <p className="text-xs text-muted-foreground">
            Confianza {data.confidence}% · actualizado {new Date(data.asOfDate + 'T00:00:00').toLocaleDateString('es-AR')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(data.pillars).map(([key, pillar]) => (
            <div key={key} className="rounded-lg border border-border p-3 bg-secondary/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{PILLAR_LABELS[key as keyof typeof PILLAR_LABELS]}</span>
                <span className="font-mono-numbers text-sm">
                  {pillar.score != null ? pillar.score : 'N/A'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden mb-2">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${pillar.score ?? 0}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {pillar.signals.slice(0, 2).map((signal) => `${signal.label}: ${signal.value}`).join(' · ') || 'Sin señales suficientes'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {data.summary.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lectura rápida</div>
          <div className="flex flex-wrap gap-2">
            {data.summary.map((item) => (
              <Badge key={item} variant="secondary" className="text-xs">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
