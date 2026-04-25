import type { CartCanonical, PriceBreakdown, StoreComparison } from '@/lib/core/canonicalModels';

const SERVICE_FEE_RATE = 0.05;

export function buildPriceBreakdown(
  optimizedCart: CartCanonical,
  allCarts: CartCanonical[],
): PriceBreakdown {
  const itemCost = optimizedCart.subtotalCents / 100;
  const deliveryFees = optimizedCart.estimatedDeliveryFee / 100;
  const serviceFees = parseFloat((itemCost * SERVICE_FEE_RATE).toFixed(2));
  const optimizedCost = parseFloat((itemCost + deliveryFees + serviceFees).toFixed(2));

  const costs = allCarts.map((c) => ({
    store: c.storeName,
    cost: parseFloat(
      ((c.subtotalCents + c.estimatedDeliveryFee) / 100 + c.subtotalCents / 100 * SERVICE_FEE_RATE).toFixed(2),
    ),
  }));

  const originalCost = costs.reduce((max, c) => Math.max(max, c.cost), optimizedCost);
  const savings = parseFloat((originalCost - optimizedCost).toFixed(2));

  const storeComparison: StoreComparison[] = costs.sort((a, b) => a.cost - b.cost);

  const strategy = savings > 10
    ? 'split_between_stores'
    : savings > 0
    ? 'single_cheapest_store'
    : 'best_available';

  return {
    originalCost,
    optimizedCost,
    savings: Math.max(savings, 0),
    itemCost,
    deliveryFees,
    serviceFees,
    storeComparison,
    optimizationStrategy: strategy,
  };
}
