import { ProductCanonical, StoreProvider } from '@/lib/core/canonicalModels';

export interface ConfidenceScore {
  productId: string;
  score: number;          // 0–1
  signals: string[];
  shouldFallback: boolean;
}

const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Computes a confidence score for each product's inventory truth.
 * Multiple signals contribute: in-stock flag, price reasonableness,
 * provider reliability, recency of the check, and match quality.
 */
export function scoreProductConfidence(
  product: ProductCanonical,
  checkedAt: string,
  providerReliability: Record<StoreProvider, number> = {
    instacart: 0.92,
    kroger: 0.85,
    walmart: 0.88,
  },
): ConfidenceScore {
  const signals: string[] = [];
  let score = 0;

  // Signal 1: in-stock flag (40% weight)
  if (product.inStock) {
    score += 0.4;
    signals.push('in_stock:true');
  } else {
    signals.push('in_stock:false');
  }

  // Signal 2: provider reliability (25% weight)
  const reliability = providerReliability[product.provider] ?? 0.7;
  score += 0.25 * reliability;
  signals.push(`provider_reliability:${reliability.toFixed(2)}`);

  // Signal 3: match quality (20% weight)
  const matchQ = product.matchScore ?? 0;
  score += 0.2 * matchQ;
  signals.push(`match_quality:${matchQ.toFixed(2)}`);

  // Signal 4: data freshness (15% weight) — decays over 24h
  const ageMs = Date.now() - new Date(checkedAt).getTime();
  const freshnessScore = Math.max(0, 1 - ageMs / (24 * 60 * 60 * 1000));
  score += 0.15 * freshnessScore;
  signals.push(`freshness:${freshnessScore.toFixed(2)}`);

  const finalScore = Math.min(1, Math.max(0, score));

  return {
    productId: product.id,
    score: finalScore,
    signals,
    shouldFallback: finalScore < CONFIDENCE_THRESHOLD,
  };
}

export function scoreInventoryBatch(
  products: ProductCanonical[],
  checkedAt: string,
): ConfidenceScore[] {
  return products.map((p) => scoreProductConfidence(p, checkedAt));
}

/**
 * Filters products by confidence threshold.
 * Returns { trusted, lowConfidence } partition.
 */
export function partitionByConfidence(
  products: ProductCanonical[],
  checkedAt: string,
): { trusted: ProductCanonical[]; lowConfidence: ProductCanonical[] } {
  const trusted: ProductCanonical[] = [];
  const lowConfidence: ProductCanonical[] = [];

  for (const p of products) {
    const score = scoreProductConfidence(p, checkedAt);
    if (score.shouldFallback) {
      lowConfidence.push(p);
    } else {
      trusted.push(p);
    }
  }

  return { trusted, lowConfidence };
}

/**
 * Returns overall confidence for an ingredient's inventory result.
 * If best available product confidence < threshold, triggers fallback.
 */
export function getIngredientConfidence(
  products: ProductCanonical[],
  checkedAt: string,
): { confidence: number; shouldFallback: boolean } {
  if (!products.length) return { confidence: 0, shouldFallback: true };

  const scores = scoreInventoryBatch(products, checkedAt);
  const best = Math.max(...scores.map((s) => s.score));
  return { confidence: best, shouldFallback: best < CONFIDENCE_THRESHOLD };
}
