'use client'

import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import type { ScreenerFilters } from '@/lib/types'

// Sectores aceptados por FMP (lista exacta, no inventar otros)
const SECTORS = [
  'Technology',
  'Healthcare',
  'Financial Services',
  'Consumer Cyclical',
  'Consumer Defensive',
  'Industrials',
  'Energy',
  'Utilities',
  'Real Estate',
  'Basic Materials',
  'Communication Services',
]

const EXCHANGES = ['', 'NASDAQ', 'NYSE', 'AMEX']

interface ScreenerFiltersProps {
  filters: ScreenerFilters
  onChange: (filters: ScreenerFilters) => void
  onReset: () => void
  onApply: () => void
  isDirty: boolean
  isApplyDisabled: boolean
  isLoading: boolean
}

export function ScreenerFilters({
  filters,
  onChange,
  onReset,
  onApply,
  isDirty,
  isApplyDisabled,
  isLoading,
}: ScreenerFiltersProps) {
  // Helper para actualizar un campo específico
  function set<K extends keyof ScreenerFilters>(key: K, value: ScreenerFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <Card className="p-5 bg-card border-border space-y-5 sticky top-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Filtros</h3>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-xs text-muted-foreground">
          Limpiar todo
        </Button>
      </div>

      {/* Exchange */}
      <FilterGroup label="Exchange">
        <div className="flex gap-2 flex-wrap">
          {EXCHANGES.map((ex) => (
            <button
              key={ex || 'all'}
              onClick={() => set('exchange', ex as ScreenerFilters['exchange'])}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                filters.exchange === ex
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50'
              }`}
            >
              {ex || 'Todos'}
            </button>
          ))}
        </div>
      </FilterGroup>

      {/* Sector */}
      <FilterGroup label="Sector">
        <select
          value={filters.sector || ''}
          onChange={(e) => set('sector', e.target.value || undefined)}
          className="w-full h-9 rounded-md bg-secondary border-border border text-sm px-2 text-foreground"
        >
          <option value="">Todos los sectores</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </FilterGroup>

      {/* Market Cap */}
      <FilterGroup label="Market Cap (USD)">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Mín.</Label>
            <select
              value={filters.marketCapMin ?? ''}
              onChange={(e) => set('marketCapMin', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full h-9 rounded-md bg-secondary border-border border text-xs px-2 text-foreground"
            >
              <option value="">Sin mín.</option>
              <option value="50000000">$50M (Micro)</option>
              <option value="300000000">$300M (Small)</option>
              <option value="2000000000">$2B (Mid)</option>
              <option value="10000000000">$10B (Large)</option>
              <option value="200000000000">$200B (Mega)</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Máx.</Label>
            <select
              value={filters.marketCapMax ?? ''}
              onChange={(e) => set('marketCapMax', e.target.value ? Number(e.target.value) : undefined)}
              className="w-full h-9 rounded-md bg-secondary border-border border text-xs px-2 text-foreground"
            >
              <option value="">Sin máx.</option>
              <option value="300000000">$300M (Small)</option>
              <option value="2000000000">$2B (Mid)</option>
              <option value="10000000000">$10B (Large)</option>
              <option value="200000000000">$200B (Mega)</option>
            </select>
          </div>
        </div>
      </FilterGroup>

      {/* P/E Ratio */}
      <FilterGroup label="P/E Ratio">
        <RangeInputs
          minValue={filters.peMin}
          maxValue={filters.peMax}
          onChangeMin={(v) => set('peMin', v)}
          onChangeMax={(v) => set('peMax', v)}
          minPlaceholder="0"
          maxPlaceholder="Sin máx."
        />
      </FilterGroup>

      <FilterGroup label="P/B Ratio">
        <RangeInputs
          minValue={filters.pbMin}
          maxValue={filters.pbMax}
          onChangeMin={(v) => set('pbMin', v)}
          onChangeMax={(v) => set('pbMax', v)}
          minPlaceholder="0"
          maxPlaceholder="Sin máx."
          step="0.1"
        />
      </FilterGroup>

      <FilterGroup label="ROE mínimo (%)">
        <Input
          type="number"
          min="0"
          step="1"
          value={filters.roeMin ?? ''}
          onChange={(e) => set('roeMin', e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="Ej: 15"
          className="bg-secondary border-border font-mono-numbers h-8 text-sm"
        />
      </FilterGroup>

      <FilterGroup label="Margen neto mínimo (%)">
        <Input
          type="number"
          min="0"
          step="1"
          value={filters.netMarginMin ?? ''}
          onChange={(e) => set('netMarginMin', e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="Ej: 10"
          className="bg-secondary border-border font-mono-numbers h-8 text-sm"
        />
      </FilterGroup>

      {/* Beta */}
      <FilterGroup label="Beta">
        <RangeInputs
          minValue={filters.betaMin}
          maxValue={filters.betaMax}
          onChangeMin={(v) => set('betaMin', v)}
          onChangeMax={(v) => set('betaMax', v)}
          minPlaceholder="0"
          maxPlaceholder="Sin máx."
          step="0.1"
        />
      </FilterGroup>

      <FilterGroup label="Deuda / Capital máx.">
        <Input
          type="number"
          min="0"
          step="0.1"
          value={filters.debtToEquityMax ?? ''}
          onChange={(e) => set('debtToEquityMax', e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="Ej: 1.5"
          className="bg-secondary border-border font-mono-numbers h-8 text-sm"
        />
      </FilterGroup>

      {/* Dividend Yield */}
      <FilterGroup label="Dividend Yield (%) mín.">
        <Input
          type="number"
          min="0"
          step="0.5"
          value={filters.dividendMin ?? ''}
          onChange={(e) => set('dividendMin', e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder="Ej: 2 = al menos 2%"
          className="bg-secondary border-border font-mono-numbers h-8 text-sm"
        />
      </FilterGroup>

      {/* Estado de carga */}
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
          Actualizando resultados...
        </div>
      )}

      {isDirty && (
        <p className="text-xs text-muted-foreground">
          Hay cambios pendientes. Aplicalos para actualizar la tabla.
        </p>
      )}

      <Button
        onClick={onApply}
        disabled={!isDirty || isApplyDisabled}
        className="w-full"
      >
        Aplicar filtros
      </Button>
    </Card>
  )
}

// Sub-componentes auxiliares (internos de este archivo)

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  )
}

function RangeInputs({
  minValue,
  maxValue,
  onChangeMin,
  onChangeMax,
  minPlaceholder,
  maxPlaceholder,
  step = '1',
}: {
  minValue: number | undefined
  maxValue: number | undefined
  onChangeMin: (v: number | undefined) => void
  onChangeMax: (v: number | undefined) => void
  minPlaceholder?: string
  maxPlaceholder?: string
  step?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Mín.</Label>
        <Input
          type="number"
          step={step}
          value={minValue ?? ''}
          onChange={(e) => onChangeMin(e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder={minPlaceholder}
          className="bg-secondary border-border font-mono-numbers h-8 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Máx.</Label>
        <Input
          type="number"
          step={step}
          value={maxValue ?? ''}
          onChange={(e) => onChangeMax(e.target.value ? parseFloat(e.target.value) : undefined)}
          placeholder={maxPlaceholder}
          className="bg-secondary border-border font-mono-numbers h-8 text-sm"
        />
      </div>
    </div>
  )
}
