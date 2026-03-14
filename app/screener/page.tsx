'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { ScreenerFilters as FiltersPanel } from '@/components/screener-filters'
import { ScreenerResults } from '@/components/screener-results'
import { ScreenerPresetBar, type Preset } from '@/components/screener-preset-bar'
import type { ScreenerFilters, ScreenerResult } from '@/lib/types'

const DEFAULT_FILTERS: ScreenerFilters = {
  exchange: '',
  limit: 100,
}

export default function ScreenerPage() {
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS)
  const [activePreset, setActivePreset] = useState<string | null>(null)

  // Construir los query params desde los filtros activos
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (filters.exchange) params.set('exchange', filters.exchange)
    if (filters.sector) params.set('sector', filters.sector)
    if (filters.marketCapMin != null) params.set('marketCapMin', String(filters.marketCapMin))
    if (filters.marketCapMax != null) params.set('marketCapMax', String(filters.marketCapMax))
    if (filters.peMin != null) params.set('peMin', String(filters.peMin))
    if (filters.peMax != null) params.set('peMax', String(filters.peMax))
    if (filters.pbMin != null) params.set('pbMin', String(filters.pbMin))
    if (filters.pbMax != null) params.set('pbMax', String(filters.pbMax))
    if (filters.roeMin != null) params.set('roeMin', String(filters.roeMin))
    if (filters.netMarginMin != null) params.set('netMarginMin', String(filters.netMarginMin))
    if (filters.betaMin != null) params.set('betaMin', String(filters.betaMin))
    if (filters.betaMax != null) params.set('betaMax', String(filters.betaMax))
    if (filters.debtToEquityMax != null) params.set('debtToEquityMax', String(filters.debtToEquityMax))
    if (filters.dividendMin != null) params.set('dividendMin', String(filters.dividendMin))
    params.set('limit', String(filters.limit || 100))
    return params.toString()
  }, [filters])

  const { data, isLoading, error } = useQuery<ScreenerResult[]>({
    queryKey: ['screener', queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/screener?${queryParams}`)
      if (!res.ok) throw new Error('Error al buscar acciones')
      return res.json()
    },
    // No refetch automático — el screener se ejecuta solo cuando cambian los filtros
    staleTime: 5 * 60 * 1000,
  })

  const handlePresetSelect = useCallback((preset: Preset | null) => {
    setActivePreset(preset?.label ?? null)
    setFilters(preset ? { ...DEFAULT_FILTERS, ...preset.filters } : DEFAULT_FILTERS)
  }, [])

  const handleReset = useCallback(() => {
    setActivePreset(null)
    setFilters(DEFAULT_FILTERS)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SlidersHorizontal className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Screener</h1>
          <p className="text-sm text-muted-foreground">
            Filtrá acciones por métricas fundamentales y técnicas
          </p>
        </div>
      </div>

      {/* Presets */}
      <ScreenerPresetBar
        activePreset={activePreset}
        onSelect={handlePresetSelect}
      />

      {/* Layout: filtros izquierda, resultados derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        <FiltersPanel
          filters={filters}
          onChange={setFilters}
          onReset={handleReset}
          isLoading={isLoading}
        />

        <ScreenerResults
          results={data}
          isLoading={isLoading}
          error={error as Error | null}
        />
      </div>
    </div>
  )
}
