import { getStoresByZip, BASELINE_STORE } from '@/lib/stores/getStoresByZip';
import { StoreRepository } from '@/lib/repositories/StoreRepository';
import { storeCache } from '@/lib/cache/storeCache';
import { telemetry } from '@/lib/telemetry';
import type { StoreEntity } from '@/lib/contracts';

export type { StoreEntity };
export { BASELINE_STORE };
export type { GroceryStore, StoreType } from '@/lib/stores/getStoresByZip';

// ─── Async (cached) ───────────────────────────────────────────────────────────

export async function resolveStores(zip: string): Promise<StoreEntity[]> {
  if (!zip || !/^\d{5}$/.test(zip)) return [BASELINE_STORE as StoreEntity];
  const cacheKey = `stores:${zip}`;
  const cached = storeCache.get(cacheKey);
  if (cached) { telemetry.cacheHit('store', cacheKey); return cached; }
  telemetry.cacheMiss('store', cacheKey);
  const stores = await StoreRepository.findByZip(zip);
  storeCache.set(cacheKey, stores);
  return stores;
}

export async function resolveStore(zip: string, storeId?: string): Promise<StoreEntity> {
  const stores = await resolveStores(zip);
  return (storeId ? stores.find((s) => s.id === storeId) : null) ?? stores[0] ?? (BASELINE_STORE as StoreEntity);
}

// ─── Sync (no cache — for callers that can't await) ───────────────────────────

export function resolveStoresSync(zip: string): StoreEntity[] {
  if (!zip || !/^\d{5}$/.test(zip)) return [BASELINE_STORE as StoreEntity];
  return getStoresByZip(zip) as StoreEntity[];
}

export function resolveStoreSync(zip: string, storeId?: string): StoreEntity {
  const stores = resolveStoresSync(zip);
  return (storeId ? stores.find((s) => s.id === storeId) : null) ?? stores[0] ?? (BASELINE_STORE as StoreEntity);
}
