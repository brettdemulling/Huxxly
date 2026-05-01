export type { GroceryStore, StoreType } from '@/lib/stores/getStoresByZip';
export { BASELINE_STORE } from '@/lib/stores/getStoresByZip';

import { getStoresByZip, BASELINE_STORE } from '@/lib/stores/getStoresByZip';
import type { GroceryStore } from '@/lib/stores/getStoresByZip';

export function resolveStores(zip: string): GroceryStore[] {
  if (!zip || !/^\d{5}$/.test(zip)) return [BASELINE_STORE];
  return getStoresByZip(zip);
}

export function resolveStore(zip: string, storeId?: string): GroceryStore {
  const stores = resolveStores(zip);
  return (storeId ? stores.find((s) => s.id === storeId) : null) ?? stores[0] ?? BASELINE_STORE;
}
