import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScreenerResults } from '@/components/screener-results'
import type { ScreenerResult } from '@/lib/types'

const mockResults: ScreenerResult[] = [
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    exchange: 'NASDAQ',
    price: 178.5,
    marketCap: 2_800_000_000_000,
    pe: 28.5,
    pb: null,
    roe: null,
    netMargin: null,
    beta: 1.2,
    dividendYield: 0.005,
    week52High: 200,
    week52Low: 140,
    changePercent: 1.5,
  },
]

// Mock del router de Next.js
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('ScreenerResults', () => {
  it('muestra mensaje de carga', () => {
    render(<ScreenerResults results={undefined} isLoading error={null} />)
    // Los skeletons deben estar presentes
    expect(document.querySelectorAll('.animate-shimmer').length).toBeGreaterThan(0)
  })

  it('muestra resultados correctamente', () => {
    render(<ScreenerResults results={mockResults} isLoading={false} error={null} />)
    expect(screen.getByText('AAPL')).toBeDefined()
    expect(screen.getByText('1 resultado encontrado')).toBeDefined()
  })

  it('muestra mensaje vacío cuando no hay resultados', () => {
    render(<ScreenerResults results={[]} isLoading={false} error={null} />)
    expect(screen.getByText('Sin resultados')).toBeDefined()
  })

  it('muestra mensaje de error', () => {
    render(
      <ScreenerResults
        results={undefined}
        isLoading={false}
        error={new Error('FMP error: 429')}
      />
    )
    expect(screen.getByText('Error al buscar resultados')).toBeDefined()
  })
})
