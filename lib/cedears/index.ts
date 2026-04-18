import { CEDEAR_RATIOS, type CedearEntry } from './list'

/** Normalizes a user-entered ticker to the canonical `.BA` form. */
export function normalizeCedearTicker(raw: string): string {
  const t = raw.trim().toUpperCase()
  if (!t) return ''
  return t.endsWith('.BA') ? t : `${t}.BA`
}

/** Returns the CEDEAR entry for a ticker, or null if unknown. Accepts with or without `.BA`. */
export function lookupCedear(raw: string): CedearEntry | null {
  const key = normalizeCedearTicker(raw)
  return CEDEAR_RATIOS[key] ?? null
}

/**
 * Price of one CEDEAR in ARS.
 *   priceArs = (underlyingPriceUsd / ratio) × mep
 * Returns null if any input is missing/invalid.
 */
export function cedearPriceArs(
  underlyingPriceUsd: number | null | undefined,
  ratio: number | null | undefined,
  mep: number | null | undefined,
): number | null {
  if (!underlyingPriceUsd || !ratio || !mep) return null
  if (ratio <= 0 || mep <= 0) return null
  return (underlyingPriceUsd / ratio) * mep
}

/** Price of one CEDEAR in USD equivalent (underlying / ratio). */
export function cedearPriceUsd(
  underlyingPriceUsd: number | null | undefined,
  ratio: number | null | undefined,
): number | null {
  if (!underlyingPriceUsd || !ratio) return null
  if (ratio <= 0) return null
  return underlyingPriceUsd / ratio
}

export { CEDEAR_RATIOS }
export type { CedearEntry }
