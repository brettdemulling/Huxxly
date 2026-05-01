import { createCache } from '@/lib/cache';
import type { SearchResponse } from '@/lib/contracts';

// 2-minute TTL — short enough to pick up new recipes, long enough to absorb burst traffic
export const searchCache = createCache<SearchResponse>(2 * 60 * 1000);
