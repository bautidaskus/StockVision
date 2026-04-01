import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import { rankStocks } from '@/lib/ranking/stock-ranking'
import { parseScoreWindow, parseScreenerFilters } from '@/lib/screener/filters'
import { enrichScreenerResults, runEquivalentFastScreener, runScreener } from '@/lib/screener/service'
import type { ScreenerResult } from '@/lib/types'

const FMP_FAILURE_COOLDOWN_MS = 15 * 60 * 1000
let fmpFastPathBlockedUntil = 0

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

async function runFastPathWithFallback(filters: ReturnType<typeof parseScreenerFilters>, scoreWindow: number) {
  if (Date.now() >= fmpFastPathBlockedUntil) {
    try {
      return await runScreener(filters, { scoreWindow })
    } catch (fastPathError) {
      const message = fastPathError instanceof Error ? fastPathError.message : String(fastPathError)
      if (message.includes('FMP error: 402') || message.includes('FMP error: 403')) {
        fmpFastPathBlockedUntil = Date.now() + FMP_FAILURE_COOLDOWN_MS
      }
      console.warn('Screener fast path failed, trying equivalent fast path:', fastPathError)
    }
  }

  try {
    return await runEquivalentFastScreener(filters, { scoreWindow })
  } catch (equivalentError) {
    console.warn('Equivalent fast path failed, falling back to legacy ranking:', equivalentError)
    return rankStocks(filters)
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const filters = parseScreenerFilters(searchParams)
  const scoreWindow = parseScoreWindow(searchParams)
  const key = buildCacheKey(searchParams)
  const baseParams = new URLSearchParams(searchParams)
  baseParams.delete('scoreWindow')
  const baseKey = buildCacheKey(baseParams)
  const perf = createRequestPerformanceTracker('/api/screener', request, {
    filters,
    scoreWindow,
    cacheKey: key,
    baseCacheKey: baseKey,
  })

  try {
    return await perf.run(async () => {
      const cached = await measureStage('cache.get', () => getCached<ScreenerResult[]>(key))
      perf.recordCacheGet(key, Boolean(cached))
      if (cached) {
        perf.finish(cached, 200, { resultCount: cached.length, source: 'cache' })
        return NextResponse.json(cached)
      }

      let results: ScreenerResult[]

      if (scoreWindow > 0) {
        const baseCached = await measureStage('cache.get-base', () => getCached<ScreenerResult[]>(baseKey))
        perf.recordCacheGet(baseKey, Boolean(baseCached))
        if (baseCached) {
          results = await measureStage('screener.enrich-from-base-cache', () =>
            enrichScreenerResults(baseCached, scoreWindow))
        } else {
          results = await measureStage('screener.run', () => runFastPathWithFallback(filters, scoreWindow))
        }
      } else {
        results = await measureStage('screener.run', () => runFastPathWithFallback(filters, scoreWindow))
      }

      await measureStage('cache.set', () => setCached(key, results, CACHE_TTL.SCREENER))
      perf.recordCacheSet(key, CACHE_TTL.SCREENER)
      perf.finish(results, 200, {
        resultCount: results.length,
        source: 'live',
        scoreWindow,
      })
      return NextResponse.json(results)
    })
  } catch (error) {
    console.error('Screener error:', error)
    const message = error instanceof Error ? error.message : 'Failed to run screener'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
