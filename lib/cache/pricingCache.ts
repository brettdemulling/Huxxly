import { createCache } from '@/lib/cache';
import type { CartResult } from '@/lib/contracts';

// 60-second TTL — pricing can shift; don't serve stale totals for too long
export const pricingCache = createCache<CartResult>(60 * 1000);
