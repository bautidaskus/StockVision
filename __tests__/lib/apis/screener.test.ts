import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)
vi.stubEnv('FMP_API_KEY', 'test-key')

import { screenStocks } from '@/lib/apis/fmp'

describe('screenStocks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('devuelve resultados mapeados correctamente', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        {
          symbol: 'AAPL',
          companyName: 'Apple Inc.',
          sector: 'Technology',
          industry: 'Consumer Electronics',
          exchangeShortName: 'NASDAQ',
          price: 178.5,
          marketCap: 2_800_000_000_000,
          priceEarningsRatio: 28.5,
          priceToBookRatio: 42.1,
          returnOnEquity: 0.32,
          netProfitMargin: 0.24,
          beta: 1.2,
          dividendYield: 0.005,
          yearHigh: 200,
          yearLow: 140,
          changesPercentage: 1.5,
        },
      ]),
    })

    const result = await screenStocks({ peMax: 30 })

    expect(result).toHaveLength(1)
    expect(result[0].ticker).toBe('AAPL')
    expect(result[0].pe).toBe(28.5)
    expect(result[0].pb).toBe(42.1)
    expect(result[0].roe).toBe(0.32)
    expect(result[0].netMargin).toBe(0.24)
    expect(result[0].beta).toBe(1.2)
    expect(result[0].week52High).toBe(200)
    expect(result[0].week52Low).toBe(140)
  })

  it('devuelve array vacío cuando la respuesta no es un array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ Error: 'Not found' }),
    })

    const result = await screenStocks({})
    expect(result).toEqual([])
  })

  it('incluye volumeMoreThan=100000 siempre para evitar illíquidas', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await screenStocks({})
    const url = (mockFetch.mock.calls[0][0] as string)
    expect(url).toContain('volumeMoreThan=100000')
  })

  it('mapea filtros avanzados cuando están presentes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    })

    await screenStocks({
      pbMin: 1,
      pbMax: 5,
      roeMin: 15,
      netMarginMin: 10,
      debtToEquityMax: 1.5,
    })

    const url = (mockFetch.mock.calls[0][0] as string)
    expect(url).toContain('priceToBookRatioMoreThan=1')
    expect(url).toContain('priceToBookRatioLessThan=5')
    expect(url).toContain('returnOnEquityMoreThan=0.15')
    expect(url).toContain('netProfitMarginMoreThan=0.1')
    expect(url).toContain('debtToEquityLessThan=1.5')
  })
})
