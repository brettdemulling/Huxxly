import type { CartCanonical, StoreProvider } from '@/lib/core/canonicalModels';

export interface ProviderReliability {
  provider: StoreProvider;
  apiUptimeScore: number;
  checkoutSuccessRate: number;
  avgResponseMs: number;
}

export interface TrustResult {
  trustScore: number;
  apiReliabilityScore: number;
  storeTrustRanking: ProviderReliability[];
  checkoutSuccessProbability: number;
}

const PROVIDER_STATS: Record<StoreProvider, ProviderReliability> = {
  instacart: {
    provider: 'instacart',
    apiUptimeScore: 0.97,
    checkoutSuccessRate: 0.94,
    avgResponseMs: 420,
  },
  walmart: {
    provider: 'walmart',
    apiUptimeScore: 0.95,
    checkoutSuccessRate: 0.91,
    avgResponseMs: 310,
  },
  kroger: {
    provider: 'kroger',
    apiUptimeScore: 0.93,
    checkoutSuccessRate: 0.89,
    avgResponseMs: 560,
  },
};

export function computeTrust(cart: CartCanonical): TrustResult {
  const primary = PROVIDER_STATS[cart.provider];
  const ranked = Object.values(PROVIDER_STATS).sort(
    (a, b) => b.apiUptimeScore * b.checkoutSuccessRate - a.apiUptimeScore * a.checkoutSuccessRate,
  );

  const apiReliabilityScore = primary.apiUptimeScore;
  const checkoutSuccessProbability =
    primary.checkoutSuccessRate * cart.coverageScore;

  const trustScore =
    0.4 * apiReliabilityScore +
    0.4 * checkoutSuccessProbability +
    0.2 * (cart.coverageScore);

  return {
    trustScore: Math.round(trustScore * 100) / 100,
    apiReliabilityScore,
    storeTrustRanking: ranked,
    checkoutSuccessProbability: Math.round(checkoutSuccessProbability * 100) / 100,
  };
}
