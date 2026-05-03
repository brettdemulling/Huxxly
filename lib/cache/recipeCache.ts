import { createCache } from '@/lib/cache';

// 1-hour TTL — recipe detail rarely changes after ingestion
export const recipeCache = createCache<unknown>(60 * 60 * 1000);
