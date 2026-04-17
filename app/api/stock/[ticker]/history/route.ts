import { NextRequest, NextResponse } from 'next/server'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import { getHistoryCached } from '@/lib/services/stock-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const range = request.nextUrl.searchParams.get('range') || '1y'
  const perf = createRequestPerformanceTracker('/api/stock/[ticker]/history', request, { ticker, range })

  try {
    return await perf.run(async () => {
      const result = await measureStage('history.service', () => getHistoryCached(ticker, range))
      if (!result || result.length === 0) {
        perf.finish({ error: 'No history data found' }, 404)
        return NextResponse.json({ error: 'No history data found' }, { status: 404 })
      }
      perf.finish(result, 200, { points: result.length })
      return NextResponse.json(result)
    })
  } catch (error) {
    console.error('History error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch history'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
