import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true'
  const type = request.nextUrl.searchParams.get('type') || 'stock' // stock or crypto
  const cKey = cacheKey('analysis', type, ticker)

  try {
    // Check cache unless force refresh
    if (!forceRefresh) {
      const cached = await getCached<string>(cKey)
      if (cached) {
        return new Response(cached, {
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    }

    // Gather data from our own API routes
    const baseUrl = request.nextUrl.origin
    const dataPromises = type === 'crypto'
      ? [
          fetchInternalJson(`${baseUrl}/api/crypto/${ticker.toLowerCase()}/overview`),
          fetchInternalJson(`${baseUrl}/api/crypto/${ticker.toLowerCase()}/history?range=3m`),
        ]
      : [
          fetchInternalJson(`${baseUrl}/api/stock/${ticker}/overview`),
          fetchInternalJson(`${baseUrl}/api/stock/${ticker}/history?range=3m`),
          fetchInternalJson(`${baseUrl}/api/stock/${ticker}/indicators`),
          fetchInternalJson(`${baseUrl}/api/stock/${ticker}/financials?period=quarterly&limit=4`),
          fetchInternalJson(`${baseUrl}/api/stock/${ticker}/news`),
        ]

    const results = await Promise.all(dataPromises)

    let prompt: string
    if (type === 'crypto') {
      const [overview, history] = results
      prompt = buildCryptoPrompt(ticker, overview, history)
    } else {
      const [overview, history, indicators, financials, news] = results
      prompt = buildStockPrompt(ticker, overview, history, indicators, financials, news)
    }

    // Call Gemini with streaming
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const result = await model.generateContentStream(prompt)

    let fullText = ''

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              fullText += text
              controller.enqueue(new TextEncoder().encode(text))
            }
          }
          // Cache the complete response
          await setCached(cKey, fullText, CACHE_TTL.AI_ANALYSIS)
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Analysis error:', error)
    const message = error instanceof Error ? error.message : 'Failed to generate analysis'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function fetchInternalJson(url: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

function buildStockPrompt(
  ticker: string,
  overview: Record<string, unknown> | null,
  history: Array<Record<string, number>> | null,
  indicators: Record<string, unknown> | null,
  financials: Record<string, unknown> | null,
  news: Array<Record<string, unknown>> | null,
): string {
  const o = overview || {} as Record<string, unknown>
  const price = Number(o.price) || 0
  const w52high = Number(o.week52High) || 0
  const w52low = Number(o.week52Low) || 0
  const position52w = w52high > w52low ? (((price - w52low) / (w52high - w52low)) * 100).toFixed(1) : 'N/A'

  // Get latest indicator values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ind = (indicators || {}) as any
  const latestRsiVal = ind.rsi?.slice(-1)[0]?.value as number | undefined
  const latestMacd = ind.macd?.slice(-1)[0] as { macd: number; signal: number; histogram: number } | undefined
  const latestSma20Val = ind.sma20?.slice(-1)[0]?.value as number | undefined
  const latestSma50Val = ind.sma50?.slice(-1)[0]?.value as number | undefined
  const latestSma200Val = ind.sma200?.slice(-1)[0]?.value as number | undefined

  const latestRsi = latestRsiVal != null ? String(latestRsiVal) : 'N/A'
  const latestSma20 = latestSma20Val != null ? String(latestSma20Val) : 'N/A'
  const latestSma50 = latestSma50Val != null ? String(latestSma50Val) : 'N/A'
  const latestSma200 = latestSma200Val != null ? String(latestSma200Val) : 'N/A'

  // Interpret RSI
  const rsiVal = latestRsiVal
  const rsiInterpretation = rsiVal == null ? 'N/A' : rsiVal > 70 ? 'Sobrecomprado' : rsiVal < 30 ? 'Sobrevendido' : 'Neutral'

  // MACD interpretation
  const macdTrend = latestMacd
    ? latestMacd.histogram > 0 ? 'Alcista' : 'Bajista'
    : 'N/A'

  // SMA comparisons
  const sma20Diff = latestSma20Val != null ? (((price - latestSma20Val) / latestSma20Val) * 100).toFixed(2) : 'N/A'
  const sma50Diff = latestSma50Val != null ? (((price - latestSma50Val) / latestSma50Val) * 100).toFixed(2) : 'N/A'
  const sma200Diff = latestSma200Val != null ? (((price - latestSma200Val) / latestSma200Val) * 100).toFixed(2) : 'N/A'

  // 3-month trend
  const histArr = history || []
  let trendDescription = 'N/A'
  if (histArr.length > 1) {
    const firstPrice = histArr[0]?.close || 0
    const lastPrice = histArr[histArr.length - 1]?.close || 0
    const pctChange = firstPrice > 0 ? (((lastPrice - firstPrice) / firstPrice) * 100).toFixed(1) : '0'
    trendDescription = `${Number(pctChange) >= 0 ? '+' : ''}${pctChange}% en 3 meses`
  }

  // Financials
  const fin = financials as Record<string, unknown> | null
  const statements = (fin?.statements as Array<Record<string, unknown>>) || []
  const latest = statements[0] || {} as Record<string, unknown>
  const previous = statements[3] || {} as Record<string, unknown> // YoY comparison

  const revenueGrowth = Number(previous.revenue) > 0
    ? (((Number(latest.revenue) - Number(previous.revenue)) / Number(previous.revenue)) * 100).toFixed(1)
    : 'N/A'
  const epsGrowth = Number(previous.epsDiluted)
    ? (((Number(latest.epsDiluted) - Number(previous.epsDiluted)) / Math.abs(Number(previous.epsDiluted))) * 100).toFixed(1)
    : 'N/A'

  // News
  const newsArr = news || []
  const newsText = newsArr.slice(0, 5).map((n: Record<string, unknown>) => {
    const date = new Date(Number(n.datetime) * 1000).toISOString().split('T')[0]
    return `- [${date}] ${n.headline}`
  }).join('\n')

  return `Eres un analista financiero experto. Analiza este activo y da un análisis claro y accionable.

TICKER: ${ticker} — ${o.name || ticker}
SECTOR: ${o.sector || 'N/A'} | INDUSTRIA: ${o.industry || 'N/A'}
PRECIO: $${price} | HOY: ${o.changePercent || 0}%
RANGO 52 SEMANAS: $${w52low} — $${w52high} (posición actual: ${position52w}%)

ANÁLISIS TÉCNICO:
- Precio vs SMA20 (${latestSma20}): ${Number(sma20Diff) >= 0 ? 'arriba' : 'abajo'} (${sma20Diff}%)
- Precio vs SMA50 (${latestSma50}): ${Number(sma50Diff) >= 0 ? 'arriba' : 'abajo'} (${sma50Diff}%)
- Precio vs SMA200 (${latestSma200}): ${Number(sma200Diff) >= 0 ? 'arriba' : 'abajo'} (${sma200Diff}%)
- RSI (14): ${latestRsi} → ${rsiInterpretation}
- MACD: línea ${latestMacd?.macd ?? 'N/A'}, señal ${latestMacd?.signal ?? 'N/A'}, histograma ${latestMacd?.histogram ?? 'N/A'} → ${macdTrend}
- Tendencia general de los últimos 3 meses: ${trendDescription}

ANÁLISIS FUNDAMENTAL:
- P/E: ${o.pe ?? 'N/A'} | Forward P/E: ${o.forwardPe ?? 'N/A'} | EV/EBITDA: ${o.evToEbitda ?? 'N/A'}
- Crecimiento Revenue YoY: ${revenueGrowth}%
- Crecimiento EPS YoY: ${epsGrowth}%
- Margen Neto: ${latest.netIncomeRatio ? (Number(latest.netIncomeRatio) * 100).toFixed(1) : 'N/A'}% | ROE: ${latest.roe ? (Number(latest.roe) * 100).toFixed(1) : 'N/A'}%
- Deuda/Capital: ${latest.debtToEquity ?? 'N/A'}
- Dividendo: ${o.dividendYield ? (Number(o.dividendYield) * 100).toFixed(2) : '0'}%

NOTICIAS RECIENTES:
${newsText || 'No hay noticias recientes disponibles.'}

---

Responde con las siguientes secciones exactas (usa estos títulos):

## Resumen Ejecutivo
[2-3 párrafos con visión general del activo y su momento actual]

## Análisis Técnico
[¿Qué dice el precio? Tendencia, soportes/resistencias clave, señales de los indicadores]

## Análisis Fundamental
[¿Está cara o barata? Calidad del negocio, crecimiento, riesgos del balance]

## Factores de Riesgo
[3-5 riesgos concretos a considerar]

## Veredicto
[Una de estas tres opciones exactas, en negrita, seguida de 2-3 líneas de justificación:]
**MOMENTO FAVORABLE** | **NEUTRAL** | **MOMENTO DESFAVORABLE**

---
*Este análisis es generado por IA con fines informativos y no constituye asesoramiento financiero. Consultá a un asesor certificado antes de tomar decisiones de inversión.*`
}

function buildCryptoPrompt(
  ticker: string,
  overview: Record<string, unknown> | null,
  history: Record<string, unknown> | null,
): string {
  const o = overview || {} as Record<string, unknown>
  const prices = (history as Record<string, Array<Record<string, number>>>)?.prices || []

  let trendDescription = 'N/A'
  if (prices.length > 1) {
    const firstPrice = prices[0]?.close || 0
    const lastPrice = prices[prices.length - 1]?.close || 0
    const pctChange = firstPrice > 0 ? (((lastPrice - firstPrice) / firstPrice) * 100).toFixed(1) : '0'
    trendDescription = `${Number(pctChange) >= 0 ? '+' : ''}${pctChange}% en 3 meses`
  }

  return `Eres un analista de criptomonedas experto. Analiza este activo y da un análisis claro y accionable.

CRYPTO: ${o.name || ticker} (${o.symbol || ticker})
PRECIO: $${o.price || 0} | 24H: ${o.changePercent24h || 0}%
MARKET CAP: $${formatLargeNumber(Number(o.marketCap) || 0)}
VOLUMEN 24H: $${formatLargeNumber(Number(o.volume24h) || 0)}
RANKING: #${o.marketCapRank || 'N/A'}

ATH: $${o.ath || 'N/A'} (${o.athDate ? new Date(String(o.athDate)).toLocaleDateString() : 'N/A'})
ATL: $${o.atl || 'N/A'} (${o.atlDate ? new Date(String(o.atlDate)).toLocaleDateString() : 'N/A'})

SUPPLY:
- Circulante: ${formatLargeNumber(Number(o.circulatingSupply) || 0)}
- Total: ${o.totalSupply ? formatLargeNumber(Number(o.totalSupply)) : 'N/A'}
- Máximo: ${o.maxSupply ? formatLargeNumber(Number(o.maxSupply)) : 'Ilimitado'}

TENDENCIA 3 MESES: ${trendDescription}

---

Responde con las siguientes secciones exactas (usa estos títulos):

## Resumen Ejecutivo
[2-3 párrafos con visión general de la criptomoneda y su momento actual]

## Análisis Técnico
[Tendencia de precio, niveles clave, comparación con ATH/ATL]

## Análisis del Ecosistema
[Adopción, utilidad, competencia, posición en el mercado]

## Factores de Riesgo
[3-5 riesgos concretos a considerar]

## Veredicto
[Una de estas tres opciones exactas, en negrita, seguida de 2-3 líneas de justificación:]
**MOMENTO FAVORABLE** | **NEUTRAL** | **MOMENTO DESFAVORABLE**

---
*Este análisis es generado por IA con fines informativos y no constituye asesoramiento financiero. Consultá a un asesor certificado antes de tomar decisiones de inversión.*`
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T'
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  return num.toFixed(2)
}
