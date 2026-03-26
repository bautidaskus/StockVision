'use client'

import { useParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StockHeader } from '@/components/stock/stock-header'
import { OpportunityScoreCard } from '@/components/stock/opportunity-score-card'
import { CandlestickChart } from '@/components/stock/candlestick-chart'
import { FundamentalsTab } from '@/components/stock/fundamentals-tab'
import { RecommendationsSection } from '@/components/stock/recommendations-section'
import { EarningsSection } from '@/components/stock/earnings-section'
import { InsidersSection } from '@/components/stock/insiders-section'
import { AIAnalysisTab } from '@/components/stock/ai-analysis-tab'
import { NewsSection } from '@/components/stock/news-section'
import { ClientErrorBoundary } from '@/components/client-error-boundary'
import { Card } from '@/components/ui/card'
import { BarChart3, LineChart, Sparkles, Newspaper, Users, CalendarDays, UserCheck } from 'lucide-react'

export default function StockPage() {
  const params = useParams()
  const rawTicker = params?.ticker
  const ticker = typeof rawTicker === 'string'
    ? rawTicker.toUpperCase()
    : Array.isArray(rawTicker)
    ? rawTicker[0]?.toUpperCase() || ''
    : ''

  if (!ticker) {
    return (
      <Card className="p-6 bg-card border-border text-center text-muted-foreground">
        No se pudo resolver el ticker de la acción.
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <ClientErrorBoundary title="No se pudo renderizar el encabezado de la acción.">
        <StockHeader ticker={ticker} />
      </ClientErrorBoundary>
      <ClientErrorBoundary title="No se pudo renderizar el Opportunity Score.">
        <OpportunityScoreCard ticker={ticker} />
      </ClientErrorBoundary>

      <Tabs defaultValue="chart" className="w-full flex-col">
        <TabsList className="bg-card border border-border w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="chart" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <LineChart className="w-4 h-4" />
            Gráfico
          </TabsTrigger>
          <TabsTrigger value="fundamentals" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="w-4 h-4" />
            Fundamentales
          </TabsTrigger>
          <TabsTrigger value="analysts" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4" />
            Analistas
          </TabsTrigger>
          <TabsTrigger value="earnings" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CalendarDays className="w-4 h-4" />
            Earnings
          </TabsTrigger>
          <TabsTrigger value="insiders" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <UserCheck className="w-4 h-4" />
            Insiders
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Sparkles className="w-4 h-4" />
            Análisis IA
          </TabsTrigger>
          <TabsTrigger value="news" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Newspaper className="w-4 h-4" />
            Noticias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="mt-4">
          <ClientErrorBoundary title="No se pudo renderizar el gráfico de la acción.">
            <CandlestickChart ticker={ticker} />
          </ClientErrorBoundary>
        </TabsContent>

        <TabsContent value="fundamentals" className="mt-4">
          <ClientErrorBoundary title="No se pudo renderizar la pestaña de fundamentales.">
            <FundamentalsTab ticker={ticker} />
          </ClientErrorBoundary>
        </TabsContent>

        <TabsContent value="analysts" className="mt-4">
          <ClientErrorBoundary title="No se pudo renderizar la sección de analistas.">
            <RecommendationsSection ticker={ticker} />
          </ClientErrorBoundary>
        </TabsContent>

        <TabsContent value="earnings" className="mt-4">
          <ClientErrorBoundary title="No se pudo renderizar la sección de earnings.">
            <EarningsSection ticker={ticker} />
          </ClientErrorBoundary>
        </TabsContent>

        <TabsContent value="insiders" className="mt-4">
          <ClientErrorBoundary title="No se pudo renderizar la sección de insiders.">
            <InsidersSection ticker={ticker} />
          </ClientErrorBoundary>
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          <ClientErrorBoundary title="No se pudo renderizar el análisis IA.">
            <AIAnalysisTab ticker={ticker} type="stock" />
          </ClientErrorBoundary>
        </TabsContent>

        <TabsContent value="news" className="mt-4">
          <ClientErrorBoundary title="No se pudo renderizar la sección de noticias.">
            <NewsSection ticker={ticker} />
          </ClientErrorBoundary>
        </TabsContent>
      </Tabs>
    </div>
  )
}
