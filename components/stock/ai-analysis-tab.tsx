'use client'

import { useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Sparkles, RefreshCw } from 'lucide-react'

export function AIAnalysisTab({ ticker, type = 'stock' }: { ticker: string; type?: 'stock' | 'crypto' }) {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalysis = useCallback(async (refresh = false) => {
    setIsLoading(true)
    setError(null)
    setAnalysis('')

    try {
      const url = `/api/analyze/${ticker}?type=${type}${refresh ? '&refresh=true' : ''}`
      const res = await fetch(url)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error desconocido' }))
        throw new Error(err.error || 'Error al generar análisis')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream no disponible')

      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk
        setAnalysis(fullText)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }, [ticker, type])

  // Detect verdict
  let verdictType: 'favorable' | 'neutral' | 'desfavorable' | null = null
  if (analysis) {
    if (analysis.includes('**MOMENTO FAVORABLE**')) verdictType = 'favorable'
    else if (analysis.includes('**MOMENTO DESFAVORABLE**')) verdictType = 'desfavorable'
    else if (analysis.includes('**NEUTRAL**')) verdictType = 'neutral'
  }

  return (
    <div className="space-y-4">
      {!analysis && !isLoading && !error && (
        <Card className="p-8 bg-card border-border text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h3 className="text-lg font-semibold mb-2">Análisis con Inteligencia Artificial</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Obtené un análisis completo de {ticker} generado por IA, incluyendo técnico, fundamental y veredicto.
          </p>
          <button
            onClick={() => fetchAnalysis(false)}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Analizar con IA
          </button>
        </Card>
      )}

      {isLoading && !analysis && (
        <Card className="p-6 bg-card border-border space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Generando análisis con IA...</span>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-[90%]" />
          <Skeleton className="h-4 w-[95%]" />
          <Skeleton className="h-4 w-[80%]" />
          <Skeleton className="h-4 w-[85%]" />
        </Card>
      )}

      {error && (
        <Card className="p-6 bg-card border-border">
          <p className="text-red mb-4">{error}</p>
          <button
            onClick={() => fetchAnalysis(false)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
          >
            Reintentar
          </button>
        </Card>
      )}

      {analysis && (
        <div className="space-y-4">
          {/* Verdict badge */}
          {verdictType && (
            <div className="flex justify-center">
              <VerdictBadge type={verdictType} />
            </div>
          )}

          {/* Analysis content */}
          <Card className="p-6 bg-card border-border">
            <div className="prose prose-invert prose-sm max-w-none">
              <MarkdownRenderer content={analysis} />
            </div>
            {isLoading && (
              <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
            )}
          </Card>

          {/* Regenerate button */}
          {!isLoading && (
            <div className="flex justify-center">
              <button
                onClick={() => fetchAnalysis(true)}
                className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerar análisis
              </button>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-muted-foreground text-center italic">
            Este análisis es generado por IA con fines informativos y no constituye asesoramiento financiero.
            Consultá a un asesor certificado antes de tomar decisiones de inversión.
          </p>
        </div>
      )}
    </div>
  )
}

function VerdictBadge({ type }: { type: 'favorable' | 'neutral' | 'desfavorable' }) {
  const config = {
    favorable: { label: 'MOMENTO FAVORABLE', bg: 'bg-[#00c896]/15', border: 'border-[#00c896]/40', text: 'text-[#00c896]', dot: 'bg-[#00c896]' },
    neutral: { label: 'NEUTRAL', bg: 'bg-[#f59e0b]/15', border: 'border-[#f59e0b]/40', text: 'text-[#f59e0b]', dot: 'bg-[#f59e0b]' },
    desfavorable: { label: 'MOMENTO DESFAVORABLE', bg: 'bg-[#ff4757]/15', border: 'border-[#ff4757]/40', text: 'text-[#ff4757]', dot: 'bg-[#ff4757]' },
  }

  const c = config[type]

  return (
    <div className={`px-6 py-3 rounded-xl border-2 ${c.bg} ${c.border} flex items-center gap-3`}>
      <span className={`w-3 h-3 rounded-full ${c.dot} animate-pulse`} />
      <span className={`font-bold text-lg tracking-wide ${c.text}`}>{c.label}</span>
    </div>
  )
}

function MarkdownRenderer({ content }: { content: string }) {
  // Simple markdown renderer for the AI analysis
  const lines = content.split('\n')

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-lg font-bold text-foreground mt-6 mb-2 border-b border-border pb-2">
              {line.replace('## ', '')}
            </h2>
          )
        }
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-xl font-bold text-foreground mt-4 mb-2">{line.replace('# ', '')}</h1>
        }
        // Horizontal rule
        if (line.trim() === '---') {
          return <hr key={i} className="border-border my-4" />
        }
        // Bold text
        if (line.includes('**MOMENTO FAVORABLE**')) {
          return null // handled by badge
        }
        if (line.includes('**NEUTRAL**')) {
          return null
        }
        if (line.includes('**MOMENTO DESFAVORABLE**')) {
          return null
        }
        // Italic (disclaimer)
        if (line.startsWith('*') && line.endsWith('*')) {
          return null // handled by disclaimer section
        }
        // Bullet points
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-primary mt-1.5 shrink-0">•</span>
              <span className="text-foreground/90">{renderInlineMarkdown(line.replace(/^[-*] /, ''))}</span>
            </div>
          )
        }
        // Numbered list
        if (/^\d+\. /.test(line)) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-primary shrink-0 font-mono-numbers">{line.match(/^\d+/)?.[0]}.</span>
              <span className="text-foreground/90">{renderInlineMarkdown(line.replace(/^\d+\. /, ''))}</span>
            </div>
          )
        }
        // Empty line
        if (line.trim() === '') {
          return <div key={i} className="h-2" />
        }
        // Regular paragraph
        return (
          <p key={i} className="text-foreground/90 leading-relaxed">
            {renderInlineMarkdown(line)}
          </p>
        )
      })}
    </div>
  )
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Handle bold (**text**)
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    return part
  })
}
