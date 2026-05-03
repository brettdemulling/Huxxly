import { createCache } from '@/lib/cache';
import type { SearchResponse } from '@/lib/contracts';

// 10-minute TTL — balances freshness vs DB/API load
export const searchCache = createCache<SearchResponse>(10 * 60 * 1000);
