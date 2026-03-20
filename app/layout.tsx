import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from '@/components/providers'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
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
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased font-sans min-h-screen">
        <Providers>
          <nav className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
            <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
              <a href="/" className="flex items-center gap-2 font-semibold text-lg">
                <span className="text-primary">SV</span>
                <span>StockVision</span>
              </a>
              <a
                href="/screener"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Screener
              </a>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>
          <Toaster position="bottom-right" theme="dark" richColors />
        </Providers>
      </body>
    </html>
  )
}
