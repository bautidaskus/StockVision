'use client'

import { StaggerContainer, StaggerItem } from '@/components/motion/stagger-container'
import type { ScreenerFilters } from '@/lib/types'

interface Preset {
  label: string
  description: string
  filters: ScreenerFilters
}

// Presets con criterios de inversión estándar
const PRESETS: Preset[] = [
  {
    label: 'Value',
    description: 'P/E bajo, empresas consolidadas',
    filters: {
      peMin: 5,
      peMax: 15,
      betaMax: 1,
      marketCapMin: 2_000_000_000,
    },
  },
  {
    label: 'Growth',
    description: 'Crecimiento con valuación razonable',
    filters: {
      peMax: 40,
      marketCapMin: 1_000_000_000,
      exchange: 'NASDAQ',
    },
  },
  {
    label: 'Dividendos',
    description: 'Flujo de ingresos pasivos',
    filters: {
      dividendMin: 3,
      betaMax: 0.8,
      marketCapMin: 5_000_000_000,
    },
  },
  {
    label: 'Oversold',
    description: 'Caídas fuertes con potencial rebote',
    filters: {
      peMin: 3,
      peMax: 20,
      betaMin: 0.8,
      marketCapMin: 500_000_000,
    },
  },
  {
    label: 'Large Cap',
    description: 'Empresas mega cap S&P 500',
    filters: {
      marketCapMin: 10_000_000_000,
      betaMin: 0.5,
      betaMax: 1.5,
    },
  },
]

interface ScreenerPresetBarProps {
  activePreset: string | null
  onSelect: (preset: Preset | null) => void
}

export function ScreenerPresetBar({ activePreset, onSelect }: ScreenerPresetBarProps) {
  return (
    <StaggerContainer className="flex gap-2 flex-wrap">
      {PRESETS.map((preset) => (
        <StaggerItem key={preset.label}>
          <button
            onClick={() => onSelect(activePreset === preset.label ? null : preset)}
            title={preset.description}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              activePreset === preset.label
                ? 'bg-primary border-primary text-primary-foreground'
                : 'bg-card border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {preset.label}
          </button>
        </StaggerItem>
      ))}
    </StaggerContainer>
  )
}

// Exportar también los presets para usarlos en los tests
export { PRESETS }
export type { Preset }
