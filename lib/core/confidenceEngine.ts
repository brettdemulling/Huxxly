import type { Intent, MealCanonical, CartCanonical } from '@/lib/core/canonicalModels';

export interface ConfidenceSignals {
  intentClarity: number;
  checkoutFeasibility: number;
  apiReliability: number;
  inventoryConfidence: number;
}

export interface ConfidenceResult {
  score: number;
  signals: ConfidenceSignals;
  meetsAutopilotThreshold: boolean;
}

export function scoreIntentClarity(intent: Intent): number {
  let score = 0.5;
  if (intent.budgetCents > 0) score += 0.2;
  if (intent.dietaryFlags.length > 0) score += 0.1;
  if (intent.servings > 0 && intent.servings <= 12) score += 0.1;
  if (intent.mealCount >= 3 && intent.mealCount <= 10) score += 0.1;
  return Math.min(score, 1.0);
}

export function scoreCheckoutFeasibility(cart: CartCanonical): number {
  const coverage = cart.coverageScore;
  const hasMissingItems = cart.missingIngredients.length > 0;
  const hasItems = cart.items.length > 0;
  if (!hasItems) return 0;
  return coverage * (hasMissingItems ? 0.85 : 1.0);
}

export function scoreApiReliability(provider: string): number {
  const knownUptimes: Record<string, number> = {
    instacart: 0.97,
    walmart: 0.95,
    kroger: 0.93,
  };
  return knownUptimes[provider] ?? 0.9;
}

export function scoreInventoryConfidence(cart: CartCanonical, meals: MealCanonical[]): number {
  const totalIngredients = meals.reduce((s, m) => s + m.ingredients.length, 0);
  if (totalIngredients === 0) return 0;
  const coveredItems = cart.items.length;
  return Math.min(coveredItems / Math.max(totalIngredients, 1), 1.0);
}

export function computeFlowConfidence(
  intent: Intent,
  meals: MealCanonical[],
  cart: CartCanonical,
): ConfidenceResult {
  const signals: ConfidenceSignals = {
    intentClarity: scoreIntentClarity(intent),
    checkoutFeasibility: scoreCheckoutFeasibility(cart),
    apiReliability: scoreApiReliability(cart.provider),
    inventoryConfidence: scoreInventoryConfidence(cart, meals),
  };

  const score =
    0.3 * signals.intentClarity +
    0.3 * signals.checkoutFeasibility +
    0.2 * signals.apiReliability +
    0.2 * signals.inventoryConfidence;

  return {
    score: Math.round(score * 100) / 100,
    signals,
    meetsAutopilotThreshold: score >= 0.85 && signals.inventoryConfidence >= 0.7,
  };
}
