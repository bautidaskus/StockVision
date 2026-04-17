# StockVision

> Contexto del proyecto para agentes (Claude Code + Codex).
>
> Principios, pipeline, git discipline, reglas de playwright y "no tocar sin confirmar" viven en los rules globales del usuario:
> - Claude: `~/.claude/CLAUDE.md`
> - Codex: `~/.codex/AGENTS.md`
>
> Este archivo documenta solo lo **especifico del proyecto**.
>
> `CLAUDE.md` en la raiz contiene unicamente `@AGENTS.md` (import de Claude).

## Proyecto

**Que es**: app personal de analisis financiero (stocks, ETFs, crypto, watchlist, portfolio, screener, analisis IA).
**Stack**: Next.js 14 (App Router) + TypeScript + Tailwind / shadcn + TanStack Query + Zustand + Upstash Redis + Lightweight Charts + Recharts.
**Deploy target**: Vercel.
**Dev URL**: http://localhost:3000.

## Arquitectura real

- frontend cliente en Next.js App Router
- API interna en `app/api/`
- cache opcional con Upstash Redis
- providers mixtos:
  - Yahoo + Finnhub para la mayor parte de stocks
  - Alpha Vantage como fallback puntual
  - CoinGecko para crypto
  - FMP para screener
  - Gemini para analisis IA

## Puntos importantes

- los indicadores tecnicos se calculan localmente
- `APP_PASSWORD` activa login opcional
- `api/*` no queda protegida por middleware
- la documentacion vieja fue reemplazada y alineada con el codigo actual

## Validacion minima

```bash
npm run lint
npm run test:run
npm run build
```

## UI

Archivos UI viven en `app/`, `components/`, estilos y charts. Para cambios en esos paths, la fase 4 del pipeline (verificacion) debe incluir chequeo en browser real con **playwright MCP** sobre `http://localhost:3000`. Confirmar render, consola sin errores, network OK.

## MCPs activos para este proyecto

Prendidos:
- `context7` — Next.js 14, TanStack Query, Recharts, lightweight-charts, Upstash, shadcn.
- `playwright` — verificacion UI real.
- `vercel` — deploys + logs.

Apagados: `supabase`, `figma` (no aportan aca). `github` tambien off; usar `gh` CLI via Bash.

## Hooks activos

Definidos en `.claude/settings.json`, scripts en `.claude/hooks/`:

- **PostToolUse** Write/Edit → `lint-file.mjs`. ESLint per-file, no bloquea, ignora archivos fuera del proyecto.
- **Stop** → `stop-reminder.mjs`. Si hay cambios sin commitear, recuerda `npm run lint && npm run test:run && npm run build`.

Deshabilitar / editar desde `/hooks`.

## Archivos de entrada recomendados

- `docs/PROJECT-CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/API-ROUTES.md`
- `docs/CONTRIBUTING.md`
