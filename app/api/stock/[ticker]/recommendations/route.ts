import { NextRequest, NextResponse } from 'next/server'
import { getRecommendationTrends } from '@/lib/apis/finnhub'
import { getYahooRecommendationTrend } from '@/lib/apis/yahoo'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import type { AnalystRecommendation } from '@/lib/types'

interface RecommendationsResponse {
  recommendations: AnalystRecommendation[]
  consensus: string
  totalAnalysts: number
}

function calculateConsensus(recs: AnalystRecommendation[]): { consensus: string; totalAnalysts: number } {
  if (recs.length === 0) return { consensus: 'Sin datos', totalAnalysts: 0 }

  const latest = recs[0]
  const total = latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell
  if (total === 0) return { consensus: 'Sin datos', totalAnalysts: 0 }

  const weightedSum =
    latest.strongBuy * 5 +
    latest.buy * 4 +
    latest.hold * 3 +
    latest.sell * 2 +
    latest.strongSell * 1
  const avg = weightedSum / total

  let consensus: string
  if (avg >= 4.5) consensus = 'Compra Fuerte'
  else if (avg >= 3.5) consensus = 'Compra'
  else if (avg >= 2.5) consensus = 'Mantener'
  else if (avg >= 1.5) consensus = 'Vender'
  else consensus = 'Venta Fuerte'

  return { consensus, totalAnalysts: total }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('recommendations', ticker)

  try {
    const cached = await getCached<RecommendationsResponse>(key)
    if (cached) return NextResponse.json(cached)

    let recommendations = await getRecommendationTrends(ticker).catch((error) => {
      console.warn('Finnhub recommendations failed:', error)
      return []
    })

    if (recommendations.length === 0) {
      recommendations = await getYahooRecommendationTrend(ticker).catch((error) => {
        console.warn('Yahoo recommendations failed:', error)
        return []
      })
    }

    const { consensus, totalAnalysts } = calculateConsensus(recommendations)
    const response: RecommendationsResponse = { recommendations, consensus, totalAnalysts }

    await setCached(key, response, CACHE_TTL.RECOMMENDATIONS)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Recommendations error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch recommendations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
