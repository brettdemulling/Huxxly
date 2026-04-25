import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────────────

export type DietaryFlag =
  | 'gluten_free'
  | 'dairy_free'
  | 'vegetarian'
  | 'vegan'
  | 'nut_free'
  | 'low_sodium'
  | 'kid_friendly'
  | 'halal'
  | 'kosher';

export type StoreProvider = 'instacart' | 'kroger' | 'walmart';

export type EventType =
  | 'intent_created'
  | 'meals_generated'
  | 'cart_built'
  | 'checkout_triggered'
  | 'inventory_checked'
  | 'product_matched'
  | 'substitution_applied'
  | 'failover_triggered'
  | 'error_occurred'
  | 'cache_hit'
  | 'cache_miss'
  | 'checkout_attempt_started'
  | 'checkout_attempt_success'
  | 'checkout_attempt_failed'
  | 'store_fallback_triggered'
  | 'cart_build_completed'
  | 'cart_build_failed'
  | 'savings_recorded';

// ─── Canonical Ingredient ────────────────────────────────────────────────────

export const IngredientCanonicalSchema = z.object({
  id: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  category: z.string(),
  quantity: z.number().positive(),
  unit: z.string(),
  estimatedCostCents: z.number().nonnegative(),
  dietaryFlags: z.array(z.string()),
  substitutes: z.array(z.string()).default([]),
});

export type IngredientCanonical = z.infer<typeof IngredientCanonicalSchema>;

// ─── Canonical Meal ──────────────────────────────────────────────────────────

export const MealCanonicalSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  ingredients: z.array(IngredientCanonicalSchema),
  servings: z.number().positive(),
  prepTimeMinutes: z.number().nonnegative(),
  cookTimeMinutes: z.number().nonnegative(),
  dietaryFlags: z.array(z.string()),
  estimatedCostCents: z.number().nonnegative(),
  sharedIngredientCount: z.number().nonnegative().default(0),
});

export type MealCanonical = z.infer<typeof MealCanonicalSchema>;

// ─── Canonical Product ───────────────────────────────────────────────────────

export const ProductCanonicalSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  provider: z.enum(['instacart', 'kroger', 'walmart']),
  name: z.string(),
  brand: z.string().optional(),
  priceCents: z.number().nonnegative(),
  pricePerUnit: z.number().nonnegative().optional(),
  unit: z.string(),
  quantity: z.number().positive(),
  imageUrl: z.string().url().optional(),
  inStock: z.boolean(),
  availableInZip: z.string().optional(),
  matchScore: z.number().min(0).max(1).default(0),
  ingredientId: z.string().optional(),
});

export type ProductCanonical = z.infer<typeof ProductCanonicalSchema>;

// ─── Canonical Cart ──────────────────────────────────────────────────────────

export const CartItemSchema = z.object({
  product: ProductCanonicalSchema,
  ingredientId: z.string(),
  quantity: z.number().positive(),
  lineTotal: z.number().nonnegative(),
});

export type CartItem = z.infer<typeof CartItemSchema>;

export const CartCanonicalSchema = z.object({
  id: z.string(),
  userId: z.string(),
  provider: z.enum(['instacart', 'kroger', 'walmart']),
  storeId: z.string(),
  storeName: z.string(),
  items: z.array(CartItemSchema),
  subtotalCents: z.number().nonnegative(),
  estimatedDeliveryFee: z.number().nonnegative(),
  estimatedTotalCents: z.number().nonnegative(),
  checkoutUrl: z.string().url().optional(),
  missingIngredients: z.array(z.string()).default([]),
  coverageScore: z.number().min(0).max(1),
  createdAt: z.string().datetime(),
});

export type CartCanonical = z.infer<typeof CartCanonicalSchema>;

// ─── Intent ──────────────────────────────────────────────────────────────────

export const IntentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  rawInput: z.string(),
  budgetCents: z.number().positive(),
  zipCode: z.string().regex(/^\d{5}$/),
  servings: z.number().positive().default(4),
  dietaryFlags: z.array(z.string()),
  mealCount: z.number().positive().default(5),
  createdAt: z.string().datetime(),
});

export type Intent = z.infer<typeof IntentSchema>;

// ─── Store Info ──────────────────────────────────────────────────────────────

export const StoreInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.enum(['instacart', 'kroger', 'walmart']),
  address: z.string(),
  zipCode: z.string(),
  distanceMiles: z.number().nonnegative(),
  availabilityConfidence: z.number().min(0).max(1),
  deliveryCoverageScore: z.number().min(0).max(1),
  pickupAvailable: z.boolean(),
  deliveryAvailable: z.boolean(),
  compositeScore: z.number().min(0).max(1),
});

export type StoreInfo = z.infer<typeof StoreInfoSchema>;

// ─── Price Breakdown ─────────────────────────────────────────────────────────

export interface StoreComparison {
  store: string;
  cost: number;
}

export interface PriceBreakdown {
  originalCost: number;
  optimizedCost: number;
  savings: number;
  itemCost: number;
  deliveryFees: number;
  serviceFees: number;
  storeComparison: StoreComparison[];
  optimizationStrategy: string;
}

// ─── Autopilot Explanation ───────────────────────────────────────────────────

export interface AutopilotExplanation {
  whyThisPlan: string;
  whyTheseMeals: string;
  whyThisStore: string;
}

// ─── Savings Data ────────────────────────────────────────────────────────────

export interface SavingsData {
  thisOrderSavings: number;
  thisOrderSavingsPercent: string;
  averageUserSavings: string;
  lifetimeSavings: number;
}

// ─── Flow Result ─────────────────────────────────────────────────────────────

export interface FlowResult {
  intent: Intent;
  meals: MealCanonical[];
  carts: CartCanonical[];
  primaryCart: CartCanonical;
  failoverApplied: boolean;
  eventIds: string[];
  priceBreakdown?: PriceBreakdown;
  autopilotExplanation?: AutopilotExplanation;
  savingsData?: SavingsData;
  confidenceScore?: number;
  trustScore?: number;
  undoToken?: string;
}

// ─── Zod Input Schemas (for API validation) ───────────────────────────────────

export const IntentInputSchema = z.object({
  input: z.string().min(5).max(500),
  zipCode: z.string().regex(/^\d{5}$/, 'Must be 5-digit ZIP'),
});

export type IntentInput = z.infer<typeof IntentInputSchema>;

export const CheckoutInputSchema = z.object({
  cartId: z.string(),
  intentId: z.string(),
});

export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;
