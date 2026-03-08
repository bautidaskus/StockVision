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
