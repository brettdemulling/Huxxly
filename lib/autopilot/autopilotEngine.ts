import type { Intent, MealCanonical, CartCanonical, AutopilotExplanation } from '@/lib/core/canonicalModels';
import { computeFlowConfidence } from '@/lib/core/confidenceEngine';

export interface AutopilotDecision {
  approved: boolean;
  confidenceScore: number;
  priceVariancePercent: number;
  explanation: AutopilotExplanation;
  blockedReason?: string;
}

const CONFIDENCE_THRESHOLD = 0.85;
const PRICE_VARIANCE_THRESHOLD = 15;
const INVENTORY_CONFIDENCE_THRESHOLD = 0.7;

export function runAutopilot(
  intent: Intent,
  meals: MealCanonical[],
  cart: CartCanonical,
  priceVariancePercent: number,
): AutopilotDecision {
  const { score, signals, meetsAutopilotThreshold } = computeFlowConfidence(intent, meals, cart);

  const dietaryFlags = intent.dietaryFlags.join(', ') || 'no specific dietary restrictions';
  const explanation: AutopilotExplanation = {
    whyThisPlan: `Optimized for your $${(intent.budgetCents / 100).toFixed(0)} budget with ${dietaryFlags}. Selected the lowest-cost cart across available stores.`,
    whyTheseMeals: `${meals.length} meals chosen based on your preferences, serving ${intent.servings} people. Ingredients shared across meals to minimize waste and cost.`,
    whyThisStore: `${cart.storeName} selected for best price + ${Math.round(cart.coverageScore * 100)}% inventory coverage in ZIP ${intent.zipCode}.`,
  };

  if (!meetsAutopilotThreshold) {
    return {
      approved: false,
      confidenceScore: score,
      priceVariancePercent,
      explanation,
      blockedReason:
        score < CONFIDENCE_THRESHOLD
          ? `Confidence score ${score} below required ${CONFIDENCE_THRESHOLD}`
          : `Inventory confidence ${signals.inventoryConfidence} below required ${INVENTORY_CONFIDENCE_THRESHOLD}`,
    };
  }

  if (priceVariancePercent >= PRICE_VARIANCE_THRESHOLD) {
    return {
      approved: false,
      confidenceScore: score,
      priceVariancePercent,
      explanation,
      blockedReason: `Price variance ${priceVariancePercent}% exceeds ${PRICE_VARIANCE_THRESHOLD}% threshold`,
    };
  }

  return { approved: true, confidenceScore: score, priceVariancePercent, explanation };
}
