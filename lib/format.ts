export function formatCurrency(value: number, decimals = 2): string {
  if (value == null || isNaN(value)) return 'N/A'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatLargeNumber(num: number): string {
  if (num == null || isNaN(num)) return 'N/A'
  if (Math.abs(num) >= 1e12) return (num / 1e12).toFixed(2) + 'T'
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  return num.toFixed(2)
}

export function formatPercent(value: number | null, decimals = 2): string {
  if (value === null || value === undefined) return 'N/A'
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

export function formatQuarter(dateStr: string): string {
  const date = new Date(dateStr)
  const quarter = Math.ceil((date.getMonth() + 1) / 3)
  return `Q${quarter} ${date.getFullYear()}`
}

export function colorForValue(value: number): string {
  if (value > 0) return 'text-green'
  if (value < 0) return 'text-red'
  return 'text-muted-foreground'
}
