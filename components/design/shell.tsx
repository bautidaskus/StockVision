'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  Home,
  Briefcase,
  Filter,
  LineChart,
  Globe,
  Bitcoin,
  Sparkles,
  Star,
  Search,
  Bell,
  Settings,
  Moon,
  Sun,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWatchlist } from '@/lib/store/watchlist'
import { usePortfolio } from '@/lib/store/portfolio'
import { SearchBar } from '@/components/search-bar'

interface NavItem {
  id: string
  label: string
  href: string
  icon: LucideIcon
  badgeKey?: 'portfolio' | 'watchlist'
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Principal',
    items: [
      { id: 'home', label: 'Inicio', href: '/', icon: Home },
      { id: 'portfolio', label: 'Portfolio', href: '/portfolio', icon: Briefcase, badgeKey: 'portfolio' },
      { id: 'screener', label: 'Screener', href: '/screener', icon: Filter },
    ],
  },
  {
    section: 'Mercados',
    items: [
      { id: 'stocks', label: 'Stocks', href: '/stock/AAPL', icon: LineChart },
      { id: 'cedear', label: 'CEDEARs', href: '/stock/GGAL', icon: Globe },
      { id: 'crypto', label: 'Crypto', href: '/crypto/bitcoin', icon: Bitcoin },
    ],
  },
  {
    section: 'Herramientas',
    items: [
      { id: 'ai', label: 'Análisis IA', href: '/ai', icon: Sparkles },
      { id: 'watchlist', label: 'Watchlist', href: '/#watchlist', icon: Star, badgeKey: 'watchlist' },
    ],
  },
]

interface Tweaks {
  theme: 'light' | 'dark'
  accent: 'blue' | 'sage' | 'slate'
  density: 'compact' | 'regular' | 'comfy'
}

const DEFAULT_TWEAKS: Tweaks = { theme: 'light', accent: 'blue', density: 'compact' }

function useTweaks() {
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULT_TWEAKS)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sv-tweaks')
      if (raw) setTweaks({ ...DEFAULT_TWEAKS, ...JSON.parse(raw) })
    } catch {}
  }, [])
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tweaks.theme)
    document.documentElement.setAttribute('data-accent', tweaks.accent)
    document.documentElement.setAttribute('data-density', tweaks.density)
    try { localStorage.setItem('sv-tweaks', JSON.stringify(tweaks)) } catch {}
  }, [tweaks])
  const setTweak = useCallback(<K extends keyof Tweaks>(k: K, v: Tweaks[K]) => {
    setTweaks((t) => ({ ...t, [k]: v }))
  }, [])
  return { tweaks, setTweak }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/'
  const isBare = pathname.startsWith('/login')
  const watchlistCount = useWatchlist((s) => s.items.length)
  const portfolioCount = usePortfolio((s) => s.positions.length)
  const { tweaks, setTweak } = useTweaks()
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  function isActive(item: NavItem) {
    if (item.href === '/') return pathname === '/'
    if (item.id === 'stocks') return pathname.startsWith('/stock/')
    if (item.id === 'crypto') return pathname.startsWith('/crypto/')
    if (item.href.startsWith('/#')) return false
    return pathname.startsWith(item.href)
  }

  if (isBare) return <>{children}</>

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="brand-mark">s</div>
          <div className="brand-name">
            Stock<em>Vision</em>
          </div>
        </Link>
        {NAV.map((section) => (
          <div key={section.section} className="nav-section">
            <div className="nav-section-title">{section.section}</div>
            {section.items.map((item) => {
              const Icon = item.icon
              const badge =
                item.badgeKey === 'portfolio' ? portfolioCount :
                item.badgeKey === 'watchlist' ? watchlistCount : null
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn('nav-item', isActive(item) && 'active')}
                  style={{ textDecoration: 'none' }}
                >
                  <Icon className="nav-icon" size={16} />
                  <span>{item.label}</span>
                  {badge != null && badge > 0 && <span className="nav-badge">{badge}</span>}
                </Link>
              )
            })}
          </div>
        ))}
        <div style={{ marginTop: 'auto', padding: '16px 22px', borderTop: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2">
            <div
              className="sym-mark"
              style={{ width: 26, height: 26, fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'transparent' }}
            >
              JR
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.2 }}>
              <div style={{ fontWeight: 500 }}>Julián R.</div>
              <div className="faint" style={{ fontSize: 10.5 }}>Plan personal</div>
            </div>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <div className="search-wrap">
          <Search size={15} className="search-icon-wrap" />
          <input
            type="text"
            className="sv-search"
            placeholder="Buscar acción, CEDEAR o crypto..."
            onFocus={() => setSearchOpen(true)}
            readOnly
          />
          <span className="search-kbd">⌘K</span>
        </div>
        <div className="topbar-right">
          <button
            className="icon-btn"
            onClick={() => setTweak('theme', tweaks.theme === 'light' ? 'dark' : 'light')}
            title="Tema"
            aria-label="Cambiar tema"
          >
            {tweaks.theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button className="icon-btn" aria-label="Notificaciones">
            <Bell size={16} />
          </button>
          <button className="icon-btn" onClick={() => setTweaksOpen((o) => !o)} aria-label="Ajustes">
            <Settings size={16} />
          </button>
        </div>
      </header>

      <main className="main-content view-fade-in" key={pathname}>
        {children}
      </main>

      {searchOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(10,10,8,0.35)', zIndex: 60,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh',
          }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            style={{
              width: 'min(560px, 92vw)', background: 'var(--bg-elev)', border: '1px solid var(--line)',
              borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: 16,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <SearchBar />
          </div>
        </div>
      )}

      {tweaksOpen && (
        <div
          style={{
            position: 'fixed', bottom: 20, right: 20, width: 280,
            background: 'var(--bg-elev)', border: '1px solid var(--line)',
            borderRadius: 12, boxShadow: 'var(--shadow-lg)', padding: '14px 16px 16px', zIndex: 100,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
            <span className="serif" style={{ fontSize: 16, fontStyle: 'italic' }}>Tweaks</span>
            <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setTweaksOpen(false)}>
              <X size={13} />
            </button>
          </div>

          <TweakRow label="Tema">
            {(['light', 'dark'] as const).map((t) => (
              <button key={t} className={cn('tweak-opt', tweaks.theme === t && 'active')} onClick={() => setTweak('theme', t)}>
                {t === 'light' ? 'Claro' : 'Oscuro'}
              </button>
            ))}
          </TweakRow>

          <TweakRow label="Acento">
            <div style={{ display: 'flex', gap: 6 }}>
              {([
                { id: 'blue', c: '#1e4d75' },
                { id: 'sage', c: '#3a8a63' },
                { id: 'slate', c: '#2a2a28' },
              ] as const).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setTweak('accent', s.id)}
                  title={s.id}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: tweaks.accent === s.id ? '2px solid var(--fg)' : '2px solid transparent',
                    padding: 0, cursor: 'pointer', position: 'relative', background: 'transparent',
                  }}
                >
                  <span style={{
                    position: 'absolute', inset: 2, borderRadius: '50%',
                    background: s.c, border: '0.5px solid rgba(0,0,0,0.1)',
                  }} />
                </button>
              ))}
            </div>
          </TweakRow>

          <TweakRow label="Densidad">
            {(['compact', 'regular', 'comfy'] as const).map((d) => (
              <button key={d} className={cn('tweak-opt', tweaks.density === d && 'active')} onClick={() => setTweak('density', d)}>
                {d === 'compact' ? 'Compacta' : d === 'regular' ? 'Normal' : 'Amplia'}
              </button>
            ))}
          </TweakRow>
        </div>
      )}

      <style jsx>{`
        .tweak-opt {
          flex: 1;
          padding: 6px 8px;
          font-size: 12px;
          border: 1px solid var(--line);
          border-radius: 6px;
          background: var(--bg);
          text-align: center;
          cursor: pointer;
          color: var(--fg);
        }
        .tweak-opt:hover { background: var(--bg-hover); }
        .tweak-opt.active { background: var(--fg); color: var(--bg); border-color: var(--fg); }
      `}</style>
    </div>
  )
}

function TweakRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      <span style={{ fontSize: 11, color: 'var(--fg-subtle)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>{children}</div>
    </div>
  )
}
