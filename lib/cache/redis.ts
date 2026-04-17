import { Redis } from '@upstash/redis'

// Cache TTLs in seconds
export const CACHE_TTL = {
  OVERVIEW: 600,        // 10 minutes
  HISTORY: 3600,        // 1 hour
  INDICATORS: 3600,     // 1 hour
  FINANCIALS: 86400,    // 24 hours
  NEWS: 3600,           // 1 hour
  AI_ANALYSIS: 21600,   // 6 hours
  RECOMMENDATIONS: 3600, // 1 hour
  EARNINGS: 86400,       // 24 hours
  INSIDERS: 86400,       // 24 hours
  SCREENER: 3600,        // 1 hour
  SCORE: 21600,          // 6 hours
  UNIVERSE: 86400,       // 24 hours
} as const

const OP_TIMEOUT_MS = 500
const FAILURE_THRESHOLD = 2
const COOLDOWN_MS = 60_000

let redis: Redis | null = null
let consecutiveFailures = 0
let disabledUntil = 0
let loggedDisable = false

function getRedis(): Redis | null {
  if (Date.now() < disabledUntil) return null
  if (redis) return redis
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    return redis
  } catch {
    trip('init failed')
    return null
  }
}

function trip(reason: string) {
  consecutiveFailures += 1
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    disabledUntil = Date.now() + COOLDOWN_MS
    if (!loggedDisable) {
      console.warn(`[redis] disabled for ${COOLDOWN_MS / 1000}s after ${consecutiveFailures} failures (${reason})`)
      loggedDisable = true
    }
  }
}

function recover() {
  consecutiveFailures = 0
  if (disabledUntil !== 0) {
    disabledUntil = 0
    loggedDisable = false
  }
}

async function withTimeout<T>(op: Promise<T>): Promise<T> {
  return await Promise.race([
    op,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('redis timeout')), OP_TIMEOUT_MS)
    ),
  ])
}

export async function getCached<T>(key: string): Promise<T | null> {
  const client = getRedis()
  if (!client) return null
  try {
    const data = await withTimeout(client.get<T>(key))
    recover()
    return data
  } catch {
    trip('get')
    return null
  }
}

export async function setCached<T>(key: string, data: T, ttl: number): Promise<void> {
  const client = getRedis()
  if (!client) return
  try {
    await withTimeout(client.set(key, data, { ex: ttl }))
    recover()
  } catch {
    trip('set')
  }
}

export function cacheKey(prefix: string, ...parts: string[]): string {
  return `sv:${prefix}:${parts.join(':')}`
}
