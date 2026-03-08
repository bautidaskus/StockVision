'use client'

import { useParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StockHeader } from '@/components/stock/stock-header'
import { CandlestickChart } from '@/components/stock/candlestick-chart'
import { FundamentalsTab } from '@/components/stock/fundamentals-tab'
import { AIAnalysisTab } from '@/components/stock/ai-analysis-tab'
import { NewsSection } from '@/components/stock/news-section'
import { BarChart3, LineChart, Sparkles, Newspaper } from 'lucide-react'

export default function StockPage() {
  const params = useParams()
  const ticker = (params.ticker as string).toUpperCase()

  return (
    <div className="space-y-6">
      <StockHeader ticker={ticker} />

      <Tabs defaultValue="chart" className="w-full flex-col">
        <TabsList className="bg-card border border-border w-full justify-start">
          <TabsTrigger value="chart" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <LineChart className="w-4 h-4" />
            Gráfico
          </TabsTrigger>
          <TabsTrigger value="fundamentals" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="w-4 h-4" />
            Fundamentales
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
