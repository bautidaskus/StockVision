'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Search, TrendingUp, Bitcoin } from 'lucide-react'

interface SearchResult {
  ticker: string
  name: string
  type: 'stock' | 'crypto'
  exchange: string
  image?: string
}

const MIN_CHARS = 2
const DEBOUNCE_MS = 250

export function SearchBar() {
  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const trimmed = rawQuery.trim()
    const handle = setTimeout(() => setDebouncedQuery(trimmed), DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [rawQuery])

  const enabled = debouncedQuery.length >= MIN_CHARS
  const { data: results = [], isFetching: loading } = useQuery<SearchResult[]>({
    queryKey: ['search', debouncedQuery],
    enabled,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, { signal })
      if (!res.ok) throw new Error('Search failed')
      return res.json()
    },
  })

  useEffect(() => {
    if (!enabled) {
      setIsOpen(false)
      return
    }
    if (results.length > 0) setIsOpen(true)
  }, [enabled, results])

  function handleSelect(item: SearchResult) {
    setIsOpen(false)
    setRawQuery('')
    setDebouncedQuery('')
    if (item.type === 'crypto') {
      router.push(`/crypto/${item.ticker}`)
    } else {
      router.push(`/stock/${item.ticker}`)
    }
  }

  return (
    <div ref={ref} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Buscar por ticker o nombre (ej: AAPL, Bitcoin)..."
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          className="pl-10 h-12 text-base bg-card border-border"
          onFocus={() => enabled && results.length > 0 && setIsOpen(true)}
        />
        {loading && enabled && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -4 }}
          transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          className="absolute top-full mt-1 w-full bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden"
        >
          {results.map((item) => (
            <button
              key={`${item.type}-${item.ticker}`}
              onClick={() => handleSelect(item)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                {item.type === 'crypto' ? (
                  <Bitcoin className="w-4 h-4 text-[#f7931a]" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono-numbers font-semibold">
                    {item.type === 'stock' ? item.ticker : item.exchange}
                  </span>
                  <span className="text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-secondary">
                    {item.type === 'crypto' ? 'CRYPTO' : item.exchange || 'STOCK'}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground truncate">{item.name}</div>
              </div>
            </button>
          ))}
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
