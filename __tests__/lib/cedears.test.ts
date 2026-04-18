import { describe, it, expect } from 'vitest'
import {
  lookupCedear,
  normalizeCedearTicker,
  cedearPriceArs,
  cedearPriceUsd,
} from '@/lib/cedears'

describe('normalizeCedearTicker', () => {
  it('appends .BA when missing', () => {
    expect(normalizeCedearTicker('aapl')).toBe('AAPL.BA')
  })
  it('keeps .BA when already present', () => {
    expect(normalizeCedearTicker('AAPL.BA')).toBe('AAPL.BA')
  })
  it('trims and uppercases', () => {
    expect(normalizeCedearTicker('  meli  ')).toBe('MELI.BA')
  })
  it('returns empty string for empty input', () => {
    expect(normalizeCedearTicker('')).toBe('')
  })
})

describe('lookupCedear', () => {
  it('finds AAPL.BA with its canonical ratio', () => {
    const entry = lookupCedear('AAPL.BA')
    expect(entry?.underlying).toBe('AAPL')
    expect(entry?.ratio).toBeGreaterThan(0)
  })
  it('accepts raw ticker without .BA', () => {
    expect(lookupCedear('MELI')?.underlying).toBe('MELI')
  })
  it('returns null for unknown tickers', () => {
    expect(lookupCedear('UNKNOWNX')).toBeNull()
  })
})

describe('cedearPriceArs', () => {
  it('computes (underlying / ratio) × mep', () => {
    expect(cedearPriceArs(270, 20, 1300)).toBe((270 / 20) * 1300)
  })
  it('returns null for missing inputs', () => {
    expect(cedearPriceArs(null, 20, 1300)).toBeNull()
    expect(cedearPriceArs(270, 0, 1300)).toBeNull()
    expect(cedearPriceArs(270, 20, undefined)).toBeNull()
  })
  it('returns null for non-positive ratio or mep', () => {
    expect(cedearPriceArs(270, -1, 1300)).toBeNull()
    expect(cedearPriceArs(270, 20, -1)).toBeNull()
  })
})

describe('cedearPriceUsd', () => {
  it('divides underlying by ratio', () => {
    expect(cedearPriceUsd(270, 20)).toBe(13.5)
  })
  it('returns null for zero or missing', () => {
    expect(cedearPriceUsd(270, 0)).toBeNull()
    expect(cedearPriceUsd(null, 20)).toBeNull()
  })
})
