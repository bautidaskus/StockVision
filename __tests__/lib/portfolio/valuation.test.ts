import { describe, expect, it } from 'vitest'
import { valuePortfolioPosition } from '@/lib/portfolio/valuation'
import type { PortfolioPosition } from '@/lib/types'

describe('valuePortfolioPosition', () => {
  it('values stocks in USD', () => {
    const position: PortfolioPosition = {
      ticker: 'AAPL',
      name: 'Apple',
      type: 'stock',
      quantity: 2,
      averageCost: 150,
      addedAt: 1,
    }

    const result = valuePortfolioPosition(position, 180, null)

    expect(result.displayCurrency).toBe('USD')
    expect(result.price).toBe(180)
    expect(result.value).toBe(360)
    expect(result.cost).toBe(300)
    expect(result.pl).toBe(60)
    expect(result.plPct).toBe(20)
    expect(result.valueUsd).toBe(360)
    expect(result.costUsd).toBe(300)
    expect(result.valueArs).toBeNull()
  })

  it('values CEDEARs in ARS from underlying USD price, ratio, and MEP', () => {
    const position: PortfolioPosition = {
      ticker: 'AAPL.BA',
      name: 'Apple CEDEAR',
      type: 'cedear',
      quantity: 10,
      averageCost: 17500,
      ratio: 20,
      underlying: 'AAPL',
      addedAt: 1,
    }

    const result = valuePortfolioPosition(position, 270, 1300)

    expect(result.displayCurrency).toBe('ARS')
    expect(result.price).toBe(17550)
    expect(result.value).toBe(175500)
    expect(result.cost).toBe(175000)
    expect(result.pl).toBe(500)
    expect(result.plPct).toBeCloseTo(0.285714, 5)
    expect(result.priceUsd).toBe(13.5)
    expect(result.valueUsd).toBe(135)
    expect(result.costUsd).toBeCloseTo(134.615384, 5)
    expect(result.priceArs).toBe(17550)
    expect(result.valueArs).toBe(175500)
    expect(result.costArs).toBe(175000)
  })

  it('keeps CEDEAR USD equivalent available when MEP is missing', () => {
    const position: PortfolioPosition = {
      ticker: 'AAPL.BA',
      name: 'Apple CEDEAR',
      type: 'cedear',
      quantity: 10,
      averageCost: 17500,
      ratio: 20,
      underlying: 'AAPL',
      addedAt: 1,
    }

    const result = valuePortfolioPosition(position, 270, null)

    expect(result.displayCurrency).toBe('ARS')
    expect(result.price).toBeNull()
    expect(result.value).toBeNull()
    expect(result.pl).toBeNull()
    expect(result.priceUsd).toBe(13.5)
    expect(result.valueUsd).toBe(135)
    expect(result.costUsd).toBeNull()
    expect(result.valueArs).toBeNull()
  })
})
