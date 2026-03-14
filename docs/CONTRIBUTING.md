# Contributing y Commits

## Regla general

Este repo no usa commits improvisados. Cada commit debe representar un cambio coherente, validado y explicable.

## Formato obligatorio del mensaje

```text
<type>(<scope>): <resumen>
```

### Tipos permitidos

- `fix`
- `feat`
- `refactor`
- `docs`
- `test`
- `chore`
- `perf`

### Scope

Debe ser concreto y corto. Ejemplos:
- `api`
- `stock`
- `crypto`
- `screener`
- `docs`
- `portfolio`
- `watchlist`
- `auth`

### Resumen

Reglas:
- imperativo
- una sola idea
- no terminar con punto
- idealmente <= 72 caracteres

Ejemplos validos:
- `fix(screener): correct FMP field mapping`
- `fix(ai): separate cache keys for stock and crypto analysis`
- `docs(project): align architecture and API references`
- `refactor(search): handle failed API responses consistently`

## Cuerpo del commit

Agregar cuerpo cuando haga falta contexto:
- por que cambia
- que riesgo reduce
- que tradeoff introduce
- que se verifico

Ejemplo:

```text
fix(ai): separate cache keys for stock and crypto analysis

Avoids cross-type cache collisions in the analysis endpoint.
Also hardens internal route fetches so failed dependencies do not
silently become prompt data.

Verified with:
- npm run lint
- npm run test:run
- npm run build
```

## Reglas practicas

- no usar `WIP`
- no mezclar refactor grande con feature sin necesidad
- no commitear cambios sin validar
- no hacer commits gigantes si se puede separar de forma limpia
- si el cambio toca comportamiento, correr al menos tests y build

## Checklist antes de commitear

1. `git status --short`
2. `npm run lint`
3. `npm run test:run`
4. `npm run build`
5. revisar el diff final
