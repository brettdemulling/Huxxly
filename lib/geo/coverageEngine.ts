import { StoreInfo } from '@/lib/core/canonicalModels';

export interface CoverageResult {
  storeId: string;
  distanceMiles: number;
  availabilityConfidence: number;
  deliveryCoverageScore: number;
  pickupAvailable: boolean;
  compositeScore: number;
  tier: 'excellent' | 'good' | 'fair' | 'poor';
}

export function evaluateCoverage(store: StoreInfo): CoverageResult {
  const tier =
    store.compositeScore >= 0.8
      ? 'excellent'
      : store.compositeScore >= 0.6
        ? 'good'
        : store.compositeScore >= 0.4
          ? 'fair'
          : 'poor';

  return {
    storeId: store.id,
    distanceMiles: store.distanceMiles,
    availabilityConfidence: store.availabilityConfidence,
    deliveryCoverageScore: store.deliveryCoverageScore,
    pickupAvailable: store.pickupAvailable,
    compositeScore: store.compositeScore,
    tier,
  };
}

export function rankStoresByZipCoverage(stores: StoreInfo[], zip: string): StoreInfo[] {
  return [...stores].sort((a, b) => {
    // Prefer stores that match the ZIP exactly
    const aZipMatch = a.zipCode === zip ? 0.05 : 0;
    const bZipMatch = b.zipCode === zip ? 0.05 : 0;
    return b.compositeScore + bZipMatch - (a.compositeScore + aZipMatch);
  });
}

export function filterByMinCoverage(stores: StoreInfo[], minScore = 0.4): StoreInfo[] {
  return stores.filter((s) => s.compositeScore >= minScore);
}
