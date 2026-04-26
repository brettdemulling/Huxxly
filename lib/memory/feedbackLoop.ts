import { recordAcceptedMeals, recordPreferredStore } from './memoryEngine';
import { updateUserBehaviorFromCart } from './userBehaviorEngine';
import type { CartCanonical, MealCanonical } from '@/lib/core/canonicalModels';

function fire(fn: () => Promise<void>): void {
  void fn().catch(() => {});
}

export function onCheckoutSuccess(
  userId: string,
  cart: CartCanonical,
  meals: MealCanonical[],
): void {
  fire(async () => {
    await updateUserBehaviorFromCart(userId, cart);
    await recordPreferredStore(userId, cart.storeId);
    if (meals.length) {
      await recordAcceptedMeals(userId, meals);
    }
  });
}
