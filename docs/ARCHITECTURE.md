# Arquitectura de StockVision

## Resumen

StockVision es una app personal de analisis financiero construida sobre Next.js App Router. El cliente no habla con proveedores externos directamente: todo pasa por rutas internas bajo `app/api/`.

## Capas

### 1. Presentacion

Ubicacion:
- `app/`
- `components/`

Responsabilidades:
- paginas cliente
- componentes visuales
- estados de loading/error
- consultas con TanStack Query
- navegacion entre home, stock, crypto, screener y login

Paginas principales:
- `/`
- `/stock/[ticker]`
- `/crypto/[id]`
- `/screener`
- `/login`

### 2. Estado cliente

Ubicacion:
- `lib/store/watchlist.ts`
- `lib/store/portfolio.ts`

Tecnologia:
- Zustand + `persist`

Persistencia:
- `stockvision-watchlist`
- `stockvision-portfolio`

### 3. API interna

Ubicacion:
- `app/api/`

Responsabilidades:
- proteger API keys
- normalizar datos
- combinar proveedores
- aplicar cache server-side
- encapsular fallbacks

Patron dominante:

```text
request -> cache lookup -> provider(s) -> normalizacion -> cache set -> response
```

### 4. Cache

Ubicacion:
- `lib/cache/redis.ts`

Tecnologia:
- Upstash Redis

Condicion importante:
- Redis es opcional
- si falla, la app no debe caerse

### 5. Proveedores externos

#### Stocks

- Yahoo Finance
  - fuente principal de history, financials, earnings e insiders
- Finnhub
  - fuente principal de quote en tiempo real, metrics basicas, news, recommendations y search
- Alpha Vantage
  - fallback en overview e history
- FMP
  - screener

#### Crypto

- CoinGecko
  - overview, history y search

#### IA

- Gemini 2.5 Flash
  - analisis streaming para stocks y crypto

## Flujos relevantes

### Stock overview

`/api/stock/[ticker]/overview`

1. busca cache
2. intenta Finnhub + Yahoo en paralelo
3. si falla, usa Alpha Vantage
4. normaliza a `StockOverview`

### Stock history

`/api/stock/[ticker]/history`

1. busca dataset completo cacheado
2. si falta, usa Yahoo
3. si Yahoo falla, usa Alpha Vantage
4. filtra por rango al final

### Indicators

`/api/stock/[ticker]/indicators`

1. consume la ruta interna de history
2. calcula RSI, MACD y SMA localmente
3. cachea resultado

Esto reduce consumo externo y evita varias llamadas a Alpha Vantage.

### AI analysis

`/api/analyze/[ticker]`

1. busca cache por `type + ticker`
2. consulta rutas internas necesarias
3. arma prompt
4. llama Gemini con streaming
5. transmite chunks al cliente
6. cachea texto final

## Seguridad

Hay proteccion opcional por contrasena:
- `middleware.ts`
- `app/api/auth/route.ts`

Comportamiento:
- si `APP_PASSWORD` no existe, no hay login
- la UI queda protegida, pero `api/*` queda fuera del middleware

## Riesgos actuales

- documentacion historica previa estuvo desalineada con el codigo
- FMP en screener no expone hoy la misma riqueza que sugieren algunos tipos
- hay fallbacks y mezcla de proveedores, por lo que siempre conviene revisar la ruta concreta antes de modificar un flujo

## Archivos de referencia

- `app/api/stock/[ticker]/overview/route.ts`
- `app/api/stock/[ticker]/history/route.ts`
- `app/api/stock/[ticker]/indicators/route.ts`
- `app/api/analyze/[ticker]/route.ts`
- `lib/apis/finnhub.ts`
- `lib/apis/yahoo.ts`
- `lib/apis/fmp.ts`
- `lib/apis/coingecko.ts`
- `lib/cache/redis.ts`
