import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { getMepCachedMock } = vi.hoisted(() => ({
  getMepCachedMock: vi.fn(),
}))

vi.mock('@/lib/services/fx', () => ({
  getMepCached: getMepCachedMock,
}))

import { GET } from '@/app/api/fx/mep/route'

describe('GET /api/fx/mep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with the cached rate', async () => {
    const rate = { buy: 1245, sell: 1255, mid: 1250, timestamp: 't' }
    getMepCachedMock.mockResolvedValueOnce(rate)

    const req = new NextRequest('http://localhost/api/fx/mep')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(rate)
  })

  it('returns 503 when FX is unavailable', async () => {
    getMepCachedMock.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/fx/mep')
    const res = await GET(req)

    expect(res.status).toBe(503)
  })
})
