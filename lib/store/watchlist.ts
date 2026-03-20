'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import type { WatchlistItem } from '@/lib/types'

interface WatchlistState {
  items: WatchlistItem[]
  addItem: (item: Omit<WatchlistItem, 'addedAt'>) => void
  removeItem: (ticker: string) => void
  hasItem: (ticker: string) => boolean
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const exists = get().items.some((i) => i.ticker === item.ticker)
        if (exists) return
        set((state) => ({
          items: [...state.items, { ...item, addedAt: Date.now() }],
        }))
        toast.success(`${item.ticker} agregado a la watchlist`)
      },
      removeItem: (ticker) => {
        set((state) => ({
          items: state.items.filter((i) => i.ticker !== ticker),
        }))
        toast.info(`${ticker} eliminado de la watchlist`)
      },
      hasItem: (ticker) => {
        return get().items.some((i) => i.ticker === ticker)
      },
    }),
    {
      name: 'stockvision-watchlist',
    }
  )
)
