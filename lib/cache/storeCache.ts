import { createCache } from '@/lib/cache';
import type { StoreEntity } from '@/lib/contracts';

// 10-minute TTL — store catalogs are static; long cache is safe
export const storeCache = createCache<StoreEntity[]>(10 * 60 * 1000);
