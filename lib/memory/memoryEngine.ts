import { prisma } from '@/lib/db';
import { MealCanonical, Intent } from '@/lib/core/canonicalModels';

export interface HouseholdMemoryProfile {
  userId: string;
  pastIntents: Intent[];
  acceptedMeals: MealCanonical[];
  rejectedSubstitutions: string[];
  dietaryPatterns: Record<string, number>;
  budgetBehavior: {
    avgBudgetCents: number;
    budgetHistory: number[];
  };
  preferredStores: string[];
}

export async function getMemoryProfile(userId: string): Promise<HouseholdMemoryProfile> {
  const profile = await prisma.memoryProfile.findUnique({ where: { userId } });

  if (!profile) {
    return {
      userId,
      pastIntents: [],
      acceptedMeals: [],
      rejectedSubstitutions: [],
      dietaryPatterns: {},
      budgetBehavior: { avgBudgetCents: 0, budgetHistory: [] },
      preferredStores: [],
    };
  }

  return {
    userId,
    pastIntents: profile.pastIntents as unknown as Intent[],
    acceptedMeals: profile.acceptedMeals as unknown as MealCanonical[],
    rejectedSubstitutions: profile.rejectedSubs as unknown as string[],
    dietaryPatterns: profile.dietaryPatterns as Record<string, number>,
    budgetBehavior: profile.budgetBehavior as { avgBudgetCents: number; budgetHistory: number[] },
    preferredStores: profile.preferredStores as unknown as string[],
  };
}

export async function recordIntent(userId: string, intent: Intent): Promise<void> {
  const profile = await getMemoryProfile(userId);

  const pastIntents = [intent, ...profile.pastIntents].slice(0, 20);

  const budgetHistory = [intent.budgetCents, ...profile.budgetBehavior.budgetHistory].slice(0, 10);
  const avgBudgetCents = Math.round(budgetHistory.reduce((a, b) => a + b, 0) / budgetHistory.length);

  const dietaryPatterns = { ...profile.dietaryPatterns };
  for (const flag of intent.dietaryFlags) {
    dietaryPatterns[flag] = (dietaryPatterns[flag] ?? 0) + 1;
  }

  await upsertProfile(userId, {
    pastIntents,
    dietaryPatterns,
    budgetBehavior: { avgBudgetCents, budgetHistory },
  });
}

export async function recordAcceptedMeals(userId: string, meals: MealCanonical[]): Promise<void> {
  const profile = await getMemoryProfile(userId);
  const acceptedMeals = [...meals, ...profile.acceptedMeals].slice(0, 50);
  await upsertProfile(userId, { acceptedMeals });
}

export async function recordRejectedSubstitution(userId: string, ingredientName: string): Promise<void> {
  const profile = await getMemoryProfile(userId);
  const rejectedSubs = [...new Set([ingredientName, ...profile.rejectedSubstitutions])].slice(0, 100);
  await upsertProfile(userId, { rejectedSubs });
}

export async function recordPreferredStore(userId: string, storeId: string): Promise<void> {
  const profile = await getMemoryProfile(userId);
  const preferredStores = [...new Set([storeId, ...profile.preferredStores])].slice(0, 5);
  await upsertProfile(userId, { preferredStores });
}

async function upsertProfile(userId: string, data: Record<string, unknown>): Promise<void> {
  await prisma.memoryProfile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

export function buildMemoryContext(profile: HouseholdMemoryProfile): string {
  const lines: string[] = [];

  if (profile.budgetBehavior.avgBudgetCents > 0) {
    lines.push(`Average household budget: $${(profile.budgetBehavior.avgBudgetCents / 100).toFixed(2)}`);
  }

  const topDietary = Object.entries(profile.dietaryPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);
  if (topDietary.length) {
    lines.push(`Dietary preferences observed: ${topDietary.join(', ')}`);
  }

  if (profile.acceptedMeals.length) {
    const recent = profile.acceptedMeals.slice(0, 5).map((m) => m.name);
    lines.push(`Recently enjoyed meals: ${recent.join(', ')}`);
  }

  if (profile.rejectedSubstitutions.length) {
    lines.push(`Avoid substituting: ${profile.rejectedSubstitutions.slice(0, 5).join(', ')}`);
  }

  return lines.join('\n');
}
