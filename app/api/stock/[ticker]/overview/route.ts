import { NextRequest, NextResponse } from 'next/server'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import { getOverviewCached } from '@/lib/services/stock-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const perf = createRequestPerformanceTracker('/api/stock/[ticker]/overview', request, { ticker })

  try {
    return await perf.run(async () => {
      const result = await measureStage('overview.service', () => getOverviewCached(ticker))
      if (!result) {
        perf.finish({ error: 'Ticker not found' }, 404)
        return NextResponse.json({ error: 'Ticker not found' }, { status: 404 })
      }
      perf.finish(result, 200)
      return NextResponse.json(result)
    })
  } catch (error) {
    console.error('Overview error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch overview'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
