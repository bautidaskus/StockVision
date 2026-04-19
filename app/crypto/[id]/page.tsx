'use client'

import { useParams } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'
import { CryptoHeader } from '@/components/crypto/crypto-header'
import { CryptoChart } from '@/components/crypto/crypto-chart'
import { AIAnalysisTab } from '@/components/stock/ai-analysis-tab'
import { Card } from '@/components/design/primitives'

const TABS = [
  { id: 'chart', label: 'Gráfico' },
  { id: 'analysis', label: 'Análisis IA' },
] as const

type TabId = typeof TABS[number]['id']

export default function CryptoPage() {
  const params = useParams()
  const rawId = params?.id
  const id = typeof rawId === 'string'
    ? rawId
    : Array.isArray(rawId)
    ? rawId[0] || ''
    : ''
  const [tab, setTab] = useState<TabId>('chart')

  if (!id) {
    return (
      <Card className="card-pad" style={{ textAlign: 'center', color: 'var(--fg-subtle)' }}>
        No se pudo resolver el identificador del activo.
      </Card>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2" style={{ fontSize: 12.5, marginBottom: 12 }}>
        <Link href="/" className="muted" style={{ textDecoration: 'none' }}>Home</Link>
        <span className="faint">/</span>
        <span className="muted">Crypto</span>
        <span className="faint">/</span>
        <span>{id}</span>
      </div>

      <CryptoHeader id={id} />

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

      {tab === 'chart' && <CryptoChart id={id} />}
      {tab === 'analysis' && <AIAnalysisTab ticker={id} type="crypto" />}
    </div>
  )
}
