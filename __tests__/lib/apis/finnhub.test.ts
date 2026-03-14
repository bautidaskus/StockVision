import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock env
vi.stubEnv('FINNHUB_API_KEY', 'test-key')

import { getRecommendationTrends } from '@/lib/apis/finnhub'

describe('getRecommendationTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns mapped recommendation data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([
        {
          period: '2024-01-01',
          strongBuy: 10,
          buy: 15,
          hold: 5,
          sell: 2,
          strongSell: 1,
        },
      ]),
    })

    const result = await getRecommendationTrends('AAPL')

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      period: '2024-01-01',
      strongBuy: 10,
      buy: 15,
      hold: 5,
      sell: 2,
      strongSell: 1,
    })
  })

  it('returns empty array when API returns non-array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ error: 'invalid' }),
    })

    const result = await getRecommendationTrends('INVALID')
    expect(result).toEqual([])
  })

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    })

    await expect(getRecommendationTrends('AAPL')).rejects.toThrow('Finnhub error: 500')
  })
})
