import type { MealPlanIntent, MealPlanResult } from '@/lib/contracts';

export type { MealPlanIntent, MealPlanResult };

// Delegates to the existing /api/mealplan/generate route logic.
// Future: move the generation logic here and have the route call this domain.
export async function buildMealPlan(_intent: MealPlanIntent): Promise<MealPlanResult> {
  throw new Error(
    'buildMealPlan: not yet wired — meal plan generation lives in /api/mealplan/generate. ' +
    'Migrate that route handler into this domain to activate.',
  );
}
