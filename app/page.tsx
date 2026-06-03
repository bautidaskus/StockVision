'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowRight, Plus, Sparkles } from 'lucide-react'
import { useWatchlist } from '@/lib/store/watchlist'
import { usePortfolio } from '@/lib/store/portfolio'
import { AddPositionDialog } from '@/components/add-position-dialog'
import { Card, SectionHead, Delta, SymbolMark, Flag, Eyebrow, Chip, Sparkline, genSpark } from '@/components/design/primitives'
import type { BatchOverviewResponse, PortfolioPosition } from '@/lib/types'
import { formatCurrency, formatCurrencyArs, formatPercent } from '@/lib/format'
import { useMep } from '@/lib/hooks/use-mep'
import { valuePortfolioPosition, type DisplayCurrency } from '@/lib/portfolio/valuation'

const MOCK_MARKETS = [
  { name: 'S&P 500', last: 5870.24, ch: 0.42 },
  { name: 'Nasdaq 100', last: 20814.56, ch: 0.68 },
  { name: 'Dow Jones', last: 43411.2, ch: -0.12 },
  { name: 'Merval', last: 2134480, ch: 1.24 },
  { name: 'Bitcoin', last: 94180, ch: 2.18 },
  { name: 'CCL (USD)', last: 1182.5, ch: -0.34 },
]

type Enriched = PortfolioPosition & {
  displayCurrency: DisplayCurrency
  price: number | null
  value: number | null
  cost: number
  pl: number | null
  plPct: number | null
  valueUsd: number | null
  costUsd: number | null
  plUsd: number | null
  dayPct: number
  sparkSeed: number
}

function formatMoney(value: number | null | undefined, currency: DisplayCurrency) {
  return currency === 'ARS' ? formatCurrencyArs(value) : formatCurrency(value)
}

export default function HomePage() {
  const items = useWatchlist((s) => s.items)
  const positions = usePortfolio((s) => s.positions)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingPosition, setEditingPosition] = useState<PortfolioPosition | null>(null)

  const allTickers = useMemo(() => {
    const set = new Set<string>()
    positions.filter((p) => p.type !== 'crypto').forEach((p) => set.add((p.underlying || p.ticker).toUpperCase()))
    items.filter((i) => i.type === 'stock').forEach((i) => set.add(i.ticker.toUpperCase()))
    return Array.from(set).sort().join(',')
  }, [positions, items])

  const { data: batch } = useQuery<BatchOverviewResponse>({
    queryKey: ['home-batch', allTickers],
    enabled: allTickers.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/batch/overview?tickers=${allTickers}&spark=1m`, { signal })
      if (!res.ok) throw new Error('batch failed')
      return res.json()
    },
  })

  const { data: mep } = useMep()

  const enriched: Enriched[] = useMemo(() => {
    return positions.map((p, i) => {
      const key = (p.underlying || p.ticker).toUpperCase()
      const ov = batch?.[key]?.overview
      const marketPriceUsd = p.type === 'cedear' ? ov?.price : (ov?.price ?? p.averageCost)
      const dayPct = ov?.changePercent ?? 0
      const valuation = valuePortfolioPosition(p, marketPriceUsd, mep?.mid)
      return { ...p, ...valuation, dayPct, sparkSeed: i }
    })
  }, [positions, batch, mep?.mid])

  const portfolioStats = useMemo(() => {
    const totalValue = enriched.reduce((s, p) => s + (p.valueUsd ?? 0), 0)
    const totalCost = enriched.reduce((s, p) => s + (p.costUsd ?? 0), 0)
    const totalPL = totalValue - totalCost
    const totalPLPct = totalCost > 0 ? (totalPL / totalCost) * 100 : 0
    const todayPL = enriched.reduce((s, p) => s + ((p.valueUsd ?? 0) * p.dayPct) / 100, 0)
    const todayPLPct = totalValue > 0 ? (todayPL / totalValue) * 100 : 0
    const best = enriched.reduce<Enriched | null>((b, p) => (!b || p.dayPct > b.dayPct ? p : b), null)
    return { totalValue, totalCost, totalPL, totalPLPct, todayPL, todayPLPct, best }
  }, [enriched])

  const [tabWL, setTabWL] = useState<'all' | 'stocks' | 'crypto'>('all')
  const wl = useMemo(() => {
    if (tabWL === 'all') return items
    if (tabWL === 'stocks') return items.filter((i) => i.type === 'stock')
    return items.filter((i) => i.type === 'crypto')
  }, [items, tabWL])

  function handleEdit(pos: PortfolioPosition) {
    setEditingPosition(pos)
    setDialogOpen(true)
  }

  function handleAdd() {
    setEditingPosition(null)
    setDialogOpen(true)
  }

  const hasPortfolio = enriched.length > 0

  return (
    <div>
      {/* Hero: portfolio + markets */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 20, marginBottom: 16 }} className="home-hero-grid">
        <Card style={{ padding: 28, position: 'relative', overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <Eyebrow>Valor del portfolio</Eyebrow>
            <Link href="/portfolio" className="chip accent" style={{ textDecoration: 'none' }}>
              Ver detalle <ArrowRight size={11} />
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24 }}>
            <div>
              <div className="price-xl">{hasPortfolio ? formatCurrency(portfolioStats.totalValue) : '$0.00'}</div>
              <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
                <Delta v={portfolioStats.totalPL} pct={portfolioStats.totalPLPct} />
                <Flag>TOTAL</Flag>
                <Delta v={portfolioStats.todayPL} pct={portfolioStats.todayPLPct} />
                <Flag>HOY</Flag>
              </div>
            </div>
            <div style={{ flex: 1, marginLeft: 'auto', maxWidth: 320 }}>
              <Sparkline data={genSpark(40, portfolioStats.totalPL >= 0 ? 1.2 : -1.2, 7)} width={320} height={56} />
            </div>
          </div>

          <hr className="hair" style={{ margin: '22px 0 16px' }} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            <div>
              <Eyebrow>Costo total</Eyebrow>
              <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 6 }}>
                {formatCurrency(portfolioStats.totalCost)}
              </div>
            </div>
            <div>
              <Eyebrow>P&amp;L total</Eyebrow>
              <div className={`mono ${portfolioStats.totalPL >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 17, fontWeight: 500, marginTop: 6 }}>
                {portfolioStats.totalPL >= 0 ? '+' : ''}{formatCurrency(portfolioStats.totalPL)}
              </div>
            </div>
            <div>
              <Eyebrow>Posiciones</Eyebrow>
              <div className="mono" style={{ fontSize: 17, fontWeight: 500, marginTop: 6 }}>{enriched.length}</div>
            </div>
            <div>
              <Eyebrow>Mejor hoy</Eyebrow>
              {portfolioStats.best ? (
                <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
                  <SymbolMark ticker={portfolioStats.best.ticker} size="sm" />
                  <span className="mono">{portfolioStats.best.ticker}</span>
                  <span className={`mono ${portfolioStats.best.dayPct >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 12 }}>
                    {portfolioStats.best.dayPct >= 0 ? '+' : ''}{portfolioStats.best.dayPct.toFixed(2)}%
                  </span>
                </div>
              ) : (
                <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>—</div>
              )}
            </div>
          </div>
        </Card>

        <Card className="card-pad">
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <Eyebrow>Mercados</Eyebrow>
            <Flag>DEMO</Flag>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {MOCK_MARKETS.map((m, i) => (
              <div key={m.name} style={{ padding: '10px 0', borderBottom: i < 4 ? '1px solid var(--line)' : '0' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{m.name}</span>
                  <span className={`mono ${m.ch >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 11.5 }}>
                    {m.ch >= 0 ? '+' : ''}{m.ch.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="mono muted" style={{ fontSize: 11.5 }}>{m.last.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                  <Sparkline data={genSpark(14, m.ch >= 0 ? 1 : -1, i + 3)} width={60} height={18} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Holdings */}
      <SectionHead
        title="Mis <em>posiciones</em>"
        dangerouslyHtml
        sub={hasPortfolio ? `${enriched.length} activo${enriched.length === 1 ? '' : 's'}` : 'Agregá tu primera posición para empezar'}
        right={
          <div className="flex gap-2">
            <button className="sv-btn sm" onClick={handleAdd}>
              <Plus size={13} /> Agregar
            </button>
            <Link href="/portfolio" className="sv-btn sm ghost" style={{ textDecoration: 'none' }}>
              Ver todo <ArrowRight size={12} />
            </Link>
          </div>
        }
      />

      <Card style={{ marginBottom: 32, overflow: 'hidden' }}>
        {hasPortfolio ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>Activo</th>
                <th className="r">Cantidad</th>
                <th className="r">Precio</th>
                <th className="r">Día</th>
                <th className="r">Valor</th>
                <th className="r">P&amp;L</th>
                <th style={{ width: 120 }}>Tendencia 30d</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((pos) => (
                <tr
                  className="row"
                  key={pos.ticker}
                  onClick={() => {
                    const href = pos.type === 'crypto' ? `/crypto/${pos.ticker.toLowerCase()}` : `/stock/${pos.ticker}`
                    window.location.href = href
                  }}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <SymbolMark ticker={pos.ticker} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span style={{ fontWeight: 500 }}>{pos.ticker}</span>
                          {pos.type === 'cedear' && <Flag>CEDEAR{pos.ratio ? ` · ${pos.ratio}:1` : ''}</Flag>}
                          {pos.type === 'crypto' && <Flag>CRYPTO</Flag>}
                        </div>
                        <div className="subtle" style={{ fontSize: 12 }}>{pos.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="r mono">{pos.quantity < 10 ? pos.quantity.toFixed(4) : pos.quantity}</td>
                  <td className="r mono">{formatMoney(pos.price, pos.displayCurrency)}</td>
                  <td className={`r mono ${pos.dayPct >= 0 ? 'pos' : 'neg'}`}>
                    {pos.dayPct >= 0 ? '+' : ''}{pos.dayPct.toFixed(2)}%
                  </td>
                  <td className="r mono">{formatMoney(pos.value, pos.displayCurrency)}</td>
                  <td className="r">
                    <div className={`mono ${(pos.pl ?? 0) >= 0 ? 'pos' : 'neg'}`}>
                      {(pos.pl ?? 0) >= 0 && pos.pl != null ? '+' : ''}{formatMoney(pos.pl, pos.displayCurrency)}
                    </div>
                    <div className={`mono ${(pos.pl ?? 0) >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 11, opacity: 0.75 }}>
                      {formatPercent(pos.plPct)}
                    </div>
                  </td>
                  <td>
                    <Sparkline data={genSpark(20, (pos.plPct ?? 0) > 0 ? 1 : -1, pos.sparkSeed)} width={100} height={24} />
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(pos)
                      }}
                      aria-label="Editar"
                    >
                      ⋯
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-subtle)' }}>
            <p style={{ marginBottom: 8 }}>Tu portfolio está vacío.</p>
            <button className="sv-btn primary sm" onClick={handleAdd}>
              <Plus size={13} /> Agregar posición
            </button>
          </div>
        )}
      </Card>

      {/* Watchlist + AI briefing */}
      <div id="watchlist" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }} className="home-watch-grid">
        <Card style={{ padding: 20 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="section-title" style={{ fontSize: 18 }}>Watchlist</h2>
              <div className="section-sub">Activos que seguís pero no tenés</div>
            </div>
            <div className="sv-tabs" style={{ border: 0, margin: 0, gap: 0 }}>
              {(['all', 'stocks', 'crypto'] as const).map((t) => (
                <button
                  key={t}
                  className={`sv-tab ${tabWL === t ? 'active' : ''}`}
                  onClick={() => setTabWL(t)}
                  style={{ padding: '6px 10px', fontSize: 12 }}
                >
                  {t === 'all' ? 'Todos' : t === 'stocks' ? 'Stocks' : 'Crypto'}
                </button>
              ))}
            </div>
          </div>
          <div>
            {wl.length === 0 && (
              <div className="subtle" style={{ padding: '24px 0', textAlign: 'center', fontSize: 13 }}>
                Watchlist vacía. Agregá un activo desde su página con la estrella.
              </div>
            )}
            {wl.map((w, i) => {
              const ov = w.type === 'stock' ? batch?.[w.ticker.toUpperCase()]?.overview : null
              const price = ov?.price
              const chPct = ov?.changePercent ?? 0
              const href = w.type === 'crypto' ? `/crypto/${w.ticker}` : `/stock/${w.ticker}`
              return (
                <Link
                  href={href}
                  key={w.ticker}
                  className="flex items-center gap-3"
                  style={{ padding: '12px 0', borderBottom: i < wl.length - 1 ? '1px dashed var(--line)' : '0', textDecoration: 'none', color: 'inherit' }}
                >
                  <SymbolMark ticker={w.ticker} />
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2">
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{w.ticker.toUpperCase()}</span>
                      {w.type === 'crypto' && <Flag>CRYPTO</Flag>}
                    </div>
                    <div className="subtle" style={{ fontSize: 11.5 }}>{w.name}</div>
                  </div>
                  <Sparkline data={genSpark(18, chPct >= 0 ? 1 : -1, i + 11)} width={72} height={22} />
                  <div style={{ textAlign: 'right', minWidth: 90 }}>
                    <div className="mono" style={{ fontSize: 13 }}>{price != null ? formatCurrency(price) : '—'}</div>
                    <div className={`mono ${chPct >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 11 }}>
                      {chPct >= 0 ? '+' : ''}{chPct.toFixed(2)}%
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </Card>

        <Card style={{ padding: 20, background: 'linear-gradient(180deg, var(--accent-soft), transparent)' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
            <Sparkles size={14} />
            <span className="eyebrow" style={{ color: 'var(--accent)' }}>Briefing del día · IA</span>
          </div>
          <div className="serif" style={{ fontSize: 18, lineHeight: 1.4, marginBottom: 14 }}>
            {hasPortfolio ? (
              <>
                Tu portfolio {portfolioStats.todayPL >= 0 ? 'avanza' : 'retrocede'}{' '}
                <em>{portfolioStats.todayPLPct >= 0 ? '+' : ''}{portfolioStats.todayPLPct.toFixed(2)}% hoy</em>.
                {portfolioStats.best ? ` Liderado por ${portfolioStats.best.ticker}.` : ''}
              </>
            ) : (
              <>Empezá agregando posiciones o activos a tu <em>watchlist</em> para ver un briefing diario.</>
            )}
          </div>
          <div className="subtle" style={{ fontSize: 12.5, lineHeight: 1.55, marginBottom: 14 }}>
            Visitá cada activo para leer su análisis con IA, fundamentales y señales técnicas.
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {hasPortfolio && <Chip variant={portfolioStats.totalPL >= 0 ? 'pos' : 'neg'}>{portfolioStats.totalPL >= 0 ? '+' : ''}{formatCurrency(portfolioStats.totalPL)} total</Chip>}
            <Chip>Portfolio · {enriched.length}</Chip>
            <Chip>Watchlist · {items.length}</Chip>
          </div>
        </Card>
      </div>

      <AddPositionDialog open={dialogOpen} onOpenChange={setDialogOpen} editingPosition={editingPosition} />

      <style jsx>{`
        @media (max-width: 960px) {
          .home-hero-grid { grid-template-columns: 1fr !important; }
          .home-watch-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
