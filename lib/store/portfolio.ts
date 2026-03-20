'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import type { PortfolioPosition } from '@/lib/types'

interface PortfolioState {
  positions: PortfolioPosition[]
  addPosition: (pos: Omit<PortfolioPosition, 'addedAt'>) => void
  updatePosition: (ticker: string, quantity: number, averageCost: number) => void
  removePosition: (ticker: string) => void
  hasPosition: (ticker: string) => boolean
}

export const usePortfolio = create<PortfolioState>()(
  persist(
    (set, get) => ({
      positions: [],
      addPosition: (pos) => {
        const existing = get().positions.find((p) => p.ticker === pos.ticker)
        if (existing) {
          // Upsert: update existing
          set((state) => ({
            positions: state.positions.map((p) =>
              p.ticker === pos.ticker
                ? { ...p, quantity: pos.quantity, averageCost: pos.averageCost }
                : p
            ),
          }))
          toast.success(`Posición de ${pos.ticker} actualizada`)
        } else {
          set((state) => ({
            positions: [...state.positions, { ...pos, addedAt: Date.now() }],
          }))
          toast.success(`${pos.ticker} agregado al portafolio`)
        }
      },
      updatePosition: (ticker, quantity, averageCost) => {
        set((state) => ({
          positions: state.positions.map((p) =>
            p.ticker === ticker ? { ...p, quantity, averageCost } : p
          ),
        }))
        toast.success(`Posición de ${ticker} actualizada`)
      },
      removePosition: (ticker) => {
        set((state) => ({
          positions: state.positions.filter((p) => p.ticker !== ticker),
        }))
        toast.info(`${ticker} eliminado del portafolio`)
      },
      hasPosition: (ticker) => {
        return get().positions.some((p) => p.ticker === ticker)
      },
    }),
    {
      name: 'stockvision-portfolio',
    }
  )
)
