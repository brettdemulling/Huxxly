import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { runtime } from '@/lib/config/runtime';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || 'https://mock.upstash.io',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || 'mock-token',
});

// ─── Cost weights (relative compute/AI cost per call) ────────────────────────
// Higher weight = stricter limiting. Global token budget = 60/min.
const ENDPOINT_WEIGHTS: Record<string, number> = {
  intent: 1,    // cheap: parse only
  meals: 5,     // expensive: full Claude generation
  cart: 3,      // moderate: inventory + matching
  checkout: 1,  // cheap: URL generation
  default: 2,
};

// Each endpoint gets a per-minute token budget inversely proportional to weight.
// Base budget = 60 tokens/min. Allowed = floor(60 / weight).
function allowedPerMinute(weight: number): number {
  return Math.max(1, Math.floor(60 / weight));
}

function makeLimiter(prefix: string, weight: number) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(allowedPerMinute(weight), '1 m'),
    prefix: `rl:${prefix}`,
  });
}

const limiters = {
  intent:   makeLimiter('intent', ENDPOINT_WEIGHTS.intent),
  meals:    makeLimiter('meals', ENDPOINT_WEIGHTS.meals),
  cart:     makeLimiter('cart', ENDPOINT_WEIGHTS.cart),
  checkout: makeLimiter('checkout', ENDPOINT_WEIGHTS.checkout),
  default:  makeLimiter('default', ENDPOINT_WEIGHTS.default),
} as const;

type LimiterKey = keyof typeof limiters;

// ─── Per-user dynamic throttle (separate from IP-based limiter) ──────────────
// If a user has consumed >80% of their budget, add a 1-req/min hard cap.
const USER_THROTTLE_THRESHOLD = 0.8;

async function getUserBudgetUsage(userId: string, endpoint: LimiterKey): Promise<number> {
  const key = `rl:user:${userId}:${endpoint}:usage`;
  const used = await redis.get(key).catch(() => null);
  const max = allowedPerMinute(ENDPOINT_WEIGHTS[endpoint] ?? ENDPOINT_WEIGHTS.default);
  return used ? Number(used) / max : 0;
}

async function recordUserUsage(userId: string, endpoint: LimiterKey): Promise<void> {
  const key = `rl:user:${userId}:${endpoint}:usage`;
  await redis.incr(key);
  await redis.expire(key, 60); // reset every minute
}

function getClientId(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'anonymous'
  );
}

export async function checkRateLimit(
  request: NextRequest,
  endpoint: LimiterKey = 'default',
  userId?: string,
): Promise<NextResponse | null> {
  // Fail open when Redis is disabled or in sim mode
  if (!runtime.isRedisEnabled || runtime.isDev) return null;

  const limiter = limiters[endpoint] ?? limiters.default;
  const clientId = getClientId(request);

  try {

  // IP-based cost-weighted limit
  const { success, limit, remaining, reset } = await limiter.limit(clientId);

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: 'Too many requests',
        retryAfter,
        endpoint,
        weight: ENDPOINT_WEIGHTS[endpoint] ?? ENDPOINT_WEIGHTS.default,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(reset),
          'X-RateLimit-Weight': String(ENDPOINT_WEIGHTS[endpoint] ?? ENDPOINT_WEIGHTS.default),
          'Retry-After': String(retryAfter),
        },
      },
    );
  }

  // Per-user dynamic throttle for expensive endpoints
  if (userId && ENDPOINT_WEIGHTS[endpoint] >= 3) {
    const usage = await getUserBudgetUsage(userId, endpoint);
    if (usage > USER_THROTTLE_THRESHOLD) {
      const { success: userOk } = await new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1, '1 m'),
        prefix: `rl:throttle:${userId}:${endpoint}`,
      }).limit(userId);

      if (!userOk) {
        return NextResponse.json(
          { error: 'User budget throttled. Please wait before retrying expensive operations.' },
          { status: 429, headers: { 'Retry-After': '60' } },
        );
      }
    }
    await recordUserUsage(userId, endpoint);
  }

  return null;
  } catch {
    // Redis unavailable — fail open (allow request)
    return null;
  }
}
