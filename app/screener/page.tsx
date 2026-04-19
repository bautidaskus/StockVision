'use client'

import { startTransition, useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SectionHead } from '@/components/design/primitives'
import { ScreenerFilters as FiltersPanel } from '@/components/screener-filters'
import { ScreenerResults } from '@/components/screener-results'
import { ScreenerPresetBar, type Preset } from '@/components/screener-preset-bar'
import { buildScreenerQueryString, DEFAULT_SCORE_WINDOW } from '@/lib/screener/filters'
import type { ScreenerFilters, ScreenerResult } from '@/lib/types'

const DEFAULT_FILTERS: ScreenerFilters = {
  exchange: '',
  limit: 100,
}

export default function ScreenerPage() {
  const [draftFilters, setDraftFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS)
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const draftQueryParams = useMemo(
    () => buildScreenerQueryString(draftFilters),
    [draftFilters],
  )
  const appliedQueryParams = useMemo(
    () => buildScreenerQueryString(appliedFilters),
    [appliedFilters],
  )
  const scoreQueryParams = useMemo(
    () => buildScreenerQueryString(appliedFilters, { scoreWindow: DEFAULT_SCORE_WINDOW }),
    [appliedFilters],
  )

  const baseQuery = useQuery<ScreenerResult[]>({
    queryKey: ['screener', appliedQueryParams, 'base'],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/screener?${appliedQueryParams}`, { signal })
      if (!res.ok) throw new Error('Error al buscar acciones')
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  })

  const scoreQuery = useQuery<ScreenerResult[]>({
    queryKey: ['screener', appliedQueryParams, 'scores', DEFAULT_SCORE_WINDOW],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/screener?${scoreQueryParams}`, { signal })
      if (!res.ok) throw new Error('Error al enriquecer scores')
      return res.json()
    },
    enabled: Boolean(baseQuery.data && baseQuery.data.length > 0 && !baseQuery.isFetching),
    staleTime: 5 * 60 * 1000,
  })

  const handlePresetSelect = useCallback((preset: Preset | null) => {
    setActivePreset(preset?.label ?? null)
    setDraftFilters(preset ? { ...DEFAULT_FILTERS, ...preset.filters } : DEFAULT_FILTERS)
  }, [])

  const handleReset = useCallback(() => {
    setActivePreset(null)
    setDraftFilters(DEFAULT_FILTERS)
  }, [])

  const handleFiltersChange = useCallback((filters: ScreenerFilters) => {
    setActivePreset(null)
    setDraftFilters(filters)
  }, [])

  const handleApply = useCallback(() => {
    if (draftQueryParams === appliedQueryParams) return
    if (baseQuery.isFetching) return
    startTransition(() => {
      setAppliedFilters(draftFilters)
    })
  }, [appliedQueryParams, baseQuery.isFetching, draftFilters, draftQueryParams])

  const mergedResults = useMemo(() => {
    if (!baseQuery.data) return undefined
    if (!scoreQuery.data) return baseQuery.data

    const scoreMap = new Map(scoreQuery.data.map((row) => [row.ticker, row]))
    return baseQuery.data.map((row) => {
      const enriched = scoreMap.get(row.ticker)
      return enriched ? { ...row, ...enriched } : row
    })
  }, [baseQuery.data, scoreQuery.data])

  const isRefreshing = baseQuery.isFetching || scoreQuery.isFetching
  const hasPendingChanges = draftQueryParams !== appliedQueryParams
  const error = baseQuery.error as Error | null
  const isLoading = !baseQuery.data && baseQuery.isPending

  return (
    <div>
      <SectionHead
        title="<em>Screener</em>"
        dangerouslyHtml
        sub="Filtrá acciones por métricas fundamentales y técnicas"
      />

      {/* Presets */}
      <ScreenerPresetBar
        activePreset={activePreset}
        onSelect={handlePresetSelect}
      />

      {/* Layout: filtros izquierda, resultados derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        <FiltersPanel
          filters={draftFilters}
          onChange={handleFiltersChange}
          onReset={handleReset}
          onApply={handleApply}
          isDirty={hasPendingChanges}
          isApplyDisabled={baseQuery.isFetching}
          isLoading={isRefreshing}
        />

        <ScreenerResults
          results={mergedResults}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          error={error}
        />
      </div>
    </div>
  )
}
