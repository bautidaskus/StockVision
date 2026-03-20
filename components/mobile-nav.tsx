'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

const links = [
  { href: '/', label: 'Inicio' },
  { href: '/screener', label: 'Screener' },
]

export function MobileNav() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-lg hover:bg-secondary transition-colors"
        aria-label="Menu"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 right-0 h-full w-64 bg-card border-l border-border z-50 flex flex-col pt-16 px-4 gap-2"
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Cerrar menu"
              >
                <X className="w-5 h-5" />
              </button>

              {links.map((link) => (
                <button
                  key={link.href}
                  onClick={() => navigate(link.href)}
                  className="text-left px-3 py-3 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
