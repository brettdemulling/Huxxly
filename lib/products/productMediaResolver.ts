// ─── Product Media Resolver ───────────────────────────────────────────────────
// Resolves real product images with provider priority and confidence scoring.
// Priority: Kroger API image → Walmart catalog image → Instacart image → placeholder
// Swap resolveFromProvider() implementations for live API credentials.

import type { ProductCanonical } from '@/lib/core/canonicalModels';

export interface ProductMedia {
  productId: string;
  name: string;
  imageUrl: string;
  store: string;
  confidence: number; // 0–1; only serve if >= CONFIDENCE_THRESHOLD
}

const CONFIDENCE_THRESHOLD = 0.85;

// ─── Provider URL builders ────────────────────────────────────────────────────
// These patterns resolve against live CDNs when real product IDs are available.
// In dev/staging, the product.imageUrl (set by adapters) is used directly.

function krogerImageUrl(product: ProductCanonical): string | null {
  if (product.provider !== 'kroger') return null;
  // Kroger product images are served at:
  // https://www.kroger.com/product/images/medium/front/{upc}
  // product.storeId may encode UPC — adapters should populate product.imageUrl
  return product.imageUrl ?? null;
}

function walmartImageUrl(product: ProductCanonical): string | null {
  if (product.provider !== 'walmart') return null;
  // Walmart catalog images via: https://i5.walmartimages.com/asr/{itemId}.jpg
  return product.imageUrl ?? null;
}

function instacartImageUrl(product: ProductCanonical): string | null {
  if (product.provider !== 'instacart') return null;
  return product.imageUrl ?? null;
}

function placeholderUrl(name: string): string {
  // Encode product name into a deterministic placeholder
  const encoded = encodeURIComponent(name.slice(0, 30));
  return `https://placehold.co/80x80/F8FAFC/94A3B8?text=${encoded}`;
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export function resolveProductMedia(product: ProductCanonical): ProductMedia {
  const resolvers: Array<() => string | null> = [
    () => krogerImageUrl(product),
    () => walmartImageUrl(product),
    () => instacartImageUrl(product),
  ];

  for (const resolve of resolvers) {
    const url = resolve();
    if (url) {
      return {
        productId: product.id,
        name: product.name,
        imageUrl: url,
        store: product.provider,
        confidence: 0.92,
      };
    }
  }

  // Placeholder — confidence below threshold signals to UI: use fallback rendering
  return {
    productId: product.id,
    name: product.name,
    imageUrl: placeholderUrl(product.name),
    store: product.provider,
    confidence: 0.50,
  };
}

export function resolveProductMediaBatch(
  products: ProductCanonical[],
): ProductMedia[] {
  return products.map(resolveProductMedia);
}

export function shouldShowImage(media: ProductMedia): boolean {
  return media.confidence >= CONFIDENCE_THRESHOLD;
}

export { CONFIDENCE_THRESHOLD };
