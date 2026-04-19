import type { Metadata } from 'next'
import { Inter_Tight, JetBrains_Mono, Instrument_Serif } from 'next/font/google'
import { Providers } from '@/components/providers'
import { AppShell } from '@/components/design/shell'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
})

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-serif-display',
  weight: ['400'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'StockVision — Análisis de Inversiones',
  description: 'Herramienta personal de análisis de inversiones con IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable}`} data-theme="light" data-accent="blue" data-density="compact">
      <body className="antialiased">
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
