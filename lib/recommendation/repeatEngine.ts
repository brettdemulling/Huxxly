import type { Intent } from '@/lib/core/canonicalModels';
import { prisma } from '@/lib/db';
import { logEvent } from '@/lib/events/eventLogger';

export interface RepeatPattern {
  detected: boolean;
  confidence: number;
  suggestedReorder: boolean;
  lastIntentId?: string;
  patternDescription?: string;
}

const REORDER_CONFIDENCE_THRESHOLD = 0.7;

export async function detectRepeatPattern(userId: string, currentIntent: Intent): Promise<RepeatPattern> {
  try {
    const recentIntents = await prisma.intent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    if (recentIntents.length < 2) {
      return { detected: false, confidence: 0, suggestedReorder: false };
    }

    const budgets = recentIntents.map((i) => i.budgetCents);
    const avgBudget = budgets.reduce((s, b) => s + b, 0) / budgets.length;
    const budgetVariance = Math.abs(currentIntent.budgetCents - avgBudget) / avgBudget;

    const commonDietaryFlags = recentIntents.reduce((common, i) => {
      const flags = i.dietaryFlags as string[];
      return common.filter((f) => flags.includes(f));
    }, (recentIntents[0].dietaryFlags as string[]) ?? []);

    const dietaryMatch =
      commonDietaryFlags.length > 0
        ? commonDietaryFlags.filter((f) =>
            (currentIntent.dietaryFlags as string[]).includes(f),
          ).length / Math.max(commonDietaryFlags.length, 1)
        : 0.5;

    const budgetScore = Math.max(0, 1 - budgetVariance * 2);
    const confidence = Math.min(0.6 * budgetScore + 0.4 * dietaryMatch, 1.0);
    const lastIntent = recentIntents[0];

    return {
      detected: confidence >= 0.5,
      confidence: Math.round(confidence * 100) / 100,
      suggestedReorder: confidence >= REORDER_CONFIDENCE_THRESHOLD,
      lastIntentId: lastIntent.id,
      patternDescription:
        confidence >= 0.5
          ? `Weekly pattern detected: ~$${(avgBudget / 100).toFixed(0)} budget with ${commonDietaryFlags.join(', ') || 'flexible'} preferences`
          : undefined,
    };
  } catch {
    return { detected: false, confidence: 0, suggestedReorder: false };
  }
}

export async function buildReorderCart(userId: string, zip: string): Promise<string | null> {
  try {
    const lastIntent = await prisma.intent.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastIntent) return null;

    await logEvent('intent_created', userId, {
      type: 'reorder_triggered',
      sourceIntentId: lastIntent.id,
    }, zip);

    return lastIntent.id;
  } catch {
    return null;
  }
}
