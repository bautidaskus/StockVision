# Guia para extender StockVision

## Regla base

Antes de extender algo, revisar el flujo real en codigo y no asumir que la documentacion vieja sigue vigente. El archivo de entrada recomendado es `docs/PROJECT-CONTEXT.md`.

## Agregar una nueva API route

Patron esperado:

1. normalizar parametros
2. construir cache key
3. leer cache
4. consultar proveedor si hace falta
5. mapear a tipos internos
6. guardar cache
7. devolver JSON consistente

Esqueleto:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getCached, setCached, cacheKey, CACHE_TTL } from '@/lib/cache/redis'

export async function GET(request: NextRequest) {
  const key = cacheKey('mi-recurso', '...')

  try {
    const cached = await getCached(key)
    if (cached) return NextResponse.json(cached)

    const result = await fetchSomething()

    await setCached(key, result, CACHE_TTL.OVERVIEW)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

## Agregar o cambiar un proveedor externo

Ubicacion:
- `lib/apis/`

Reglas:
- el wrapper no debe conocer Redis
- debe lanzar errores claros en HTTP no exitoso
- si el proveedor devuelve payload raro, normalizar o lanzar error
- la composicion de varios proveedores debe vivir en la route, no en el wrapper

## Agregar datos a un componente existente

Chequear siempre:
- `lib/types.ts`
- route que produce el dato
- componente que lo consume
- posibles estados `loading`, `error` y `empty`

## Si tocás stocks

Revisar primero:
- `app/api/stock/[ticker]/overview/route.ts`
- `app/api/stock/[ticker]/history/route.ts`
- `app/api/stock/[ticker]/indicators/route.ts`
- `components/stock/*`

## Si tocás crypto

Revisar primero:
- `app/api/crypto/[id]/overview/route.ts`
- `app/api/crypto/[id]/history/route.ts`
- `components/crypto/*`

## Si tocás IA

Revisar primero:
- `app/api/analyze/[ticker]/route.ts`
- `components/stock/ai-analysis-tab.tsx`

Cuidar especialmente:
- cache key
- prompt
- streaming
- manejo de errores de rutas internas

## Si tocás estado local

Revisar:
- `lib/store/watchlist.ts`
- `lib/store/portfolio.ts`

Reglas:
- no romper compatibilidad con `localStorage` salvo que haya migracion
- si cambia la forma del estado, evaluar impacto sobre datos persistidos ya guardados

## Tests

La suite actual usa Vitest.

Comandos:

```bash
npm run test:run
```

Cuando agregues una correccion o una nueva feature:
- sumar test si el riesgo lo justifica
- priorizar tests de wrappers, stores y componentes con logica

## Validacion minima

Antes de cerrar cambios:

1. `npm run lint`
2. `npm run test:run`
3. `npm run build`
