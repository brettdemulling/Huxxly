import {
  getMemoryProfile,
  recordPreferredStore,
  HouseholdMemoryProfile,
} from './memoryEngine';
import type { CartCanonical, MealCanonical } from '@/lib/core/canonicalModels';
import { prisma } from '@/lib/db';

export interface UserBehavior {
  userId: string;
  preferredStores: string[];
  topDietaryFlags: string[];
  avgBudgetCents: number;
  repeatMealNames: string[];
  checkoutCount: number;
  lastActiveAt: string | null;
}

export interface CartPrediction {
  suggestedBudgetCents: number;
  suggestedStore: string | null;
  suggestedDietaryFlags: string[];
  suggestedMealNames: string[];
  confidence: number;
}

export async function getUserBehavior(userId: string): Promise<UserBehavior> {
  const profile = await getMemoryProfile(userId);

  const topDietaryFlags = Object.entries(profile.dietaryPatterns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([flag]) => flag);

  const repeatMealNames = profile.acceptedMeals
    .map((m) => m.name)
    .filter((name, i, arr) => arr.indexOf(name) !== i)
    .slice(0, 5);

  let checkoutCount = 0;
  let lastActiveAt: string | null = null;

  try {
    const row = await prisma.checkoutEvent.aggregate({
      where: { userId },
      _count: { id: true },
      _max: { createdAt: true },
    });
    checkoutCount = (row._count as { id: number }).id ?? 0;
    const maxDate = (row._max as { createdAt: Date | null }).createdAt;
    lastActiveAt = maxDate ? maxDate.toISOString() : null;
  } catch {
    // DB unavailable in sim mode — defaults stand
  }

  return {
    userId,
    preferredStores: profile.preferredStores,
    topDietaryFlags,
    avgBudgetCents: profile.budgetBehavior.avgBudgetCents,
    repeatMealNames,
    checkoutCount,
    lastActiveAt,
  };
}

export async function updateUserBehaviorFromCart(
  userId: string,
  cart: CartCanonical,
): Promise<void> {
  await recordPreferredStore(userId, cart.storeId);
}

export async function predictNextCart(userId: string): Promise<CartPrediction> {
  const profile: HouseholdMemoryProfile = await getMemoryProfile(userId);

  const suggestedBudgetCents =
    profile.budgetBehavior.avgBudgetCents > 0
      ? profile.budgetBehavior.avgBudgetCents
      : 10000;

  const suggestedStore = profile.preferredStores[0] ?? null;

  const suggestedDietaryFlags = Object.entries(profile.dietaryPatterns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([flag]) => flag);

  const nameCounts: Record<string, number> = {};
  for (const meal of profile.acceptedMeals) {
    nameCounts[meal.name] = (nameCounts[meal.name] ?? 0) + 1;
  }
  const suggestedMealNames = Object.entries(nameCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name]) => name);

  const hasHistory =
    profile.pastIntents.length > 0 || profile.acceptedMeals.length > 0;
  const confidence = hasHistory ? Math.min(0.5 + profile.pastIntents.length * 0.05, 0.92) : 0.3;

  return {
    suggestedBudgetCents,
    suggestedStore,
    suggestedDietaryFlags,
    suggestedMealNames,
    confidence,
  };
}
