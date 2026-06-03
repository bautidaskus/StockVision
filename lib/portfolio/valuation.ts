import { cedearPriceArs, cedearPriceUsd } from '@/lib/cedears'
import type { PortfolioPosition } from '@/lib/types'

export type DisplayCurrency = 'USD' | 'ARS'

export interface PositionValuation {
  displayCurrency: DisplayCurrency
  price: number | null
  value: number | null
  cost: number
  pl: number | null
  plPct: number | null
  priceUsd: number | null
  valueUsd: number | null
  costUsd: number | null
  plUsd: number | null
  priceArs: number | null
  valueArs: number | null
  costArs: number | null
  plArs: number | null
}

export function valuePortfolioPosition(
  position: PortfolioPosition,
  marketPriceUsd: number | null | undefined,
  mepMid: number | null | undefined,
): PositionValuation {
  const quantity = position.quantity
  const cost = quantity * position.averageCost

  if (position.type === 'cedear') {
    const ratio = position.ratio
    const priceUsd = cedearPriceUsd(marketPriceUsd, ratio)
    const priceArs = cedearPriceArs(marketPriceUsd, ratio, mepMid)
    const valueUsd = priceUsd != null ? quantity * priceUsd : null
    const valueArs = priceArs != null ? quantity * priceArs : null
    const costArs = cost
    const costUsd = mepMid && mepMid > 0 ? costArs / mepMid : null
    const plArs = valueArs != null ? valueArs - costArs : null
    const plUsd = valueUsd != null && costUsd != null ? valueUsd - costUsd : null

    return {
      displayCurrency: 'ARS',
      price: priceArs,
      value: valueArs,
      cost: costArs,
      pl: plArs,
      plPct: costArs > 0 && plArs != null ? (plArs / costArs) * 100 : null,
      priceUsd,
      valueUsd,
      costUsd,
      plUsd,
      priceArs,
      valueArs,
      costArs,
      plArs,
    }
  }

  const priceUsd = typeof marketPriceUsd === 'number' && Number.isFinite(marketPriceUsd)
    ? marketPriceUsd
    : null
  const valueUsd = priceUsd != null ? quantity * priceUsd : null
  const costUsd = cost
  const plUsd = valueUsd != null ? valueUsd - costUsd : null

  return {
    displayCurrency: 'USD',
    price: priceUsd,
    value: valueUsd,
    cost: costUsd,
    pl: plUsd,
    plPct: costUsd > 0 && plUsd != null ? (plUsd / costUsd) * 100 : null,
    priceUsd,
    valueUsd,
    costUsd,
    plUsd,
    priceArs: null,
    valueArs: null,
    costArs: null,
    plArs: null,
  }
}
