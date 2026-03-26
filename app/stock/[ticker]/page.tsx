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
import { BarChart3, LineChart, Sparkles, Newspaper, Users, CalendarDays, UserCheck } from 'lucide-react'

export default function StockPage() {
  const params = useParams()
  const ticker = (params.ticker as string).toUpperCase()

  return (
    <div className="space-y-6">
      <StockHeader ticker={ticker} />
      <OpportunityScoreCard ticker={ticker} />

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
          <CandlestickChart ticker={ticker} />
        </TabsContent>

        <TabsContent value="fundamentals" className="mt-4">
          <FundamentalsTab ticker={ticker} />
        </TabsContent>

        <TabsContent value="analysts" className="mt-4">
          <RecommendationsSection ticker={ticker} />
        </TabsContent>

        <TabsContent value="earnings" className="mt-4">
          <EarningsSection ticker={ticker} />
        </TabsContent>

        <TabsContent value="insiders" className="mt-4">
          <InsidersSection ticker={ticker} />
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          <AIAnalysisTab ticker={ticker} type="stock" />
        </TabsContent>

        <TabsContent value="news" className="mt-4">
          <NewsSection ticker={ticker} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
