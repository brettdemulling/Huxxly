import { EmbeddingAdapter } from './embeddingAdapter';
import type { RecipeEntity, RecipeSearchResult } from '@/lib/contracts';

export interface SemanticSearchOptions {
  topK?: number;
  minSimilarity?: number;
}

// Passthrough — returns candidates unchanged until embeddings are wired up.
// Future: embed query + recipe corpus, rank by cosine similarity.
export async function semanticSearch(
  query: string,
  candidates: RecipeEntity[],
  opts: SemanticSearchOptions = {},
): Promise<RecipeEntity[]> {
  const { topK = 20 } = opts;
  const queryEmbedding = await EmbeddingAdapter.embed(query);

  if (queryEmbedding.length === 0) {
    // Embeddings not yet active — return candidates unchanged
    return candidates.slice(0, topK);
  }

  // Future ranking by vector similarity
  return candidates.slice(0, topK);
}

// Exported for future use by the search domain
export type { RecipeSearchResult };
