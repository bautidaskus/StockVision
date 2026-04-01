import { AsyncLocalStorage } from 'node:async_hooks'
import { performance } from 'node:perf_hooks'
import type { NextRequest } from 'next/server'

type PerfSpanKind = 'provider' | 'stage'
type PerfCacheOperation = 'get' | 'set'

interface PerfSpan {
  kind: PerfSpanKind
  name: string
  durationMs: number
  success: boolean
  details?: Record<string, unknown>
  error?: string
}

interface PerfCacheEvent {
  operation: PerfCacheOperation
  key: string
  hit?: boolean
  ttlSeconds?: number
}

interface PerfState {
  enabled: boolean
  route: string
  startedAt: number
  meta?: Record<string, unknown>
  spans: PerfSpan[]
  cacheEvents: PerfCacheEvent[]
}

const perfStorage = new AsyncLocalStorage<PerfState>()

function perfEnabled(request?: NextRequest) {
  if (process.env.SV_PERF_DEBUG === '1') return true
  if (!request) return false
  return (
    request.headers.get('x-stockvision-perf') === '1' ||
    request.nextUrl.searchParams.get('__perf') === '1'
  )
}

function currentState() {
  return perfStorage.getStore()
}

function serializeError(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function estimatePayloadBytes(payload: unknown) {
  try {
    return Buffer.byteLength(JSON.stringify(payload))
  } catch {
    return null
  }
}

export function createRequestPerformanceTracker(
  route: string,
  request?: NextRequest,
  meta?: Record<string, unknown>,
) {
  const state: PerfState = {
    enabled: perfEnabled(request),
    route,
    startedAt: performance.now(),
    meta,
    spans: [],
    cacheEvents: [],
  }

  return {
    enabled: state.enabled,

    async run<T>(fn: () => Promise<T>) {
      return perfStorage.run(state, fn)
    },

    recordCacheGet(key: string, hit: boolean) {
      if (!state.enabled) return
      state.cacheEvents.push({ operation: 'get', key, hit })
    },

    recordCacheSet(key: string, ttlSeconds: number) {
      if (!state.enabled) return
      state.cacheEvents.push({ operation: 'set', key, ttlSeconds })
    },

    finish(payload: unknown, status: number, extra?: Record<string, unknown>) {
      if (!state.enabled) return

      const totalMs = Math.round((performance.now() - state.startedAt) * 100) / 100
      const cacheGets = state.cacheEvents.filter((event) => event.operation === 'get')
      const providerCalls = state.spans.filter((span) => span.kind === 'provider').length

      console.info(
        '[perf]',
        JSON.stringify({
          route: state.route,
          status,
          totalMs,
          payloadBytes: estimatePayloadBytes(payload),
          cache: {
            hits: cacheGets.filter((event) => event.hit).length,
            misses: cacheGets.filter((event) => event.hit === false).length,
            writes: state.cacheEvents.filter((event) => event.operation === 'set').length,
            events: state.cacheEvents,
          },
          providerCalls,
          spans: state.spans,
          meta: {
            ...state.meta,
            ...extra,
          },
        }),
      )
    },
  }
}

export async function measureStage<T>(
  name: string,
  fn: () => Promise<T>,
  details?: Record<string, unknown>,
) {
  const state = currentState()
  if (!state?.enabled) return fn()

  const startedAt = performance.now()
  try {
    const result = await fn()
    state.spans.push({
      kind: 'stage',
      name,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      success: true,
      details,
    })
    return result
  } catch (error) {
    state.spans.push({
      kind: 'stage',
      name,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      success: false,
      details,
      error: serializeError(error),
    })
    throw error
  }
}

export async function measureProvider<T>(
  provider: string,
  operation: string,
  fn: () => Promise<T>,
  details?: Record<string, unknown>,
) {
  const state = currentState()
  if (!state?.enabled) return fn()

  const startedAt = performance.now()
  try {
    const result = await fn()
    state.spans.push({
      kind: 'provider',
      name: `${provider}.${operation}`,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      success: true,
      details,
    })
    return result
  } catch (error) {
    state.spans.push({
      kind: 'provider',
      name: `${provider}.${operation}`,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      success: false,
      details,
      error: serializeError(error),
    })
    throw error
  }
}
