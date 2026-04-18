import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getCachedMock, setCachedMock } = vi.hoisted(() => ({
  getCachedMock: vi.fn(),
  setCachedMock: vi.fn(),
}))

vi.mock('@/lib/cache/redis', () => ({
  CACHE_TTL: { FX: 900 },
  cacheKey: (prefix: string, ...parts: string[]) => `sv:${prefix}:${parts.join(':')}`,
  getCached: getCachedMock,
  setCached: setCachedMock,
}))

import { getMepCached } from '@/lib/services/fx'

const fetchMock = vi.fn()

describe('getMepCached', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('returns cached value without calling dolarapi', async () => {
    const cached = { buy: 1200, sell: 1210, mid: 1205, timestamp: 't' }
    getCachedMock.mockResolvedValueOnce(cached)

    const result = await getMepCached()

    expect(result).toEqual(cached)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetches dolarapi on cache miss and writes back', async () => {
    getCachedMock.mockResolvedValueOnce(null)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ compra: 1245, venta: 1255, fechaActualizacion: '2026-04-17T10:00:00Z' }),
    })

    const result = await getMepCached()

    expect(result?.buy).toBe(1245)
    expect(result?.sell).toBe(1255)
    expect(result?.mid).toBe(1250)
    expect(setCachedMock).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://dolarapi.com/v1/dolares/bolsa',
      expect.objectContaining({ headers: expect.objectContaining({ accept: 'application/json' }) }),
    )
  })

  it('returns null when dolarapi returns bad payload', async () => {
    getCachedMock.mockResolvedValueOnce(null)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ compra: 'nan', venta: 'nan' }),
    })

    const result = await getMepCached()
    expect(result).toBeNull()
    expect(setCachedMock).not.toHaveBeenCalled()
  })

  it('returns null on network failure', async () => {
    getCachedMock.mockResolvedValueOnce(null)
    fetchMock.mockRejectedValueOnce(new Error('boom'))

    const result = await getMepCached()
    expect(result).toBeNull()
    expect(setCachedMock).not.toHaveBeenCalled()
  })

  it('returns null on non-ok response', async () => {
    getCachedMock.mockResolvedValueOnce(null)
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) })

    const result = await getMepCached()
    expect(result).toBeNull()
  })
})
