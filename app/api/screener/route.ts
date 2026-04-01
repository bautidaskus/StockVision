import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import { rankStocks } from '@/lib/ranking/stock-ranking'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import type { ScreenerFilters, ScreenerResult } from '@/lib/types'

// Parsear parámetros numéricos de forma segura
function parseNum(value: string | null): number | undefined {
  if (!value) return undefined
  const n = parseFloat(value)
  return isNaN(n) ? undefined : n
}

// Generar una clave de caché determinista desde los filtros activos
function buildCacheKey(params: URLSearchParams): string {
  // Ordenar los parámetros para que el mismo filtro siempre genere la misma key
  const sorted = Array.from(params.entries())
    .filter(([k, v]) => k !== '__perf' && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return cacheKey('screener', sorted || 'all')
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // Construir el objeto de filtros
  const filters: ScreenerFilters = {
    exchange: (searchParams.get('exchange') as ScreenerFilters['exchange']) || undefined,
    sector: searchParams.get('sector') || undefined,
    marketCapMin: parseNum(searchParams.get('marketCapMin')),
    marketCapMax: parseNum(searchParams.get('marketCapMax')),
    peMin: parseNum(searchParams.get('peMin')),
    peMax: parseNum(searchParams.get('peMax')),
    pbMin: parseNum(searchParams.get('pbMin')),
    pbMax: parseNum(searchParams.get('pbMax')),
    roeMin: parseNum(searchParams.get('roeMin')),
    netMarginMin: parseNum(searchParams.get('netMarginMin')),
    betaMin: parseNum(searchParams.get('betaMin')),
    betaMax: parseNum(searchParams.get('betaMax')),
    debtToEquityMax: parseNum(searchParams.get('debtToEquityMax')),
    dividendMin: parseNum(searchParams.get('dividendMin')),
    limit: parseNum(searchParams.get('limit')) || 50,
  }

  const key = buildCacheKey(searchParams)
  const perf = createRequestPerformanceTracker('/api/screener', request, {
    filters,
    cacheKey: key,
  })

  try {
    return await perf.run(async () => {
      const cached = await measureStage('cache.get', () => getCached<ScreenerResult[]>(key))
      perf.recordCacheGet(key, Boolean(cached))
      if (cached) {
        perf.finish(cached, 200, { resultCount: cached.length, source: 'cache' })
        return NextResponse.json(cached)
      }

      const results = await measureStage('screener.rankStocks', () => rankStocks(filters))
      await measureStage('cache.set', () => setCached(key, results, CACHE_TTL.SCREENER))
      perf.recordCacheSet(key, CACHE_TTL.SCREENER)
      perf.finish(results, 200, { resultCount: results.length, source: 'live' })
      return NextResponse.json(results)
    })
  } catch (error) {
    console.error('Screener error:', error)
    const message = error instanceof Error ? error.message : 'Failed to run screener'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
