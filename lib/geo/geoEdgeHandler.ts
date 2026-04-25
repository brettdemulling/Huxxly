import { StoreInfo } from '@/lib/core/canonicalModels';

export type GeoEdgeCase =
  | 'rural_zip'
  | 'no_coverage'
  | 'invalid_zip'
  | 'overlapping_regions'
  | 'partial_coverage';

export interface GeoResolution {
  originalZip: string;
  resolvedZip: string;
  edgeCaseDetected: GeoEdgeCase | null;
  fallbackApplied: boolean;
  viableStores: StoreInfo[];
  message: string;
}

// Known metro ZIPs to use as regional fallbacks (one per major region)
const REGIONAL_FALLBACKS: Record<string, string> = {
  // Southeast
  '370': '37067', // Nashville metro
  '350': '35203', // Birmingham
  '303': '30301', // Atlanta
  // Midwest
  '600': '60601', // Chicago
  '441': '44101', // Cleveland
  // Northeast
  '100': '10001', // NYC
  '021': '02101', // Boston
  // West
  '900': '90001', // LA
  '941': '94101', // SF
  // Plains/Rural
  default: '66101', // Kansas City (central fallback)
};

const MIN_VIABLE_STORES = 1;
const MIN_COVERAGE_SCORE = 0.3;

function detectEdgeCase(zip: string, stores: StoreInfo[]): GeoEdgeCase | null {
  if (!/^\d{5}$/.test(zip)) return 'invalid_zip';
  if (!stores.length) return 'no_coverage';
  if (stores.every((s) => s.compositeScore < MIN_COVERAGE_SCORE)) return 'rural_zip';

  // Detect overlapping delivery/pickup regions (multiple stores at same distance)
  const distanceBuckets = stores.map((s) => Math.round(s.distanceMiles));
  const hasDuplicateDistances = new Set(distanceBuckets).size < distanceBuckets.length;
  if (hasDuplicateDistances && stores.length > 2) return 'overlapping_regions';

  const viableCount = stores.filter((s) => s.compositeScore >= MIN_COVERAGE_SCORE).length;
  if (viableCount > 0 && viableCount < stores.length) return 'partial_coverage';

  return null;
}

function findRegionalFallbackZip(zip: string): string {
  const prefix3 = zip.slice(0, 3);
  const prefix2 = zip.slice(0, 2);
  return (
    REGIONAL_FALLBACKS[prefix3] ??
    REGIONAL_FALLBACKS[prefix2] ??
    REGIONAL_FALLBACKS.default
  );
}

function correctInvalidZip(zip: string): string {
  const digits = zip.replace(/\D/g, '');
  if (digits.length >= 5) return digits.slice(0, 5);
  return digits.padEnd(5, '0');
}

/**
 * Resolves geo edge cases and returns a viable store list.
 * Applies fallback logic in this order:
 * 1. Fix invalid ZIP format
 * 2. If no stores found, fall back to nearest metro ZIP
 * 3. Filter out low-confidence stores
 * 4. Resolve overlapping regions by deduplication
 */
export async function resolveGeoEdgeCases(
  zip: string,
  stores: StoreInfo[],
): Promise<GeoResolution> {
  const edgeCase = detectEdgeCase(zip, stores);

  if (!edgeCase) {
    return {
      originalZip: zip,
      resolvedZip: zip,
      edgeCaseDetected: null,
      fallbackApplied: false,
      viableStores: stores,
      message: 'No geo edge cases detected.',
    };
  }

  let resolvedZip = zip;
  let viableStores = stores;
  let message = '';

  switch (edgeCase) {
    case 'invalid_zip': {
      resolvedZip = correctInvalidZip(zip);
      message = `Invalid ZIP corrected to ${resolvedZip}.`;
      break;
    }

    case 'no_coverage':
    case 'rural_zip': {
      resolvedZip = findRegionalFallbackZip(zip);
      // Re-run store lookup for the fallback ZIP
      const { findNearbyStores } = await import('./storeLocator');
      viableStores = await findNearbyStores(resolvedZip);
      message = `No local coverage for ${zip}. Using nearest metro area (${resolvedZip}).`;
      break;
    }

    case 'overlapping_regions': {
      // Deduplicate by keeping highest-score store per distance bucket
      const seen = new Map<number, StoreInfo>();
      for (const store of stores) {
        const bucket = Math.round(store.distanceMiles);
        const existing = seen.get(bucket);
        if (!existing || store.compositeScore > existing.compositeScore) {
          seen.set(bucket, store);
        }
      }
      viableStores = Array.from(seen.values()).sort((a, b) => b.compositeScore - a.compositeScore);
      message = `Overlapping delivery regions resolved — ${viableStores.length} unique stores selected.`;
      break;
    }

    case 'partial_coverage': {
      viableStores = stores.filter((s) => s.compositeScore >= MIN_COVERAGE_SCORE);
      message = `Partial coverage — limiting to ${viableStores.length} stores meeting minimum quality threshold.`;
      break;
    }
  }

  // Final safety net: guarantee at least one viable store
  if (viableStores.length < MIN_VIABLE_STORES) {
    resolvedZip = REGIONAL_FALLBACKS.default;
    const { findNearbyStores } = await import('./storeLocator');
    viableStores = await findNearbyStores(resolvedZip);
    message += ` Emergency fallback to central region (${resolvedZip}).`;
  }

  return {
    originalZip: zip,
    resolvedZip,
    edgeCaseDetected: edgeCase,
    fallbackApplied: resolvedZip !== zip || viableStores !== stores,
    viableStores,
    message,
  };
}
