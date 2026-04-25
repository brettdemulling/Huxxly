import { Redis } from '@upstash/redis';

const IS_SIM = process.env.DEV_SIMULATION === 'true';

// Lazy init — Redis constructor needs valid-looking creds to not throw at runtime
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

async function safeGet(k: string): Promise<unknown> {
  if (IS_SIM) return null;
  try { return await getRedis().get(k); } catch { return null; }
}

async function safeSet(k: string, value: unknown, ex: number): Promise<void> {
  if (IS_SIM) return;
  try { await getRedis().set(k, JSON.stringify(value), { ex }); } catch { /* cache miss is fine */ }
}

async function safeDel(k: string): Promise<void> {
  if (IS_SIM) return;
  try { await getRedis().del(k); } catch { /* best effort */ }
}

const TTL = {
  MEAL_PLAN: 60 * 60,
  PRODUCT_SEARCH: 60 * 60 * 24,
  STORE_LOOKUP: 60 * 60 * 24,
  INVENTORY: 60 * 30,
};

function key(namespace: string, ...parts: string[]): string {
  return `ag:${namespace}:${parts.join(':')}`;
}

export const cacheService = {
  async getMealPlan(intentId: string) {
    return safeGet(key('meals', intentId));
  },
  async setMealPlan(intentId: string, data: unknown) {
    return safeSet(key('meals', intentId), data, TTL.MEAL_PLAN);
  },

  async getProductSearch(zip: string, ingredient: string) {
    const slug = ingredient.toLowerCase().replace(/\s+/g, '_');
    return safeGet(key('products', zip, slug));
  },
  async setProductSearch(zip: string, ingredient: string, data: unknown) {
    const slug = ingredient.toLowerCase().replace(/\s+/g, '_');
    return safeSet(key('products', zip, slug), data, TTL.PRODUCT_SEARCH);
  },

  async getStoreLookup(zip: string) {
    return safeGet(key('stores', zip));
  },
  async setStoreLookup(zip: string, data: unknown) {
    return safeSet(key('stores', zip), data, TTL.STORE_LOOKUP);
  },

  async getInventory(storeId: string, productId: string) {
    return safeGet(key('inventory', storeId, productId));
  },
  async setInventory(storeId: string, productId: string, data: unknown) {
    return safeSet(key('inventory', storeId, productId), data, TTL.INVENTORY);
  },

  async invalidate(namespace: string, ...parts: string[]) {
    return safeDel(key(namespace, ...parts));
  },

  async invalidateProductsForZip(zip: string): Promise<void> {
    if (IS_SIM) return;
    const { onInventoryUpdate } = await import('./invalidationRules');
    await onInventoryUpdate(zip, '*');
  },

  async invalidateMealsForUser(userId: string): Promise<void> {
    if (IS_SIM) return;
    const { onMemoryUpdate } = await import('./invalidationRules');
    await onMemoryUpdate(userId);
  },

  async invalidateStoresForZip(zip: string): Promise<void> {
    return safeDel(key('stores', zip));
  },

  async ping(): Promise<boolean> {
    if (IS_SIM) return true;
    try { await getRedis().ping(); return true; } catch { return false; }
  },
};
