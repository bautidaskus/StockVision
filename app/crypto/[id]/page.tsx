'use client'

import { useParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CryptoHeader } from '@/components/crypto/crypto-header'
import { CryptoChart } from '@/components/crypto/crypto-chart'
import { AIAnalysisTab } from '@/components/stock/ai-analysis-tab'
import { Card } from '@/components/ui/card'
import { LineChart, Sparkles } from 'lucide-react'

export default function CryptoPage() {
  const params = useParams()
  const rawId = params?.id
  const id = typeof rawId === 'string'
    ? rawId
    : Array.isArray(rawId)
    ? rawId[0] || ''
    : ''

  if (!id) {
    return (
      <Card className="p-6 bg-card border-border text-center text-muted-foreground">
        No se pudo resolver el identificador del activo.
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <CryptoHeader id={id} />

      <Tabs defaultValue="chart" className="w-full flex-col">
        <TabsList className="bg-card border border-border w-full justify-start">
          <TabsTrigger value="chart" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <LineChart className="w-4 h-4" />
            Gráfico
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Sparkles className="w-4 h-4" />
            Análisis IA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="mt-4">
          <CryptoChart id={id} />
        </TabsContent>

        <TabsContent value="analysis" className="mt-4">
          <AIAnalysisTab ticker={id} type="crypto" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
