import { v4 as uuidv4 } from 'uuid';
import * as cache from '@/lib/cache/cacheGateway';
import type { FlowResult } from '@/lib/core/canonicalModels';

export async function markPending(flowResult: FlowResult): Promise<string> {
  const token = uuidv4();
  await cache.setMealPlan(`undo:${token}`, flowResult as unknown as object[], flowResult.intent.userId);
  return token;
}

export async function confirmCheckout(token: string): Promise<void> {
  await cache.invalidateMealsForUser(`undo:${token}`);
}

export async function rollbackCheckout(token: string): Promise<FlowResult | null> {
  const raw = await cache.getMealPlan(`undo:${token}`);
  if (!raw) return null;
  await cache.invalidateMealsForUser(`undo:${token}`);
  return raw as unknown as FlowResult;
}

const UNDO_WINDOW_MS = 300_000;

export function isWithinUndoWindow(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < UNDO_WINDOW_MS;
}
