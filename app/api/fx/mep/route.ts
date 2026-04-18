import { NextRequest, NextResponse } from 'next/server'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import { getMepCached } from '@/lib/services/fx'

export async function GET(request: NextRequest) {
  const perf = createRequestPerformanceTracker('/api/fx/mep', request)
  try {
    return await perf.run(async () => {
      const rate = await measureStage('fx.mep', () => getMepCached())
      if (!rate) {
        perf.finish({ error: 'FX unavailable' }, 503)
        return NextResponse.json({ error: 'FX unavailable' }, { status: 503 })
      }
      perf.finish(rate, 200)
      return NextResponse.json(rate)
    })
  } catch (error) {
    console.error('FX MEP error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch FX'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
