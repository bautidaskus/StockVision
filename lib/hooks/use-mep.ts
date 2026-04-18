'use client'

import { useQuery } from '@tanstack/react-query'
import type { FxRate } from '@/lib/services/fx'

export function useMep() {
  return useQuery<FxRate>({
    queryKey: ['fx-mep'],
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/fx/mep', { signal })
      if (!res.ok) throw new Error('FX unavailable')
      return res.json()
    },
  })
}
