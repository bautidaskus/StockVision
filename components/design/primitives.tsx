'use client'

import { cn } from '@/lib/utils'
import { useId } from 'react'
import type { CSSProperties, HTMLAttributes, PropsWithChildren, ReactNode } from 'react'

type DivProps = HTMLAttributes<HTMLDivElement>

export function Card({ className, children, ...rest }: DivProps) {
  return (
    <div className={cn('sv-card', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardPad({ className, children, ...rest }: DivProps) {
  return (
    <div className={cn('sv-card card-pad', className)} {...rest}>
      {children}
    </div>
  )
}

interface SectionHeadProps {
  title: string
  sub?: string
  right?: ReactNode
  dangerouslyHtml?: boolean
}

export function SectionHead({ title, sub, right, dangerouslyHtml }: SectionHeadProps) {
  return (
    <div className="section-head">
      <div>
        {dangerouslyHtml ? (
          <h2 className="section-title" dangerouslySetInnerHTML={{ __html: title }} />
        ) : (
          <h2 className="section-title">{title}</h2>
        )}
        {sub && <div className="section-sub">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

interface DeltaProps {
  v: number
  pct?: number
  showSign?: boolean
  className?: string
}

export function Delta({ v, pct, showSign = true, className }: DeltaProps) {
  const up = v >= 0
  return (
    <span
      className={cn(up ? 'pos' : 'neg', 'mono', className)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {showSign ? (up ? '+' : '') : ''}
      {typeof v === 'number' ? v.toFixed(2) : v}
      {pct != null && (
        <span className="muted" style={{ fontSize: '0.92em' }}>
          ({up ? '+' : ''}{pct.toFixed(2)}%)
        </span>
      )}
    </span>
  )
}

interface SymbolMarkProps {
  ticker: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  style?: CSSProperties
}

export function SymbolMark({ ticker, size = 'md', className, style }: SymbolMarkProps) {
  const sizeStyle: CSSProperties =
    size === 'sm' ? { width: 22, height: 22, fontSize: 9 } :
    size === 'lg' ? { width: 48, height: 48, fontSize: 15, borderRadius: 8 } :
    {}
  return (
    <div className={cn('sym-mark', size === 'lg' && 'lg', className)} style={{ ...sizeStyle, ...style }}>
      {ticker.slice(0, 2).toUpperCase()}
    </div>
  )
}

export function Flag({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <span className={cn('flag', className)}>{children}</span>
}

export function Eyebrow({ children, className, style }: PropsWithChildren<{ className?: string; style?: CSSProperties }>) {
  return <div className={cn('eyebrow', className)} style={style}>{children}</div>
}

type ChipVariant = 'default' | 'pos' | 'neg' | 'accent'

export function Chip({ children, variant = 'default', className }: PropsWithChildren<{ variant?: ChipVariant; className?: string }>) {
  return <span className={cn('chip', variant !== 'default' && variant, className)}>{children}</span>
}

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  fill?: boolean
}

export function Sparkline({ data, width = 120, height = 30, color, fill = true }: SparklineProps) {
  const gradId = useId()
  if (!data || data.length === 0) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data.map((v, i) => [i * step, height - ((v - min) / range) * (height - 4) - 2] as [number, number])
  const path = points.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`
    const [px, py] = points[i - 1]
    const cx = (px + x) / 2
    return acc + ` Q${cx},${py} ${cx},${(py + y) / 2} T${x},${y}`
  }, '')
  const fillPath = path + ` L${width},${height} L0,${height} Z`
  const trend = data[data.length - 1] - data[0]
  const strokeColor = color || (trend >= 0 ? 'var(--pos)' : 'var(--neg)')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {fill && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#${gradId})`} />
        </>
      )}
      <path d={path} fill="none" stroke={strokeColor} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** Generate simple synthetic sparkline data for placeholders. */
export function genSpark(n = 20, trend = 1, seed = 0): number[] {
  const arr: number[] = []
  let v = 50
  for (let i = 0; i < n; i++) {
    const rnd = ((Math.sin((i + seed) * 13.37) + Math.cos((i + seed) * 7.71)) / 2 + 1) / 2
    v += (rnd - 0.5 + trend * 0.08) * 4
    arr.push(Math.max(5, Math.min(95, v)))
  }
  return arr
}
