'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Calendar } from 'lucide-react'
import { usePortfolio } from '@/lib/store/portfolio'
import { AddPositionDialog } from '@/components/add-position-dialog'
import { Card, SectionHead, SymbolMark, Flag, Eyebrow } from '@/components/design/primitives'
import type { BatchOverviewResponse, PortfolioPosition } from '@/lib/types'
import { formatCurrency } from '@/lib/format'

type SortKey = 'ticker' | 'quantity' | 'price' | 'value' | 'pl' | 'plPct'
type SortDir = 'asc' | 'desc'

type Enriched = PortfolioPosition & {
  price: number
  value: number
  cost: number
  pl: number
  plPct: number
}

export default function PortfolioPage() {
  const positions = usePortfolio((s) => s.positions)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<PortfolioPosition | null>(null)
  const [sort, setSort] = useState<{ k: SortKey; dir: SortDir }>({ k: 'value', dir: 'desc' })

  const tickers = useMemo(
    () =>
      Array.from(
        new Set(
          positions
            .filter((p) => p.type !== 'crypto')
            .map((p) => (p.underlying || p.ticker).toUpperCase()),
        ),
      )
        .sort()
        .join(','),
    [positions],
  )

  const { data: batch } = useQuery<BatchOverviewResponse>({
    queryKey: ['portfolio-batch', tickers],
    enabled: tickers.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/batch/overview?tickers=${tickers}`, { signal })
      if (!res.ok) throw new Error('batch failed')
      return res.json()
    },
  })

  const rows: Enriched[] = useMemo(() => {
    const list = positions.map((p) => {
      const key = (p.underlying || p.ticker).toUpperCase()
      const price = batch?.[key]?.overview?.price ?? p.averageCost
      const value = p.quantity * price
      const cost = p.quantity * p.averageCost
      const pl = value - cost
      const plPct = cost > 0 ? (pl / cost) * 100 : 0
      return { ...p, price, value, cost, pl, plPct }
    })
    list.sort((a, b) => {
      const av = a[sort.k as keyof Enriched] as number | string
      const bv = b[sort.k as keyof Enriched] as number | string
      if (av === bv) return 0
      return (av < bv ? 1 : -1) * (sort.dir === 'desc' ? 1 : -1)
    })
    return list
  }, [positions, batch, sort])

  const totals = useMemo(() => {
    const totalValue = rows.reduce((s, p) => s + p.value, 0)
    const totalCost = rows.reduce((s, p) => s + p.cost, 0)
    const totalPL = totalValue - totalCost
    const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0
    return { totalValue, totalCost, totalPL, totalPLPct }
  }, [rows])

  const allocation = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((p) => {
      const k = p.type === 'cedear' ? 'CEDEARs (AR)' : p.type === 'crypto' ? 'Crypto' : 'Stocks US'
      m.set(k, (m.get(k) || 0) + p.value)
    })
    return Array.from(m.entries()).map(([k, v]) => ({ k, v }))
  }, [rows])

  function setSortKey(k: SortKey) {
    setSort((s) => ({ k, dir: s.k === k && s.dir === 'desc' ? 'asc' : 'desc' }))
  }

  function handleAdd() {
    setEditingPosition(null)
    setDialogOpen(true)
  }

  function handleEdit(pos: PortfolioPosition) {
    setEditingPosition(pos)
    setDialogOpen(true)
  }

  return (
    <div>
      <SectionHead
        title="<em>Portfolio</em>"
        dangerouslyHtml
        sub="Análisis detallado de tus posiciones"
        right={
          <div className="flex gap-2">
            <button className="sv-btn sm"><Calendar size={12} /> Últimos 30d</button>
            <button className="sv-btn sm primary" onClick={handleAdd}><Plus size={13} /> Nueva posición</button>
          </div>
        }
      />

      {/* Top metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
        <Card className="card-pad">
          <Eyebrow>Valor total</Eyebrow>
          <div className="price-big" style={{ marginTop: 10 }}>{formatCurrency(totals.totalValue)}</div>
        </Card>
        <Card className="card-pad">
          <Eyebrow>P&amp;L no realizado</Eyebrow>
          <div className={`price-big ${totals.totalPL >= 0 ? 'pos' : 'neg'}`} style={{ marginTop: 10 }}>
            {totals.totalPL >= 0 ? '+' : ''}{formatCurrency(totals.totalPL)}
          </div>
          <div className={`mono ${totals.totalPL >= 0 ? 'pos' : 'neg'}`} style={{ marginTop: 8 }}>
            {totals.totalPLPct >= 0 ? '+' : ''}{totals.totalPLPct.toFixed(2)}% desde compra
          </div>
        </Card>
        <Card className="card-pad">
          <Eyebrow>Costo base</Eyebrow>
          <div className="price-big" style={{ marginTop: 10 }}>{formatCurrency(totals.totalCost)}</div>
          <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>{rows.length} posiciones</div>
        </Card>
        <Card className="card-pad">
          <Eyebrow>Distribución</Eyebrow>
          <div style={{ marginTop: 10 }}>
            {allocation.map((a) => {
              const pct = totals.totalValue > 0 ? (a.v / totals.totalValue) * 100 : 0
              return (
                <div key={a.k} className="flex items-center justify-between" style={{ fontSize: 12, marginBottom: 4 }}>
                  <span>{a.k}</span>
                  <span className="mono">{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-subtle)' }}>
            <p style={{ marginBottom: 8 }}>Todavía no cargaste posiciones.</p>
            <button className="sv-btn primary sm" onClick={handleAdd}>
              <Plus size={13} /> Agregar posición
            </button>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th onClick={() => setSortKey('ticker')}>Activo</th>
                <th className="r" onClick={() => setSortKey('quantity')}>Cantidad</th>
                <th className="r">Costo prom.</th>
                <th className="r" onClick={() => setSortKey('price')}>Precio</th>
                <th className="r" onClick={() => setSortKey('value')}>Valor</th>
                <th className="r" onClick={() => setSortKey('pl')}>P&amp;L</th>
                <th className="r" onClick={() => setSortKey('plPct')}>%</th>
                <th>% Portfolio</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pos) => {
                const pctP = totals.totalValue > 0 ? (pos.value / totals.totalValue) * 100 : 0
                const href = pos.type === 'crypto' ? `/crypto/${pos.ticker.toLowerCase()}` : `/stock/${pos.ticker}`
                return (
                  <tr className="row" key={pos.ticker}>
                    <td>
                      <Link href={href} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
                        <SymbolMark ticker={pos.ticker} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span style={{ fontWeight: 500 }}>{pos.ticker}</span>
                            {pos.type === 'cedear' && <Flag>CEDEAR{pos.ratio ? ` · ${pos.ratio}:1` : ''}</Flag>}
                            {pos.type === 'crypto' && <Flag>CRYPTO</Flag>}
                          </div>
                          <div className="subtle" style={{ fontSize: 11.5 }}>{pos.name}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="r mono">{pos.quantity < 10 ? pos.quantity.toFixed(4) : pos.quantity}</td>
                    <td className="r mono muted">{formatCurrency(pos.averageCost)}</td>
                    <td className="r mono">{formatCurrency(pos.price)}</td>
                    <td className="r mono">{formatCurrency(pos.value)}</td>
                    <td className={`r mono ${pos.pl >= 0 ? 'pos' : 'neg'}`}>
                      {pos.pl >= 0 ? '+' : ''}{formatCurrency(pos.pl)}
                    </td>
                    <td className={`r mono ${pos.plPct >= 0 ? 'pos' : 'neg'}`}>
                      {pos.plPct >= 0 ? '+' : ''}{pos.plPct.toFixed(2)}%
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <div className="flex items-center gap-2">
                        <div style={{ flex: 1, height: 4, background: 'var(--bg-sunken)', borderRadius: 2 }}>
                          <div style={{ width: pctP + '%', height: '100%', background: 'var(--fg-muted)', borderRadius: 2 }} />
                        </div>
                        <span className="mono" style={{ fontSize: 11.5, minWidth: 40, textAlign: 'right' }}>{pctP.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>
                      <button className="icon-btn" onClick={() => handleEdit(pos)} aria-label="Editar">⋯</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <AddPositionDialog open={dialogOpen} onOpenChange={setDialogOpen} editingPosition={editingPosition} />
    </div>
  )
}
