'use client'

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink } from 'lucide-react'
import { StaggerContainer, StaggerItem } from '@/components/motion/stagger-container'
import type { NewsItem } from '@/lib/types'

export function NewsSection({ ticker }: { ticker: string }) {
  const { data: news, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['stock-news', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/news`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    )
  }

  if (!news || !Array.isArray(news) || news.length === 0) {
    return (
      <Card className="p-6 bg-card border-border text-center text-muted-foreground">
        No hay noticias recientes disponibles para {ticker}.
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Noticias Recientes</h3>
      <StaggerContainer className="space-y-2">
        {news.map((item, i) => (
          <StaggerItem key={i}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="p-4 bg-card border-border hover:border-primary/30 transition-colors group">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                      {item.headline}
                    </h4>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <span>{item.source}</span>
                      <span>•</span>
                      <span>{new Date(item.datetime * 1000).toLocaleDateString('es-AR')}</span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </Card>
            </a>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </div>
  )
}
