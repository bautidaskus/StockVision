import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import { buildOpportunityScore } from '@/lib/scoring/opportunity-score'
import type { OpportunityScore } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('score', ticker)

  try {
    const cached = await getCached<OpportunityScore>(key)
    if (cached) return NextResponse.json(cached)

    const score = await buildOpportunityScore(ticker)
    await setCached(key, score, CACHE_TTL.SCORE)
    return NextResponse.json(score)
  } catch (error) {
    console.error('Score error:', error)
    const message = error instanceof Error ? error.message : 'Failed to compute score'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
