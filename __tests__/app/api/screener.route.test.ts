import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getCachedMock, setCachedMock, runScreenerMock } = vi.hoisted(() => ({
  getCachedMock: vi.fn(),
  setCachedMock: vi.fn(),
  runScreenerMock: vi.fn(),
}))

vi.mock('@/lib/cache/redis', () => ({
  CACHE_TTL: { SCREENER: 3600 },
  cacheKey: (prefix: string, ...parts: string[]) => `sv:${prefix}:${parts.join(':')}`,
  getCached: getCachedMock,
  setCached: setCachedMock,
}))

vi.mock('@/lib/screener/service', () => ({
  runScreener: runScreenerMock,
}))

import { GET } from '@/app/api/screener/route'

describe('GET /api/screener', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('devuelve cache hit sin recalcular', async () => {
    getCachedMock.mockResolvedValueOnce([{ ticker: 'AAPL' }])

    const request = new NextRequest('http://localhost/api/screener?limit=100&__perf=1')
    const response = await GET(request)

    expect(runScreenerMock).not.toHaveBeenCalled()
    expect(getCachedMock).toHaveBeenCalledWith('sv:screener:limit=100')
    expect(await response.json()).toEqual([{ ticker: 'AAPL' }])
  })

  it('ejecuta fast path y cachea por score window cuando hay miss', async () => {
    getCachedMock.mockResolvedValueOnce(null)
    runScreenerMock.mockResolvedValueOnce([{ ticker: 'MSFT', scoreStatus: 'ready' }])

    const request = new NextRequest('http://localhost/api/screener?exchange=NASDAQ&limit=50&scoreWindow=10')
    const response = await GET(request)

    expect(runScreenerMock).toHaveBeenCalledWith(
      {
        exchange: 'NASDAQ',
        limit: 50,
      },
      { scoreWindow: 10 },
    )
    expect(setCachedMock).toHaveBeenCalledWith(
      'sv:screener:exchange=NASDAQ&limit=50&scoreWindow=10',
      [{ ticker: 'MSFT', scoreStatus: 'ready' }],
      3600,
    )
    expect(await response.json()).toEqual([{ ticker: 'MSFT', scoreStatus: 'ready' }])
  })
})
