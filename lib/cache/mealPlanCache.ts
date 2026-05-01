import { createCache } from '@/lib/cache';
import type { MealPlanResult } from '@/lib/contracts';

// 5-minute TTL — plan can be regenerated; short window prevents stale display
export const mealPlanCache = createCache<MealPlanResult>(5 * 60 * 1000);
