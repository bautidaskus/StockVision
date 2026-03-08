'use client'

import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency, formatLargeNumber, formatQuarter } from '@/lib/format'
import type { StockOverview } from '@/lib/types'

export function FundamentalsTab({ ticker }: { ticker: string }) {
  const { data: overview } = useQuery<StockOverview>({
    queryKey: ['stock-overview', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/overview`)
      return res.json()
    },
  })

  const { data: financials, isLoading } = useQuery({
    queryKey: ['stock-financials', ticker],
    queryFn: async () => {
      const res = await fetch(`/api/stock/${ticker}/financials?period=quarterly&limit=8`)
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json()
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-[300px]" />
      </div>
    )
  }

  const statements = financials?.statements || []
  const latestStatement = statements[0] || {}

  // Revenue + Net Income chart data (reverse for chronological order)
  const revenueChartData = [...statements].reverse().map((s: Record<string, unknown>) => ({
    quarter: formatQuarter(s.date as string),
    Revenue: Number(s.revenue) || 0,
    'Net Income': Number(s.netIncome) || 0,
  }))

  // EPS chart data
  const epsChartData = [...statements].reverse().map((s: Record<string, unknown>) => ({
    quarter: formatQuarter(s.date as string),
    EPS: Number(s.epsDiluted) || 0,
  }))

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#1a1a1f',
      border: '1px solid #2a2a35',
      borderRadius: '8px',
      color: '#e4e4e7',
      fontSize: '12px',
    },
  }

  return (
    <div className="space-y-6">
      {/* Valuation Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Valuación</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="P/E" value={overview?.pe?.toFixed(2) ?? 'N/A'} />
          <MetricCard label="Forward P/E" value={overview?.forwardPe?.toFixed(2) ?? 'N/A'} />
          <MetricCard label="EV/EBITDA" value={overview?.evToEbitda?.toFixed(2) ?? 'N/A'} />
          <MetricCard label="P/S" value={overview?.priceToSales?.toFixed(2) ?? 'N/A'} />
          <MetricCard label="P/B" value={overview?.priceToBook?.toFixed(2) ?? 'N/A'} />
          <MetricCard label="PEG" value={overview?.pegRatio?.toFixed(2) ?? 'N/A'} />
        </div>
      </div>

      {/* Financial Health */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Salud Financiera</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard
            label="Margen Bruto"
            value={latestStatement.grossProfitRatio ? `${(Number(latestStatement.grossProfitRatio) * 100).toFixed(1)}%` : 'N/A'}
          />
          <MetricCard
            label="Margen Neto"
            value={latestStatement.netIncomeRatio ? `${(Number(latestStatement.netIncomeRatio) * 100).toFixed(1)}%` : 'N/A'}
          />
          <MetricCard
            label="ROE"
            value={latestStatement.roe != null ? `${(Number(latestStatement.roe) * 100).toFixed(1)}%` : 'N/A'}
          />
          <MetricCard
            label="ROA"
            value={latestStatement.roa != null ? `${(Number(latestStatement.roa) * 100).toFixed(1)}%` : 'N/A'}
          />
          <MetricCard
            label="Deuda/Capital"
            value={latestStatement.debtToEquity != null ? Number(latestStatement.debtToEquity).toFixed(2) : 'N/A'}
          />
        </div>
      </div>

      {/* Growth */}
      {statements.length >= 4 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Crecimiento YoY</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="Revenue YoY"
              value={calcYoY(statements[0]?.revenue, statements[3]?.revenue)}
              colored
            />
            <MetricCard
              label="Net Income YoY"
              value={calcYoY(statements[0]?.netIncome, statements[3]?.netIncome)}
              colored
            />
            <MetricCard
              label="EPS YoY"
              value={calcYoY(statements[0]?.epsDiluted, statements[3]?.epsDiluted)}
              colored
            />
            <MetricCard
              label="FCF YoY"
              value={calcYoY(statements[0]?.freeCashFlow, statements[3]?.freeCashFlow)}
              colored
            />
          </div>
        </div>
      )}

      {/* Revenue & Net Income Chart */}
      {revenueChartData.length > 0 && (
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Revenue & Net Income (Trimestral)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis dataKey="quarter" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `$${formatLargeNumber(v)}`} />
              <Tooltip
                {...tooltipStyle}
                formatter={(value) => [`$${formatLargeNumber(Number(value))}`, undefined]}
              />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#71717a' }} />
              <Bar dataKey="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net Income" fill="#00c896" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* EPS Chart */}
      {epsChartData.length > 0 && (
        <Card className="p-4 bg-card border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">EPS (Trimestral)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={epsChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
              <XAxis dataKey="quarter" tick={{ fill: '#71717a', fontSize: 11 }} />
              <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
              <Tooltip
                {...tooltipStyle}
                formatter={(value) => [formatCurrency(Number(value)), 'EPS']}
              />
              <Bar dataKey="EPS" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}

function MetricCard({ label, value, colored }: { label: string; value: string; colored?: boolean }) {
  let colorClass = ''
  if (colored && value !== 'N/A') {
    const num = parseFloat(value)
    if (!isNaN(num)) {
      colorClass = num > 0 ? 'text-green' : num < 0 ? 'text-red' : ''
    }
  }

  return (
    <Card className="p-3 bg-card border-border">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`font-mono-numbers font-semibold text-lg ${colorClass}`}>{value}</div>
    </Card>
  )
}

function calcYoY(current: unknown, previous: unknown): string {
  const curr = Number(current)
  const prev = Number(previous)
  if (!prev || isNaN(curr) || isNaN(prev)) return 'N/A'
  const pct = ((curr - prev) / Math.abs(prev)) * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
}
