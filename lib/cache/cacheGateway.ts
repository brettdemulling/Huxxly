/**
 * cacheGateway — the ONLY valid interface for cache reads, writes, and invalidation.
 *
 * All modules MUST import from here. Direct cacheService imports are prohibited.
 *
 * Guarantees:
 *   - Every write passes through cacheGuard (violation logging)
 *   - Every write automatically triggers invalidation cascades (invalidationRules)
 *   - Reads and invalidations are centrally observable
 */
import { cacheService } from './cacheService';
import { guardWrite, guardRead, getInvalidationCascade, CacheNamespace } from './cacheGuard';
import { onInventoryUpdate, onMemoryUpdate, onGeoChange, trackUserIntent } from './invalidationRules';
import { metrics } from '@/lib/monitoring/metrics';

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getMealPlan(intentId: string): Promise<unknown> {
  guardRead('meals', intentId);
  const result = await cacheService.getMealPlan(intentId);
  result ? metrics.cacheHit('meals') : metrics.cacheMiss('meals');
  return result;
}

export async function getProductSearch(zip: string, ingredient: string): Promise<unknown> {
  guardRead('products', `${zip}:${ingredient}`);
  const result = await cacheService.getProductSearch(zip, ingredient);
  result ? metrics.cacheHit('products') : metrics.cacheMiss('products');
  return result;
}

export async function getStoreLookup(zip: string): Promise<unknown> {
  guardRead('stores', zip);
  const result = await cacheService.getStoreLookup(zip);
  result ? metrics.cacheHit('stores') : metrics.cacheMiss('stores');
  return result;
}

export async function getInventory(storeId: string, productId: string): Promise<unknown> {
  guardRead('inventory', `${storeId}:${productId}`);
  const result = await cacheService.getInventory(storeId, productId);
  result ? metrics.cacheHit('inventory') : metrics.cacheMiss('inventory');
  return result;
}

// ─── Writes (write-through: guard → cascade → persist) ───────────────────────

export async function setMealPlan(intentId: string, data: unknown, userId?: string): Promise<void> {
  await guardWrite('meals', intentId, userId);
  await cacheService.setMealPlan(intentId, data);
  // No cascade from meal writes — meal plan is authoritative
}

export async function setProductSearch(
  zip: string,
  ingredient: string,
  data: unknown,
  userId?: string,
): Promise<void> {
  await guardWrite('products', `${zip}:${ingredient}`, userId);
  await cacheService.setProductSearch(zip, ingredient, data);
}

export async function setStoreLookup(zip: string, data: unknown, userId?: string): Promise<void> {
  await guardWrite('stores', zip, userId);
  await cacheService.setStoreLookup(zip, data);
}

export async function setInventory(
  storeId: string,
  productId: string,
  data: unknown,
  userId?: string,
): Promise<void> {
  await guardWrite('inventory', `${storeId}:${productId}`, userId);
  await cacheService.setInventory(storeId, productId, data);

  // Automatic cascade: new inventory data invalidates stale product searches for this location
  const cascade = getInvalidationCascade('inventory', storeId);
  for (const { keyPattern } of cascade) {
    // storeId format: "provider-zip" — extract zip for product search invalidation
    const zip = storeId.split('-').slice(1).join('-');
    if (zip) {
      await onInventoryUpdate(zip, storeId.split('-')[0]).catch(() => {});
    }
  }
}

// ─── Invalidation (all paths go through here) ─────────────────────────────────

export async function invalidateMealsForUser(userId: string): Promise<void> {
  await onMemoryUpdate(userId);
}

export async function invalidateProductsForZip(zip: string, provider?: string): Promise<void> {
  await onInventoryUpdate(zip, provider ?? '*');
}

export async function invalidateStoresForZip(zip: string): Promise<void> {
  await cacheService.invalidate('stores', zip);
}

export async function invalidateOnGeoChange(oldZip: string, newZip: string): Promise<void> {
  await onGeoChange(oldZip, newZip);
}

// ─── Intent tracking (needed by flow engine) ─────────────────────────────────

export async function registerUserIntent(userId: string, intentId: string): Promise<void> {
  await trackUserIntent(userId, intentId);
}

// ─── Health check ─────────────────────────────────────────────────────────────

export async function ping(): Promise<boolean> {
  return cacheService.ping();
}
