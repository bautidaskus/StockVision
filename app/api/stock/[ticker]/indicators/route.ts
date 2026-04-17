import { NextRequest, NextResponse } from 'next/server'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import { getIndicatorsCached } from '@/lib/services/stock-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const perf = createRequestPerformanceTracker('/api/stock/[ticker]/indicators', request, { ticker })

  try {
    return await perf.run(async () => {
      const result = await measureStage('indicators.service', () => getIndicatorsCached(ticker))
      if (!result) {
        perf.finish({ error: 'Not enough price data for indicators' }, 404)
        return NextResponse.json({ error: 'Not enough price data for indicators' }, { status: 404 })
      }
      perf.finish(result, 200)
      return NextResponse.json(result)
    })
  } catch (error) {
    console.error('Indicators error:', error)
    const message = error instanceof Error ? error.message : 'Failed to calculate indicators'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
