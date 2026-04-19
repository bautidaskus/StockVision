'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
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
import { Card } from '@/components/design/primitives'

const TABS = [
  { id: 'chart', label: 'Gráfico' },
  { id: 'fundamentals', label: 'Fundamentales' },
  { id: 'analysts', label: 'Analistas' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'insiders', label: 'Insiders' },
  { id: 'analysis', label: 'Análisis IA' },
  { id: 'news', label: 'Noticias' },
] as const

type TabId = typeof TABS[number]['id']

export default function StockPage() {
  const params = useParams()
  const rawTicker = params?.ticker
  const ticker = typeof rawTicker === 'string'
    ? rawTicker.toUpperCase()
    : Array.isArray(rawTicker)
    ? rawTicker[0]?.toUpperCase() || ''
    : ''
  const [tab, setTab] = useState<TabId>('chart')

  if (!ticker) {
    return (
      <Card className="card-pad" style={{ textAlign: 'center', color: 'var(--fg-subtle)' }}>
        No se pudo resolver el ticker de la acción.
      </Card>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2" style={{ fontSize: 12.5, marginBottom: 12 }}>
        <Link href="/" className="muted" style={{ textDecoration: 'none' }}>Home</Link>
        <span className="faint">/</span>
        <span className="muted">Stocks</span>
        <span className="faint">/</span>
        <span>{ticker}</span>
      </div>

      <ClientErrorBoundary title="No se pudo renderizar el encabezado de la acción.">
        <StockHeader ticker={ticker} />
      </ClientErrorBoundary>

      <div style={{ marginTop: 16 }}>
        <ClientErrorBoundary title="No se pudo renderizar el Opportunity Score.">
          <OpportunityScoreCard ticker={ticker} />
        </ClientErrorBoundary>
      </div>

      <div className="sv-tabs" style={{ marginTop: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`sv-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'chart' && (
        <ClientErrorBoundary title="No se pudo renderizar el gráfico.">
          <CandlestickChart ticker={ticker} />
        </ClientErrorBoundary>
      )}
      {tab === 'fundamentals' && (
        <ClientErrorBoundary title="No se pudo renderizar fundamentales.">
          <FundamentalsTab ticker={ticker} />
        </ClientErrorBoundary>
      )}
      {tab === 'analysts' && (
        <ClientErrorBoundary title="No se pudo renderizar analistas.">
          <RecommendationsSection ticker={ticker} />
        </ClientErrorBoundary>
      )}
      {tab === 'earnings' && (
        <ClientErrorBoundary title="No se pudo renderizar earnings.">
          <EarningsSection ticker={ticker} />
        </ClientErrorBoundary>
      )}
      {tab === 'insiders' && (
        <ClientErrorBoundary title="No se pudo renderizar insiders.">
          <InsidersSection ticker={ticker} />
        </ClientErrorBoundary>
      )}
      {tab === 'analysis' && (
        <ClientErrorBoundary title="No se pudo renderizar IA.">
          <AIAnalysisTab ticker={ticker} type="stock" />
        </ClientErrorBoundary>
      )}
      {tab === 'news' && (
        <ClientErrorBoundary title="No se pudo renderizar noticias.">
          <NewsSection ticker={ticker} />
        </ClientErrorBoundary>
      )}
    </div>
  )
}
