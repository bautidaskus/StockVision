import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScreenerPage from '@/app/screener/page'
import type { ScreenerResult } from '@/lib/types'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const baseResults: ScreenerResult[] = [
  {
    ticker: 'AAPL',
    name: 'Apple Inc.',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    exchange: 'NASDAQ',
    price: 180,
    marketCap: 2_000_000_000_000,
    pe: 30,
    pb: 40,
    roe: 0.25,
    netMargin: 0.22,
    beta: 1.2,
    dividendYield: 0.005,
    debtToEquity: 1.2,
    week52High: 220,
    week52Low: 150,
    changePercent: 1.4,
    primaryDataSource: 'fmp-screener',
    scoreSource: null,
    scoreStatus: 'not-requested',
    opportunityScore: null,
  },
]

const enrichedResults: ScreenerResult[] = [
  {
    ...baseResults[0],
    opportunityScore: 81,
    opportunityRating: 'Muy atractiva',
    reasons: ['Alta calidad'],
    scoreSource: 'yahoo-enrichment',
    scoreStatus: 'ready',
  },
]

const filteredBaseResults: ScreenerResult[] = [
  {
    ...baseResults[0],
    ticker: 'MSFT',
    name: 'Microsoft',
  },
]

function createJsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  } as Response
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ScreenerPage />
    </QueryClientProvider>,
  )
}

describe('ScreenerPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('no consulta por cada keypress y mantiene resultados previos hasta aplicar', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)

      if (url.includes('roeMin=15') && !url.includes('scoreWindow=')) {
        return new Promise((resolve) => {
          setTimeout(() => resolve(createJsonResponse(filteredBaseResults)), 50)
        })
      }

      if (url.includes('roeMin=15') && url.includes('scoreWindow=10')) {
        return Promise.resolve(createJsonResponse(filteredBaseResults))
      }

      if (url.includes('scoreWindow=10')) {
        return Promise.resolve(createJsonResponse(enrichedResults))
      }

      return Promise.resolve(createJsonResponse(baseResults))
    })

    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText('AAPL')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))

    const roeInput = screen.getByPlaceholderText('Ej: 15')
    await user.clear(roeInput)
    await user.type(roeInput, '15')

    expect(screen.getByText('Hay cambios pendientes. Aplicalos para actualizar la tabla.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    expect(screen.getByText('Actualizando sin ocultar resultados previos...')).toBeInTheDocument()

    expect(await screen.findByText('MSFT')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
  })
})
