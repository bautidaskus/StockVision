import { NextRequest, NextResponse } from 'next/server'
import { getCoinData } from '@/lib/apis/coingecko'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'
import type { CryptoOverview } from '@/lib/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id.toLowerCase()
  const key = cacheKey('crypto-overview', id)

  try {
    const cached = await getCached<CryptoOverview>(key)
    if (cached) return NextResponse.json(cached)

    const data = await getCoinData(id)
    if (!data || !data.id) {
      return NextResponse.json({ error: 'Crypto not found' }, { status: 404 })
    }

    const md = data.market_data

    const result: CryptoOverview = {
      id: data.id,
      symbol: data.symbol?.toUpperCase() || '',
      name: data.name || '',
      image: data.image?.large || '',
      price: md?.current_price?.usd || 0,
      change24h: md?.price_change_24h || 0,
      changePercent24h: md?.price_change_percentage_24h || 0,
      marketCap: md?.market_cap?.usd || 0,
      volume24h: md?.total_volume?.usd || 0,
      circulatingSupply: md?.circulating_supply || 0,
      totalSupply: md?.total_supply || null,
      maxSupply: md?.max_supply || null,
      ath: md?.ath?.usd || 0,
      athDate: md?.ath_date?.usd || '',
      atl: md?.atl?.usd || 0,
      atlDate: md?.atl_date?.usd || '',
      marketCapRank: data.market_cap_rank || 0,
      description: data.description?.en || '',
    }

    await setCached(key, result, CACHE_TTL.OVERVIEW)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Crypto overview error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch crypto data'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
