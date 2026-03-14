// Stock Overview
export interface StockOverview {
  ticker: string
  name: string
  sector: string
  industry: string
  description: string
  price: number
  change: number
  changePercent: number
  marketCap: number
  pe: number | null
  forwardPe: number | null
  eps: number | null
  dividendYield: number | null
  beta: number | null
  week52High: number
  week52Low: number
  sharesOutstanding: number
  evToEbitda: number | null
  priceToSales: number | null
  priceToBook: number | null
  pegRatio: number | null
}

// OHLCV candle
export interface OHLCV {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Technical indicators
export interface TechnicalIndicators {
  rsi: { date: string; value: number }[]
  macd: { date: string; macd: number; signal: number; histogram: number }[]
  sma20: { date: string; value: number }[]
  sma50: { date: string; value: number }[]
  sma200: { date: string; value: number }[]
}

// Financial statement
export interface FinancialStatement {
  date: string
  period: string
  revenue: number
  costOfRevenue: number
  grossProfit: number
  grossProfitRatio: number
  operatingIncome: number
  netIncome: number
  netIncomeRatio: number
  eps: number
  epsDiluted: number
  ebitda: number
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  totalDebt: number
  cashAndEquivalents: number
  operatingCashFlow: number
  freeCashFlow: number
  roe: number | null
  roa: number | null
  debtToEquity: number | null
}

// News
export interface NewsItem {
  headline: string
  summary: string
  url: string
  datetime: number
  source: string
  image?: string
}

// Watchlist item
export interface WatchlistItem {
  ticker: string
  name: string
  type: 'stock' | 'crypto'
  addedAt: number
}

// Crypto Overview
export interface CryptoOverview {
  id: string
  symbol: string
  name: string
  image: string
  price: number
  change24h: number
  changePercent24h: number
  marketCap: number
  volume24h: number
  circulatingSupply: number
  totalSupply: number | null
  maxSupply: number | null
  ath: number
  athDate: string
  atl: number
  atlDate: string
  marketCapRank: number
  description: string
}

// Analyst recommendations (Finnhub)
export interface AnalystRecommendation {
  period: string
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
}

// Earnings data
export interface EarningsHistoryItem {
  date: string
  epsEstimate: number | null
  epsActual: number | null
  epsSurprise: number | null
  epsSurprisePercent: number | null
}

export interface EarningsData {
  nextEarningsDate: string | null
  earningsHistory: EarningsHistoryItem[]
}

// Insider trading
export interface InsiderTransaction {
  name: string
  position: string
  date: string
  shares: number
  value: number | null
  type: 'buy' | 'sell' | 'other'
}

export interface InsiderData {
  transactions: InsiderTransaction[]
  netBuying: number
  buyCount: number
  sellCount: number
}

// Portfolio
export interface PortfolioPosition {
  ticker: string
  name: string
  type: 'stock' | 'crypto'
  quantity: number
  averageCost: number
  addedAt: number
}

// Analyst estimates
export interface AnalystEstimates {
  targetHigh: number
  targetLow: number
  targetMean: number
  targetMedian: number
  strongBuy: number
  buy: number
  hold: number
  sell: number
  strongSell: number
}

// ─── Screener ──────────────────────────────────────────────────────

export interface ScreenerFilters {
  // Exchange
  exchange?: 'NASDAQ' | 'NYSE' | 'AMEX' | ''

  // Sector (valores exactos que acepta FMP)
  sector?: string

  // Market cap en USD
  marketCapMin?: number
  marketCapMax?: number

  // Valuación
  peMin?: number
  peMax?: number
  pbMin?: number
  pbMax?: number

  // Rentabilidad (en porcentaje, ej: 15 = 15%)
  roeMin?: number
  netMarginMin?: number

  // Riesgo / estructura
  betaMin?: number
  betaMax?: number
  debtToEquityMax?: number

  // Dividendo (en porcentaje, ej: 2 = 2%)
  dividendMin?: number

  // Técnico
  // Porcentaje de caída desde máximo de 52 semanas (ej: -20 = cayó 20%)
  pctFromHighMax?: number

  // Paginación
  limit?: number
}

export interface ScreenerResult {
  ticker: string
  name: string
  sector: string
  industry: string
  exchange: string
  price: number
  marketCap: number
  pe: number | null
  pb: number | null
  roe: number | null           // en decimal, ej: 0.25 = 25%
  netMargin: number | null     // en decimal, ej: 0.12 = 12%
  beta: number | null
  dividendYield: number | null // en decimal, ej: 0.03 = 3%
  week52High: number
  week52Low: number
  changePercent: number        // cambio % del día
}
