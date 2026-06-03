import { describe, it, expect, beforeEach } from 'vitest'
import { usePortfolio } from '@/lib/store/portfolio'

describe('Portfolio Store', () => {
  beforeEach(() => {
    // Reset store state
    usePortfolio.setState({ positions: [] })
  })

  it('adds a new position', () => {
    usePortfolio.getState().addPosition({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      type: 'stock',
      quantity: 10,
      averageCost: 150,
    })

    const positions = usePortfolio.getState().positions
    expect(positions).toHaveLength(1)
    expect(positions[0].ticker).toBe('AAPL')
    expect(positions[0].quantity).toBe(10)
    expect(positions[0].averageCost).toBe(150)
    expect(positions[0].addedAt).toBeGreaterThan(0)
  })

  it('upserts when adding existing ticker', () => {
    usePortfolio.getState().addPosition({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      type: 'stock',
      quantity: 10,
      averageCost: 150,
    })

    usePortfolio.getState().addPosition({
      ticker: 'AAPL',
      name: 'Apple Inc.',
      type: 'stock',
      quantity: 20,
      averageCost: 160,
    })

    const positions = usePortfolio.getState().positions
    expect(positions).toHaveLength(1)
    expect(positions[0].quantity).toBe(20)
    expect(positions[0].averageCost).toBe(160)
  })

  it('updates an existing position', () => {
    usePortfolio.getState().addPosition({
      ticker: 'MSFT',
      name: 'Microsoft',
      type: 'stock',
      quantity: 5,
      averageCost: 300,
    })

    usePortfolio.getState().updatePosition('MSFT', 15, 310)

    const positions = usePortfolio.getState().positions
    expect(positions[0].quantity).toBe(15)
    expect(positions[0].averageCost).toBe(310)
  })

  it('removes a position', () => {
    usePortfolio.getState().addPosition({
      ticker: 'AAPL',
      name: 'Apple',
      type: 'stock',
      quantity: 10,
      averageCost: 150,
    })
    usePortfolio.getState().addPosition({
      ticker: 'MSFT',
      name: 'Microsoft',
      type: 'stock',
      quantity: 5,
      averageCost: 300,
    })

    usePortfolio.getState().removePosition('AAPL')

    const positions = usePortfolio.getState().positions
    expect(positions).toHaveLength(1)
    expect(positions[0].ticker).toBe('MSFT')
  })

  it('checks hasPosition correctly', () => {
    usePortfolio.getState().addPosition({
      ticker: 'TSLA',
      name: 'Tesla',
      type: 'stock',
      quantity: 3,
      averageCost: 200,
    })

    expect(usePortfolio.getState().hasPosition('TSLA')).toBe(true)
    expect(usePortfolio.getState().hasPosition('AAPL')).toBe(false)
  })

  it('preserves the asset type when upserting an existing position', () => {
    usePortfolio.getState().addPosition({
      ticker: 'BTC',
      name: 'Bitcoin',
      type: 'crypto',
      quantity: 1,
      averageCost: 50000,
    })

    usePortfolio.getState().addPosition({
      ticker: 'BTC',
      name: 'Bitcoin',
      type: 'crypto',
      quantity: 2,
      averageCost: 52000,
    })

    const positions = usePortfolio.getState().positions
    expect(positions).toHaveLength(1)
    expect(positions[0].type).toBe('crypto')
    expect(positions[0].quantity).toBe(2)
  })

  it('updates CEDEAR metadata when upserting an existing position', () => {
    usePortfolio.getState().addPosition({
      ticker: 'AAPL.BA',
      name: 'Apple',
      type: 'cedear',
      quantity: 10,
      averageCost: 17500,
      ratio: 20,
      underlying: 'AAPL',
    })

    const addedAt = usePortfolio.getState().positions[0].addedAt

    usePortfolio.getState().addPosition({
      ticker: 'AAPL.BA',
      name: 'Apple CEDEAR',
      type: 'cedear',
      quantity: 12,
      averageCost: 18000,
      ratio: 10,
      underlying: 'AAPL',
    })

    const positions = usePortfolio.getState().positions
    expect(positions).toHaveLength(1)
    expect(positions[0]).toMatchObject({
      ticker: 'AAPL.BA',
      name: 'Apple CEDEAR',
      type: 'cedear',
      quantity: 12,
      averageCost: 18000,
      ratio: 10,
      underlying: 'AAPL',
    })
    expect(positions[0].addedAt).toBe(addedAt)
  })
})
