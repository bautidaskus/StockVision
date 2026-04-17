import { NextRequest, NextResponse } from 'next/server'
import { createRequestPerformanceTracker, measureStage } from '@/lib/observability/performance'
import { getOverviewCached, getHistoryCached } from '@/lib/services/stock-service'
import { pickSparkline } from '@/lib/services/sparkline'
import type { BatchOverviewEntry, BatchOverviewResponse } from '@/lib/types'

const MAX_TICKERS = 50
const VALID_SPARK_RANGES = new Set(['1m', '3m', '6m', '1y'])

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('tickers') || ''
  const sparkParam = request.nextUrl.searchParams.get('spark') || '1m'
  const spark = VALID_SPARK_RANGES.has(sparkParam) ? sparkParam : '1m'
  const tickers = Array.from(
    new Set(
      raw
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean),
    ),
  )

  const perf = createRequestPerformanceTracker('/api/batch/overview', request, {
    count: tickers.length,
    spark,
  })

  if (tickers.length === 0) {
    perf.finish({ error: 'tickers required' }, 400)
    return NextResponse.json({ error: 'tickers required' }, { status: 400 })
  }
  if (tickers.length > MAX_TICKERS) {
    perf.finish({ error: 'too many tickers' }, 400)
    return NextResponse.json({ error: 'too many tickers' }, { status: 400 })
  }

  try {
    return await perf.run(async () => {
      const entries = await measureStage('batch.fetch', async () =>
        Promise.all(
          tickers.map(async (ticker): Promise<readonly [string, BatchOverviewEntry]> => {
            const [overview, history] = await Promise.all([
              getOverviewCached(ticker).catch(() => null),
              getHistoryCached(ticker, spark).catch(() => null),
            ])
            return [
              ticker,
              {
                overview,
                sparkline: history ? pickSparkline(history, spark) : [],
              },
            ] as const
          }),
        ),
      )

      const body: BatchOverviewResponse = Object.fromEntries(entries)
      perf.finish(body, 200)
      return NextResponse.json(body)
    })
  } catch (error) {
    console.error('Batch overview error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch batch overview'
    perf.finish({ error: message }, 500)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
