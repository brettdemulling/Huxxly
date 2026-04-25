import type { CartCanonical, PriceBreakdown } from '@/lib/core/canonicalModels';
import { buildPriceBreakdown } from './priceBreakdown';

export interface OptimizationResult {
  bestCart: CartCanonical;
  priceBreakdown: PriceBreakdown;
  priceVariancePercent: number;
}

export function optimizePrice(carts: CartCanonical[]): OptimizationResult {
  if (!carts.length) throw new Error('No carts to optimize');

  const sorted = [...carts].sort((a, b) => a.estimatedTotalCents - b.estimatedTotalCents);
  const bestCart = sorted[0];
  const worstCart = sorted[sorted.length - 1];

  const priceVariancePercent =
    worstCart.estimatedTotalCents > 0
      ? parseFloat(
          (((worstCart.estimatedTotalCents - bestCart.estimatedTotalCents) /
            worstCart.estimatedTotalCents) *
            100).toFixed(1),
        )
      : 0;

  const priceBreakdown = buildPriceBreakdown(bestCart, carts);

  return { bestCart, priceBreakdown, priceVariancePercent };
}

export function estimateAlternativeCartCost(
  primaryCart: CartCanonical,
  providerMarkup: number,
): CartCanonical {
  const factor = 1 + providerMarkup;
  return {
    ...primaryCart,
    subtotalCents: Math.round(primaryCart.subtotalCents * factor),
    estimatedTotalCents: Math.round(primaryCart.estimatedTotalCents * factor),
  };
}
