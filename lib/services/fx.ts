import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'

export interface FxRate {
  buy: number
  sell: number
  mid: number
  timestamp: string
}

const DOLARAPI_MEP_URL = 'https://dolarapi.com/v1/dolares/bolsa'
const FETCH_TIMEOUT_MS = 3000

interface DolarApiResponse {
  compra?: number
  venta?: number
  fechaActualizacion?: string
}

async function fetchMepFromDolarApi(): Promise<FxRate | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(DOLARAPI_MEP_URL, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const json = (await res.json()) as DolarApiResponse
    const buy = Number(json.compra)
    const sell = Number(json.venta)
    if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) return null
    return {
      buy,
      sell,
      mid: (buy + sell) / 2,
      timestamp: json.fechaActualizacion ?? new Date().toISOString(),
    }
  } catch (error) {
    console.warn('dolarapi MEP fetch failed:', error)
    return null
  }
}

export async function getMepCached(): Promise<FxRate | null> {
  const key = cacheKey('fx', 'mep')
  const cached = await getCached<FxRate>(key)
  if (cached) return cached
  const rate = await fetchMepFromDolarApi()
  if (!rate) return null
  await setCached(key, rate, CACHE_TTL.FX)
  return rate
}
