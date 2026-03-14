'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { formatCurrency, formatLargeNumber, formatPercent, colorForValue } from '@/lib/format'
import type { ScreenerResult } from '@/lib/types'

type SortKey = keyof Pick<ScreenerResult, 'ticker' | 'marketCap' | 'price' | 'pe' | 'beta' | 'dividendYield' | 'changePercent'>
type SortDir = 'asc' | 'desc'

interface Column {
  key: SortKey
  label: string
  sortable: boolean
  align: 'left' | 'right'
}

const COLUMNS: Column[] = [
  { key: 'ticker',        label: 'Ticker',    sortable: true, align: 'left'  },
  { key: 'price',         label: 'Precio',    sortable: true, align: 'right' },
  { key: 'changePercent', label: 'Cambio %',  sortable: true, align: 'right' },
  { key: 'marketCap',     label: 'Mkt Cap',   sortable: true, align: 'right' },
  { key: 'pe',            label: 'P/E',       sortable: true, align: 'right' },
  { key: 'beta',          label: 'Beta',      sortable: true, align: 'right' },
  { key: 'dividendYield', label: 'Div Yield', sortable: true, align: 'right' },
]

interface ScreenerResultsProps {
  results: ScreenerResult[] | undefined
  isLoading: boolean
  error: Error | null
}

export function ScreenerResults({ results, isLoading, error }: ScreenerResultsProps) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('marketCap')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = results
    ? [...results].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        // Nulls siempre al final
        if (av == null) return 1
        if (bv == null) return -1
        if (typeof av === 'string') {
          return sortDir === 'asc'
            ? av.localeCompare(bv as string)
            : (bv as string).localeCompare(av)
        }
        return sortDir === 'asc'
          ? (av as number) - (bv as number)
          : (bv as number) - (av as number)
      })
    : []

  if (error) {
    return (
      <Card className="p-8 bg-card border-border text-center text-muted-foreground">
        <p className="text-red-400 mb-1">Error al buscar resultados</p>
        <p className="text-sm">{error.message}</p>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (!results || results.length === 0) {
    return (
      <Card className="p-12 bg-card border-border text-center text-muted-foreground">
        <p className="text-lg mb-1">Sin resultados</p>
        <p className="text-sm">Probá ajustar los filtros o usar un preset distinto.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {/* Contador */}
      <p className="text-sm text-muted-foreground">
        {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
      </p>

      {/* Tabla */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    } ${col.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''}`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                      {col.align === 'right' && <SortIcon column={col.key} sortKey={sortKey} sortDir={sortDir} />}
                      {col.label}
                      {col.align === 'left' && <SortIcon column={col.key} sortKey={sortKey} sortDir={sortDir} />}
                    </span>
                  </th>
                ))}
                {/* Columna extra: sector (no ordenable) */}
                <th className="py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-left">
                  Sector
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, i) => (
                <tr
                  key={item.ticker}
                  className={`border-b border-border/50 cursor-pointer hover:bg-secondary/30 transition-colors ${
                    i % 2 === 0 ? '' : 'bg-secondary/10'
                  }`}
                  onClick={() => router.push(`/stock/${item.ticker}`)}
                >
                  <td className="py-3 px-4">
                    <div className="font-mono-numbers font-semibold">{item.ticker}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[160px]">{item.name}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono-numbers">
                    {formatCurrency(item.price)}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono-numbers ${colorForValue(item.changePercent)}`}>
                    {formatPercent(item.changePercent)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-numbers text-muted-foreground">
                    ${formatLargeNumber(item.marketCap)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-numbers">
                    {item.pe != null ? item.pe.toFixed(1) : <span className="text-muted-foreground">N/A</span>}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-numbers">
                    {item.beta != null ? item.beta.toFixed(2) : <span className="text-muted-foreground">N/A</span>}
                  </td>
                  <td className={`py-3 px-4 text-right font-mono-numbers ${item.dividendYield ? 'text-green' : ''}`}>
                    {item.dividendYield != null && item.dividendYield > 0
                      ? `${(item.dividendYield * 100).toFixed(2)}%`
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                      {item.sector !== 'N/A' ? item.sector : '—'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (column !== sortKey) {
    return <ArrowUpDown className="w-3 h-3 opacity-40" />
  }
  return sortDir === 'asc'
    ? <ArrowUp className="w-3 h-3 text-primary" />
    : <ArrowDown className="w-3 h-3 text-primary" />
}
