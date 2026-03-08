import { Redis } from '@upstash/redis'

// Cache TTLs in seconds
export const CACHE_TTL = {
  OVERVIEW: 600,        // 10 minutes
  HISTORY: 3600,        // 1 hour
  INDICATORS: 3600,     // 1 hour
  FINANCIALS: 86400,    // 24 hours
  NEWS: 3600,           // 1 hour
  AI_ANALYSIS: 21600,   // 6 hours
} as const

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return null
    }
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    return redis
  } catch {
    console.warn('Redis connection failed, falling back to direct API calls')
    return null
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = getRedis()
    if (!client) return null
    const data = await client.get<T>(key)
    return data
  } catch (error) {
    console.warn('Redis get failed:', error)
    return null
  }
}

export async function setCached<T>(key: string, data: T, ttl: number): Promise<void> {
  try {
    const client = getRedis()
    if (!client) return
    await client.set(key, data, { ex: ttl })
  } catch (error) {
    console.warn('Redis set failed:', error)
  }
}

export function cacheKey(prefix: string, ...parts: string[]): string {
  return `sv:${prefix}:${parts.join(':')}`
}
