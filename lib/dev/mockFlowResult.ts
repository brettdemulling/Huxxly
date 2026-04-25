// ─── Mock Flow Result ─────────────────────────────────────────────────────────
// Exact types from canonicalModels. Used in simulation mode only.
// Images: stable placehold.co URLs — no external API required.

import { v4 as uuidv4 } from 'uuid';
import type {
  FlowResult,
  CartItem,
  MealCanonical,
  Intent,
  CartCanonical,
  IngredientCanonical,
} from '@/lib/core/canonicalModels';

function img(label: string, bg = 'EFF6FF', fg = '3B82F6') {
  return `https://placehold.co/80x80/${bg}/${fg}?text=${encodeURIComponent(label)}`;
}

function makeIngredient(name: string, costCents: number): IngredientCanonical {
  return {
    id: uuidv4(),
    name,
    normalizedName: name.toLowerCase(),
    category: 'grocery',
    quantity: 1,
    unit: 'serving',
    estimatedCostCents: costCents,
    dietaryFlags: [],
    substitutes: [],
  };
}

function makeCartItem(
  name: string,
  brand: string,
  priceCents: number,
  imageLabel: string,
  bgColor = 'EFF6FF',
  fgColor = '3B82F6',
): CartItem {
  return {
    product: {
      id: uuidv4(),
      storeId: 'kroger-sim-001',
      provider: 'instacart',
      name,
      brand,
      priceCents,
      unit: 'ea',
      quantity: 1,
      imageUrl: img(imageLabel, bgColor, fgColor),
      inStock: true,
      availableInZip: '37067',
      matchScore: 0.94,
    },
    ingredientId: uuidv4(),
    quantity: 1,
    lineTotal: priceCents,
  };
}

const SIM_ITEMS: CartItem[] = [
  makeCartItem('Chicken Breast (2 lb)',       'Simple Truth',     699,  'CHK', 'FFF7ED', 'EA580C'),
  makeCartItem('Ground Turkey (1 lb)',         'Jennie-O',         449,  'TKY', 'FFF7ED', 'EA580C'),
  makeCartItem('Atlantic Salmon (1 lb)',       'Wild-Caught',      899,  'SAL', 'EFF6FF', '3B82F6'),
  makeCartItem('Penne Pasta (16 oz)',          'Barilla',          199,  'PST', 'FEFCE8', 'CA8A04'),
  makeCartItem('Jasmine Rice (2 lb)',          'Mahatma',          349,  'RCE', 'FEFCE8', 'CA8A04'),
  makeCartItem('Large Eggs (12 ct)',           'Simple Truth',     479,  'EGG', 'FEFCE8', 'CA8A04'),
  makeCartItem('Shredded Cheddar (8 oz)',      'Tillamook',        399,  'CHZ', 'FEFCE8', 'CA8A04'),
  makeCartItem('Flour Tortillas (10 ct)',      'Mission',          329,  'TRT', 'F8FAFC', '64748B'),
  makeCartItem('Broccoli Florets (12 oz)',     'Organic',          299,  'BRC', 'F0FDF4', '22C55E'),
  makeCartItem('Cherry Tomatoes (10 oz)',      'Sunset',           249,  'TOM', 'FFF1F2', 'E11D48'),
  makeCartItem('Garlic (3-pack)',              'Christopher Ranch', 149, 'GRL', 'F8FAFC', '64748B'),
  makeCartItem('Olive Oil (16 oz)',            'California Olive',  599, 'OIL', 'FEFCE8', 'CA8A04'),
  makeCartItem('Diced Tomatoes (14.5 oz)',     "Hunt's",           129,  'CAN', 'FFF1F2', 'E11D48'),
  makeCartItem('Low-Sodium Soy Sauce (10 oz)', 'Kikkoman',        299,  'SOY', 'F8FAFC', '64748B'),
  makeCartItem('Mixed Bell Peppers (3 ct)',    'Pero Family',      349,  'PEP', 'FFF1F2', 'E11D48'),
];

function makeMeal(
  name: string,
  desc: string,
  costCents: number,
  ingredientNames: string[],
  flags: string[],
): MealCanonical {
  const perItem = Math.floor(costCents / ingredientNames.length);
  return {
    id: uuidv4(),
    name,
    description: desc,
    servings: 4,
    prepTimeMinutes: 10,
    cookTimeMinutes: 25,
    estimatedCostCents: costCents,
    dietaryFlags: flags,
    sharedIngredientCount: 2,
    ingredients: ingredientNames.map((n) => makeIngredient(n, perItem)),
  };
}

const SIM_MEALS: MealCanonical[] = [
  makeMeal(
    'Chicken Pasta Primavera',
    'Tender chicken with penne, broccoli, and cherry tomatoes in olive oil.',
    1850,
    ['Chicken breast', 'Penne pasta', 'Broccoli', 'Cherry tomatoes', 'Olive oil', 'Garlic'],
    ['dairy_free'],
  ),
  makeMeal(
    'Turkey Tacos',
    'Seasoned ground turkey in warm flour tortillas with fresh toppings.',
    1420,
    ['Ground turkey', 'Flour tortillas', 'Cheddar', 'Bell peppers', 'Diced tomatoes'],
    [],
  ),
  makeMeal(
    'Baked Salmon with Rice',
    'Flaky salmon over jasmine rice with a soy-garlic glaze.',
    2180,
    ['Atlantic salmon', 'Jasmine rice', 'Soy sauce', 'Garlic', 'Olive oil'],
    ['dairy_free'],
  ),
  makeMeal(
    'Veggie Stir Fry',
    'Colorful bell peppers and broccoli over steamed rice.',
    980,
    ['Bell peppers', 'Broccoli', 'Jasmine rice', 'Soy sauce', 'Garlic'],
    ['vegan', 'dairy_free'],
  ),
  makeMeal(
    'Breakfast Burritos',
    'Scrambled eggs, cheese, and peppers wrapped in warm tortillas.',
    1140,
    ['Eggs', 'Cheddar', 'Bell peppers', 'Flour tortillas'],
    ['vegetarian'],
  ),
];

const subtotal = SIM_ITEMS.reduce((s, i) => s + i.lineTotal, 0);

const SIM_CART: CartCanonical = {
  id: uuidv4(),
  userId: 'sim-user-001',
  provider: 'instacart',
  storeId: 'kroger-nashville-001',
  storeName: 'Kroger (via Instacart)',
  items: SIM_ITEMS,
  subtotalCents: subtotal,
  estimatedDeliveryFee: 0,
  estimatedTotalCents: subtotal,
  checkoutUrl: 'https://www.instacart.com/store/kroger/checkout?cart_id=sim-demo-cart',
  missingIngredients: [],
  coverageScore: 0.97,
  createdAt: new Date().toISOString(),
};

const SIM_INTENT: Intent = {
  id: uuidv4(),
  userId: 'sim-user-001',
  rawInput: 'Feed my family for $120, kid-friendly',
  budgetCents: 12000,
  zipCode: '37067',
  servings: 4,
  dietaryFlags: [],
  mealCount: 5,
  createdAt: new Date().toISOString(),
};

export function buildMockFlowResult(): FlowResult {
  const savings = 12000 - subtotal;
  const walmartCost = subtotal * 1.08;
  const krogerCost = subtotal * 1.14;

  return {
    intent: SIM_INTENT,
    meals: SIM_MEALS,
    carts: [SIM_CART],
    primaryCart: SIM_CART,
    failoverApplied: false,
    eventIds: [],
    priceBreakdown: {
      originalCost: walmartCost / 100,
      optimizedCost: subtotal / 100,
      savings: savings / 100,
      itemCost: subtotal / 100,
      deliveryFees: 0,
      serviceFees: (subtotal * 0.05) / 100,
      storeComparison: [
        { store: 'Kroger via Instacart', cost: subtotal / 100 },
        { store: 'Walmart',              cost: walmartCost / 100 },
        { store: 'Kroger Direct',        cost: krogerCost / 100 },
      ],
      optimizationStrategy: 'Lowest total cost with full coverage across all stores.',
    },
    autopilotExplanation: {
      whyThisPlan: 'Five balanced meals designed for a family of four within your $120 budget.',
      whyTheseMeals: 'Varied proteins, shared ingredients to reduce waste, and kid-friendly options.',
      whyThisStore: 'Kroger via Instacart had the best price across all providers with free delivery.',
    },
    savingsData: {
      thisOrderSavings: savings / 100,
      thisOrderSavingsPercent: `${Math.round((savings / 12000) * 100)}%`,
      averageUserSavings: '$18.40',
      lifetimeSavings: 18.4,
    },
    confidenceScore: 0.93,
    trustScore: 0.91,
    undoToken: uuidv4(),
  };
}
