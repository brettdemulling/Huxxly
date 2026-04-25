import { Redis } from '@upstash/redis';

const IS_SIM = process.env.DEV_SIMULATION === 'true';

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL ?? 'https://mock.upstash.io',
      token: process.env.UPSTASH_REDIS_REST_TOKEN ?? 'mock-token',
    });
  }
  return _redis;
}

function key(namespace: string, ...parts: string[]): string {
  return `ag:${namespace}:${parts.join(':')}`;
}

export async function onInventoryUpdate(zip: string, provider: string): Promise<void> {
  if (IS_SIM) return;
  try {
    const pattern = key('products', zip, `${provider}:*`);
    await scanAndDelete(pattern);
    const invPattern = key('inventory', `${provider}-${zip}`, '*');
    await scanAndDelete(invPattern);
  } catch { /* best effort */ }
}

export async function onMemoryUpdate(userId: string): Promise<void> {
  if (IS_SIM) return;
  try {
    const intentSetKey = `ag:user_intents:${userId}`;
    const intentIds = await getRedis().smembers(intentSetKey);
    for (const intentId of intentIds) {
      await getRedis().del(key('meals', intentId));
    }
    await getRedis().del(intentSetKey);
  } catch { /* best effort */ }
}

export async function trackUserIntent(userId: string, intentId: string): Promise<void> {
  if (IS_SIM) return;
  try {
    const intentSetKey = `ag:user_intents:${userId}`;
    await getRedis().sadd(intentSetKey, intentId);
    await getRedis().expire(intentSetKey, 60 * 60 * 24 * 7);
  } catch { /* best effort */ }
}

export async function onGeoChange(oldZip: string, newZip: string): Promise<void> {
  if (IS_SIM) return;
  try {
    await getRedis().del(key('stores', oldZip));
    await getRedis().del(key('stores', newZip));
  } catch { /* best effort */ }
}

export async function invalidateNamespace(namespace: string, zip: string): Promise<number> {
  if (IS_SIM) return 0;
  try {
    const pattern = `ag:${namespace}:${zip}:*`;
    return scanAndDelete(pattern);
  } catch { return 0; }
}

async function scanAndDelete(pattern: string): Promise<number> {
  let cursor = 0;
  let deleted = 0;
  do {
    const [nextCursor, keys] = await getRedis().scan(cursor, { match: pattern, count: 100 });
    cursor = Number(nextCursor);
    if (keys.length) {
      await getRedis().del(...(keys as [string, ...string[]]));
      deleted += keys.length;
    }
  } while (cursor !== 0);
  return deleted;
}
