# Guía para Extender StockVision

## Agregar un nuevo componente shadcn/ui

```bash
npx shadcn@latest add <nombre-componente>
```

Los componentes se instalan en `components/ui/`. No editar manualmente — usar la CLI.

## Agregar una nueva API externa

1. Crear el wrapper en `lib/apis/nueva-api.ts`:
```typescript
const BASE_URL = 'https://api.example.com'

function apiKey(): string {
  return process.env.NUEVA_API_KEY || ''
}

async function fetchAPI(endpoint: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  // Agregar API key como header o query param según la API
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export async function getData(param: string) {
  return fetchAPI(`/endpoint/${param}`)
}
```

2. Agregar la variable de entorno en `.env.local`
3. Crear la API route en `app/api/...`
4. Documentar en `docs/API-ROUTES.md`

## Agregar una nueva API route

Seguir el patrón existente:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase()
  const key = cacheKey('mi-dato', ticker)

  try {
    // 1. Intentar caché
    const cached = await getCached(key)
    if (cached) return NextResponse.json(cached)

    // 2. Llamar API externa
    const data = await miApiFetch(ticker)

    // 3. Cachear resultado
    await setCached(key, data, CACHE_TTL.OVERVIEW) // elegir TTL apropiado

    // 4. Retornar
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

## Agregar un nuevo TTL de caché

En `lib/cache/redis.ts`, agregar al objeto `CACHE_TTL`:

```typescript
export const CACHE_TTL = {
  OVERVIEW: 600,
  HISTORY: 3600,
  // ...
  MI_NUEVO_DATO: 1800,  // 30 minutos
} as const
```

## Agregar un nuevo tab a la página de stock

1. Crear el componente en `components/stock/mi-tab.tsx`
2. Editar `app/stock/[ticker]/page.tsx`:

```tsx
import { MiTab } from '@/components/stock/mi-tab'

// Dentro del <Tabs>:
<TabsTrigger value="mi-tab">Mi Tab</TabsTrigger>
<TabsContent value="mi-tab">
  <MiTab ticker={ticker} />
</TabsContent>
```

## Agregar un nuevo tipo de activo (más allá de stock/crypto)

1. Crear API routes en `app/api/nuevo-tipo/[id]/`
2. Crear página en `app/nuevo-tipo/[id]/page.tsx`
3. Crear componentes en `components/nuevo-tipo/`
4. Actualizar el tipo `WatchlistItem` en `lib/types.ts`:
```typescript
type: 'stock' | 'crypto' | 'nuevo-tipo'
```
5. Actualizar `search-bar.tsx` para incluir resultados del nuevo tipo
6. Actualizar `watchlist-card.tsx` para manejar el nuevo tipo

## Agregar una nueva métrica al header de stock

Editar `components/stock/stock-header.tsx`. Las métricas están en un grid al final:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
  <MetricItem label="Mi Métrica" value={formatCurrency(overview.miMetrica)} />
</div>
```

Si la métrica viene de la API, agregarla al tipo `StockOverview` en `lib/types.ts` y mapearla en `app/api/stock/[ticker]/overview/route.ts`.

## Convenciones de Estilo

### Números financieros
Siempre usar la clase `font-mono-numbers` para que se muestren con JetBrains Mono y tabular nums:
```tsx
<span className="font-mono-numbers">$185.50</span>
```

### Colores positivo/negativo
```tsx
import { colorForValue } from '@/lib/format'

<span className={colorForValue(value)}>  // aplica text-green o text-red
  {formatPercent(value)}
</span>
```

### Cards y containers
```tsx
<Card className="p-4 bg-card border-border">
  {/* contenido */}
</Card>
```

### Loading states
Usar `<Skeleton />` de shadcn/ui con dimensiones que coincidan con el contenido final:
```tsx
{isLoading ? (
  <Skeleton className="h-6 w-24" />
) : (
  <span>{data}</span>
)}
```

## Testing

No hay tests configurados aún. Para agregar:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

Crear `vitest.config.ts` y archivos `*.test.tsx` junto a los componentes.

## Variables de Entorno para Producción

En Vercel o cualquier hosting, configurar las mismas variables que `.env.local`:

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `ALPHA_VANTAGE_API_KEY` | Sí | Precios e indicadores de stocks |
| `FMP_API_KEY` | Sí | Datos financieros y búsqueda |
| `FINNHUB_API_KEY` | Sí | Noticias |
| `COINGECKO_API_KEY` | Sí | Datos de crypto |
| `GEMINI_API_KEY` | Sí | Análisis con IA |
| `UPSTASH_REDIS_REST_URL` | Sí | Caché (URL de Upstash) |
| `UPSTASH_REDIS_REST_TOKEN` | Sí | Caché (token de Upstash) |
