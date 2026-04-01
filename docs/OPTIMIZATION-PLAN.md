# Plan de Optimizacion de Performance

## Objetivo

Este documento define el plan oficial para optimizar la performance de StockVision sin romper comportamiento existente.

El foco es mejorar:
- tiempo de carga inicial
- tiempo de respuesta del screener
- tiempo de carga de graficos
- costo total de requests a proveedores externos
- cantidad de trabajo duplicado entre rutas y componentes
- estabilidad frente a rate limits y cold starts

Este documento debe usarse como guia de ejecucion para cualquier desarrollador que toque performance.

## Alcance

Incluye:
- backend interno bajo `app/api/`
- integraciones con Yahoo, Finnhub, FMP, CoinGecko, SEC y Alpha Vantage
- cache server-side y cache cliente
- componentes cliente con TanStack Query
- home, search, stock detail, crypto detail y screener
- estrategia de commits
- estrategia de tests
- criterios de calidad
- criterios de aceptacion por fase

No incluye:
- rediseño visual
- cambios de producto no relacionados con performance
- cambios de infraestructura externa fuera del scope del repo

## Diagnostico resumido

Los principales cuellos de botella actuales son:

1. El screener hace demasiado trabajo por request.
   En lugar de filtrar primero con un proveedor optimizado, construye un ranking enriquecido ticker por ticker y calcula score con multiples fuentes.

2. El screener se dispara demasiado seguido.
   Cada cambio de filtro relanza la consulta, incluso mientras el usuario esta escribiendo.

3. La pagina de stock duplica trabajo.
   `overview`, `score`, `history`, `indicators` y tabs relacionadas vuelven a pedir datos solapados.

4. La ruta de indicadores hace un `fetch` interno HTTP a la propia ruta de history.
   Eso suma latencia, serializacion y trabajo repetido en cold start.

5. Los charts recrean instancias completas con demasiada frecuencia.
   Eso degrada la sensacion de fluidez aunque los datos ya esten cargados.

6. Search y home generan demasiadas requests concurrentes.
   Hay poca cancelacion, poca consolidacion y poco lazy loading.

## Principios no negociables

Todo cambio de performance debe respetar estas reglas:

- No romper contratos publicos de API sin documentarlo y migrar consumidores.
- No mezclar optimizacion con cambios funcionales no relacionados.
- No sacrificar exactitud de datos sin decision explicita y documentada.
- No introducir inconsistencias entre cache y UI.
- No agregar complejidad arquitectonica sin reducir costo real medible.
- No tocar providers externos sin preservar fallbacks.
- No eliminar tests existentes.
- No reducir cobertura de validacion para acelerar entregas.
- No cambiar TTLs a ciegas.
- No usar datos stale en componentes sensibles sin definir politica.

## Regla de oro para cambios

Cada cambio debe cumplir este orden:

1. medir el comportamiento actual
2. aislar el cuello de botella
3. aplicar el cambio minimo efectivo
4. validar que no hay regresion funcional
5. documentar el resultado

Si no se puede medir con tooling automatico, al menos se debe registrar:
- ruta o pantalla afectada
- cantidad estimada de requests antes y despues
- costo de CPU o serializacion antes y despues
- evidencia manual del cambio

## Metricas objetivo

Estas metas son objetivo de referencia. Si no se cumplen en una fase, debe quedar documentado por que.

### Screener

- Primera respuesta visible con filtros por defecto: menor a 2.5 s en entorno local caliente
- Reconsulta por cambio de filtros: menor a 1.2 s con cache caliente
- Requests externas por ejecucion: reducirlas al menos 70% respecto al flujo actual

### Pagina de stock

- Header y grafico visibles: menor a 1.5 s con cache caliente
- Carga inicial sin tabs secundarias abiertas: no mas de 3 requests criticas cliente
- Eliminacion de fetches internos HTTP redundantes entre history e indicators

### Search

- Resultados iniciales: menor a 400 ms para consultas de 3+ caracteres con cache caliente
- Sin race conditions visuales al escribir rapido

### Home

- La home no debe lanzar una explosion de requests proporcional al total de items guardados
- Watchlist y portfolio deben degradar de forma controlada al crecer

## Fase 0: Baseline e instrumentacion

### Objetivo

Antes de optimizar, obtener evidencia reproducible.

### Tareas

- Agregar medicion de tiempo por ruta critica:
  - `/api/screener`
  - `/api/search`
  - `/api/stock/[ticker]/overview`
  - `/api/stock/[ticker]/history`
  - `/api/stock/[ticker]/indicators`
  - `/api/stock/[ticker]/score`
- Agregar logs temporales o wrappers internos para medir:
  - tiempo total de handler
  - tiempo por proveedor externo
  - hits y misses de cache
  - tamano aproximado de payload
- Registrar resultados de baseline en una nota interna o PR description.

### Reglas

- La instrumentacion debe ser facil de remover o quedar detras de un flag.
- No dejar `console.log` ruidosos permanentes en cliente.
- Si se usa logging server-side, debe quedar acotado a modo debug.

### Entregables

- mediciones base por pantalla
- conteo base de requests
- lista priorizada final de hotspots

## Fase 1: Screener primero

### Objetivo

Reducir drastica y rapidamente el tiempo del screener.

### Problema actual

La implementacion actual calcula un resultado enriquecido por ticker para un universo grande. Eso es demasiado caro para una pantalla interactiva.

### Estrategia

Separar el screener en dos etapas:

1. filtro primario rapido
2. enriquecimiento parcial y controlado

### Tareas obligatorias

- Cambiar el backend del screener para usar primero `screenStocks` o una ruta equivalente del proveedor rapido.
- Aplicar todos los filtros que el proveedor soporte directamente en esa etapa.
- Limitar el enriquecimiento a un subconjunto controlado:
  - top visible
  - top N por score
  - o solo cuando el usuario lo pida
- Dejar claro cuales campos vienen del filtro primario y cuales del enriquecimiento.
- Evitar calcular `opportunityScore` para todo el universo.
- Si el score sigue siendo necesario en la tabla principal:
  - calcularlo solo para una ventana pequena, por ejemplo 10 a 20 filas
  - o resolverlo asincronamente despues de renderizar resultados basicos
- Revisar el mapping de campos del screener para corregir inconsistencias de `week52High`, `week52Low` y similares.

### Cambios de UX obligatorios

- El screener no debe consultar en cada keypress.
- Implementar una de estas dos politicas:
  - boton `Aplicar filtros`
  - debounce real de 500 a 800 ms sobre filtros editables
- Mientras hay una consulta en curso:
  - bloquear consultas redundantes
  - cancelar la anterior si corresponde
- Mantener visibles los resultados previos hasta que lleguen los nuevos cuando eso mejore la UX.

### Criterios de aceptacion de la fase

- El screener responde perceptiblemente mas rapido con filtros por defecto.
- No hay explosion de requests por editar inputs numericos.
- Los resultados principales siguen siendo correctos para los filtros activos.
- La tabla no pierde orden ni interaccion.

## Fase 2: Consolidacion de datos en pagina de stock

### Objetivo

Eliminar trabajo duplicado en la pantalla de detalle.

### Problema actual

Hay varias rutas que vuelven a pedir datos solapados y recalculan contexto.

### Estrategia

Construir un `snapshot` o capa compartida para las necesidades criticas de la pantalla principal.

### Tareas obligatorias

- Definir una funcion server-side compartida para obtener contexto base de stock.
- Esa funcion debe poder reutilizar:
  - overview
  - history normalizado
  - financials esenciales
  - datos necesarios para score
- Evitar que `/score` vuelva a hacer todo el trabajo si parte del contexto ya fue resuelto.
- Evaluar una nueva ruta agregadora para la carga inicial del detail:
  - `snapshot`
  - `summary`
  - u otro nombre consistente
- Mantener compatibilidad progresiva con los componentes existentes hasta completar la migracion.

### Reglas

- No hacer acoplamiento circular entre rutas API.
- Priorizar funciones compartidas sobre fetches HTTP internos.
- Si una ruta necesita datos de otra, extraer la logica comun a `lib/`.

### Criterios de aceptacion

- La pagina de stock reduce requests criticas de carga inicial.
- `overview`, `score` y `chart` no duplican trabajo pesado innecesariamente.
- El comportamiento visible sigue siendo el mismo o mejor.

## Fase 3: History e indicators

### Objetivo

Eliminar redundancia entre historico e indicadores y aligerar render de charts.

### Tareas obligatorias en backend

- Reemplazar el fetch HTTP interno de indicators a history por una funcion compartida en `lib/`.
- Centralizar:
  - carga del dataset full
  - normalizacion
  - filtrado por rango
  - politica de cache
- Garantizar que history e indicators usen exactamente la misma base de datos normalizada.
- Agregar deduplicacion in-flight por ticker y tipo de dato cuando sea posible.

### Tareas obligatorias en frontend

- Evitar destruir y recrear charts completos si solo cambia:
  - timeframe
  - SMA visible
  - volumen visible
- Reutilizar instancia del chart cuando tecnicamente sea posible.
- Minimizar transformaciones repetidas sobre arrays grandes en cada render.
- Evitar recomputar normalizaciones identicas varias veces por render.

### Criterios de aceptacion

- Menor tiempo de primer render del chart.
- Cambio de timeframe mas fluido.
- Menos trabajo de CPU en cliente.
- Misma salida visual y mismos datos finales.

## Fase 4: Search y cargas de home

### Objetivo

Reducir ruido de red y mejorar percepcion de rapidez.

### Search

Tareas:

- Exigir al menos 2 o 3 caracteres antes de consultar.
- Agregar `AbortController` para cancelar requests viejas.
- Ignorar respuestas tardias de queries obsoletas.
- Cachear resultados por query corta en cliente.
- Evaluar cache server-side corta para queries frecuentes.

### Home

Tareas:

- Consolidar overview de watchlist y portfolio para evitar duplicacion.
- Evaluar batch endpoint para overview multiple.
- Mover sparklines e history a lazy loading o viewport loading si la lista crece.
- Garantizar que `PortfolioSummary` reutilice queries existentes y no duplique costo frente a `PortfolioCard`.

### Criterios de aceptacion

- Escribir rapido en search no produce resultados desordenados.
- La home con varios items no se degrada de forma explosiva.
- Los datos visibles siguen correctos.

## Fase 5: Endurecimiento de cache y resiliencia

### Objetivo

Hacer que el sistema se comporte bien en frio, en caliente y frente a fallos parciales.

### Tareas

- Revisar TTLs por tipo de dato segun volatilidad real.
- Agregar cache local en memoria para promesas in-flight cuando tenga sentido.
- Evitar stampedes sobre la misma key.
- Dejar trazabilidad de cache hit, miss y refresh en modo debug.
- Confirmar que cada fallback:
  - no empeora demasiado la latencia
  - no rompe shape de datos
  - no genera valores inconsistentes

### Criterios de aceptacion

- Menos requests duplicadas para la misma entidad en ventanas cortas.
- Menor variabilidad de tiempos entre primera y segunda carga.
- Fallbacks siguen funcionando.

## Orden recomendado de ejecucion

El orden oficial es:

1. Fase 0
2. Fase 1
3. Fase 2
4. Fase 3
5. Fase 4
6. Fase 5

No avanzar de fase sin cerrar los criterios de aceptacion de la fase anterior, salvo decision explicita y documentada.

## Estructura de ramas

Se recomienda usar ramas cortas y tematicas.

Formato:

```text
perf/<area>-<resumen-corto>
```

Ejemplos:

- `perf/screener-fast-path`
- `perf/stock-snapshot`
- `perf/chart-reuse`
- `perf/search-cancellation`

## Estructura obligatoria de commits

Formato:

```text
<type>(<scope>): <resumen>
```

Tipos permitidos:

- `perf`
- `refactor`
- `fix`
- `test`
- `docs`
- `chore`

Scopes recomendados:

- `screener`
- `stock`
- `chart`
- `search`
- `home`
- `api`
- `cache`
- `tests`
- `docs`

### Reglas de commit

- Un commit = una idea coherente.
- No mezclar optimizacion de backend con limpieza cosmetica no relacionada.
- No usar `WIP`.
- El resumen debe estar en imperativo.
- Si el cambio es riesgoso, agregar cuerpo con:
  - motivacion
  - impacto esperado
  - validaciones ejecutadas

### Secuencia recomendada de commits por fase

Para cada fase usar, como minimo, esta secuencia logica:

1. `test(...)` o `docs(...)` para capturar baseline o contratos
2. `refactor(...)` para extraer logica compartida sin cambiar comportamiento
3. `perf(...)` para introducir la optimizacion principal
4. `test(...)` para ampliar cobertura de regresion
5. `docs(...)` para actualizar comportamiento real

Ejemplo:

```text
test(screener): cover current filter execution path
refactor(screener): extract provider fast path and enrichment stages
perf(screener): apply provider-first filtering and deferred scoring
test(screener): cover cached and enriched result flows
docs(docs): document screener performance architecture
```

## Estrategia de testing

## Regla general

Toda optimizacion debe demostrar dos cosas:

1. que mejora performance o reduce costo
2. que no rompe comportamiento

### Tipos de pruebas obligatorias

#### 1. Unit tests

Aplican cuando se toca:
- parsing
- transforms
- filtros
- normalizacion
- score
- helpers de cache
- selectors

Se deben agregar tests para:
- filtros soportados y no soportados
- conversion y mapping de datos de providers
- consolidacion de contexto
- deduplicacion de requests o promesas

#### 2. Integration tests de rutas API

Aplican cuando se toca:
- `app/api/screener/route.ts`
- rutas de stock
- rutas de search
- cache layer

Se deben cubrir:
- respuesta OK
- fallback
- cache hit
- cache miss
- error de proveedor
- shape de salida

#### 3. Component tests

Aplican cuando se toca:
- `ScreenerPage`
- `SearchBar`
- `CandlestickChart`
- `WatchlistCard`
- `PortfolioSummary`

Se deben cubrir:
- loading
- success
- error
- no refetch innecesario
- preservacion de resultados previos si corresponde
- cambios de filtros o timeframe

#### 4. Smoke tests manuales

Obligatorios en cada fase.

### Casos manuales minimos por fase

#### Screener

- abrir `/screener`
- verificar primera carga
- cambiar un select
- escribir en filtros numericos
- aplicar reset
- comparar cantidad y coherencia de resultados
- probar con cache fria y cache caliente

#### Stock

- abrir ticker conocido: `AAPL`
- validar header
- validar chart `1Y`, `1M`, `5Y`
- activar y desactivar volumen
- activar y desactivar SMA
- abrir tabs de fundamentals, analysts, earnings, insiders y news
- confirmar que score sigue apareciendo

#### Search

- buscar ticker exacto
- buscar por nombre parcial
- escribir rapido varias letras
- borrar texto
- seleccionar un resultado

#### Home

- abrir con watchlist vacia
- abrir con watchlist cargada
- abrir con portfolio cargado
- confirmar P&L y cards

## Matriz de validacion obligatoria antes de merge

Cada PR de performance debe validar:

- `npm run test:run`
- `npm run build`
- pruebas manuales del area tocada
- revision del diff final
- actualizacion documental si cambia la arquitectura real

Si existe script de lint funcional en el repo, tambien debe correr.
Si no existe o no esta configurado, debe dejarse explicitado en la PR.

## Criterios de calidad

Un cambio se considera aceptable solo si cumple todo esto:

- mejora o simplifica el camino critico
- reduce requests, CPU o latencia de forma defensible
- no introduce deuda tecnica opaca
- no rompe tipos
- no rompe tests existentes
- no aumenta acoplamiento entre rutas
- mantiene fallbacks
- mantiene cache consistente
- deja el codigo mas facil de medir y mantener

## Criterios de rechazo

El cambio debe rechazarse si:

- mejora performance pero rompe exactitud de datos sin aviso
- hace bypass de cache sin razon
- agrega fetches internos nuevos entre rutas
- duplica logica en vez de extraer funciones compartidas
- usa magic numbers sin documentacion
- cambia demasiadas cosas en un solo commit o PR
- no trae validacion manual minima

## Politica de PR

Cada PR debe incluir:

- objetivo concreto
- fase a la que pertenece
- antes y despues resumido
- archivos principales tocados
- riesgos conocidos
- checklist de validacion

### Template recomendado

```text
Objetivo
- Que optimiza esta PR

Fase
- Fase X

Cambio principal
- Resumen corto de la estrategia

Impacto esperado
- Menos requests
- Menor tiempo
- Menos trabajo duplicado

Validacion
- npm run test:run
- npm run build
- pruebas manuales realizadas

Riesgos
- puntos a vigilar
```

## Reglas de implementacion tecnica

### Providers

- Toda integracion nueva o cambiada debe estar encapsulada en `lib/apis/`.
- No mezclar parsing de provider con logica de UI.
- Toda salida de provider debe normalizarse antes de llegar a componentes.

### Cache

- Toda key debe ser determinista.
- Toda TTL debe justificarse por volatilidad del dato.
- Si se usa cache de promesas in-flight, debe limpiarse correctamente al resolver o fallar.

### API routes

- No usar una API route para llamar a otra API route via HTTP salvo que haya una razon excepcional y documentada.
- Preferir funciones compartidas en `lib/`.
- Manejar errores parciales sin romper toda la respuesta cuando sea viable.

### Cliente

- No disparar queries costosas por cada keypress salvo en search y con cancelacion.
- Reusar query keys y datos ya presentes cuando sea posible.
- No recalcular arrays grandes en cada render si se puede evitar.
- No recrear charts enteros si alcanza con actualizar series.

### Tipos

- Todo cambio de shape en respuestas debe reflejarse en `lib/types.ts`.
- No usar estructuras ambiguas o parcialmente tipadas si afectan contratos estables.

## Riesgos conocidos que deben vigilarse

- Colisiones o inconsistencias de cache entre rutas y tipos de activos
- Desalineacion entre score y overview al cambiar fuente o TTL
- Regresion silenciosa en sorting del screener
- Diferencias entre datos en frio y en caliente
- Valores incompletos por enriquecimiento parcial
- Tabs que dependen accidentalmente de datos no cargados

## Definicion de terminado por fase

Una fase se considera cerrada solo si:

- se implementaron todas las tareas obligatorias de la fase
- se cumplieron los criterios de aceptacion
- se ejecutaron tests y smoke tests
- la documentacion quedo actualizada
- el diff quedo dividido en commits coherentes

## Checklist final para el programador

Antes de empezar:

- leer `docs/PROJECT-CONTEXT.md`
- revisar este archivo completo
- revisar `git status --short`
- identificar fase y alcance exacto

Antes de codificar:

- definir que se va a medir
- listar archivos afectados
- definir que tests se van a agregar o actualizar

Antes de commitear:

- revisar diff
- correr `npm run test:run`
- correr `npm run build`
- ejecutar smoke tests del area afectada

Antes de abrir PR:

- verificar que cada commit tenga una sola idea
- documentar impacto esperado y validacion
- dejar riesgos remanentes claros

## Resumen ejecutivo

El orden correcto para optimizar StockVision es:

1. medir
2. acelerar screener
3. consolidar carga inicial de stock
4. eliminar redundancia entre history e indicators
5. endurecer search y home
6. reforzar cache y resiliencia

No se debe atacar todo junto.
La prioridad real es reducir trabajo por request y eliminar duplicacion estructural antes de micro-optimizar render.
