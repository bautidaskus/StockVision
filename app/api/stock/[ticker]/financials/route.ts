import { NextRequest, NextResponse } from 'next/server'
import { getFinancialsCached } from '@/lib/services/stock-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const period = (request.nextUrl.searchParams.get('period') || 'quarterly') as 'quarterly' | 'annual'
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '8')

  try {
    const result = await getFinancialsCached(ticker, period, limit)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Financials error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch financials'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
