import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import { buildOpportunityScore } from '@/lib/scoring/opportunity-score'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import type { OpportunityScore } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('score', ticker)
  const perf = createRequestPerformanceTracker('/api/stock/[ticker]/score', _request, {
    ticker,
    cacheKey: key,
  })

  try {
    return await perf.run(async () => {
      const cached = await measureStage('cache.get', () => getCached<OpportunityScore>(key))
      perf.recordCacheGet(key, Boolean(cached))
      if (cached) {
        perf.finish(cached, 200, { source: 'cache' })
        return NextResponse.json(cached)
      }

      const score = await measureStage('score.build', () => buildOpportunityScore(ticker))
      await measureStage('cache.set', () => setCached(key, score, CACHE_TTL.SCORE))
      perf.recordCacheSet(key, CACHE_TTL.SCORE)
      perf.finish(score, 200, { source: 'live' })
      return NextResponse.json(score)
    })
  } catch (error) {
    console.error('Score error:', error)
    const message = error instanceof Error ? error.message : 'Failed to compute score'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
