'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { usePortfolio } from '@/lib/store/portfolio'
import { lookupCedear, normalizeCedearTicker } from '@/lib/cedears'
import type { PortfolioPosition } from '@/lib/types'

type PositionType = 'stock' | 'crypto' | 'cedear'

interface AddPositionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingPosition?: PortfolioPosition | null
}

export function AddPositionDialog({ open, onOpenChange, editingPosition }: AddPositionDialogProps) {
  const addPosition = usePortfolio((s) => s.addPosition)
  const [ticker, setTicker] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<PositionType>('stock')
  const [quantity, setQuantity] = useState('')
  const [averageCost, setAverageCost] = useState('')
  const [ratio, setRatio] = useState('')

  const isEditing = !!editingPosition
  const isCedear = type === 'cedear'

  useEffect(() => {
    if (editingPosition) {
      setTicker(editingPosition.ticker)
      setName(editingPosition.name)
      setType(editingPosition.type)
      setQuantity(String(editingPosition.quantity))
      setAverageCost(String(editingPosition.averageCost))
      setRatio(editingPosition.ratio ? String(editingPosition.ratio) : '')
    } else {
      setTicker('')
      setName('')
      setType('stock')
      setQuantity('')
      setAverageCost('')
      setRatio('')
    }
  }, [editingPosition, open])

  // Autofill ratio + name from the curated list when the CEDEAR ticker matches.
  useEffect(() => {
    if (!isCedear || isEditing) return
    const hit = lookupCedear(ticker)
    if (hit) {
      if (!ratio) setRatio(String(hit.ratio))
      if (!name) setName(hit.name)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, type])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(quantity)
    const cost = parseFloat(averageCost)
    if (!ticker.trim() || qty <= 0 || cost <= 0) return

    if (isCedear) {
      const r = parseFloat(ratio)
      if (!Number.isFinite(r) || r <= 0) return
      const canonical = normalizeCedearTicker(ticker)
      const hit = lookupCedear(canonical)
      const underlying = hit?.underlying ?? canonical.replace(/\.BA$/, '')
      addPosition({
        ticker: canonical,
        name: name.trim() || hit?.name || canonical,
        type: 'cedear',
        quantity: qty,
        averageCost: cost,
        ratio: r,
        underlying,
      })
    } else {
      addPosition({
        ticker: ticker.toUpperCase().trim(),
        name: name.trim() || ticker.toUpperCase().trim(),
        type,
        quantity: qty,
        averageCost: cost,
      })
    }
    onOpenChange(false)
  }

  const costLabel = isCedear ? 'Costo Promedio (ARS)' : 'Costo Promedio (USD)'
  const costPlaceholder = isCedear ? '17500' : '150.00'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Posición' : 'Agregar Posición'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="ticker">Ticker</Label>
            <Input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder={isCedear ? 'AAPL.BA' : 'AAPL'}
              autoCapitalize="characters"
              disabled={isEditing}
              className="bg-background border-border font-mono-numbers"
            />
          </div>
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="assetType">Tipo de Activo</Label>
              <select
                id="assetType"
                value={type}
                onChange={(e) => setType(e.target.value as PositionType)}
                className="w-full h-10 rounded-md bg-background border-border border text-sm px-3 text-foreground"
              >
                <option value="stock">Stock / ETF</option>
                <option value="cedear">CEDEAR (AR)</option>
                <option value="crypto">Crypto</option>
              </select>
            </div>
          )}
          {isCedear && (
            <div className="space-y-2">
              <Label htmlFor="ratio">Ratio (CEDEARs por acción)</Label>
              <Input
                id="ratio"
                type="number"
                step="any"
                min="0"
                value={ratio}
                onChange={(e) => setRatio(e.target.value)}
                placeholder="20"
                className="bg-background border-border font-mono-numbers"
              />
              <p className="text-xs text-muted-foreground">
                Autocompletado desde la lista si el ticker coincide. Editalo si cambió por split.
              </p>
            </div>
          )}
          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="name">Nombre (opcional)</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Apple Inc."
                className="bg-background border-border"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad</Label>
            <Input
              id="quantity"
              type="number"
              step="any"
              min="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="10"
              className="bg-background border-border font-mono-numbers"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avgCost">{costLabel}</Label>
            <Input
              id="avgCost"
              type="number"
              step="any"
              min="0"
              value={averageCost}
              onChange={(e) => setAverageCost(e.target.value)}
              placeholder={costPlaceholder}
              className="bg-background border-border font-mono-numbers"
            />
          </div>
          <Button type="submit" className="w-full">
            {isEditing ? 'Guardar Cambios' : 'Agregar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
