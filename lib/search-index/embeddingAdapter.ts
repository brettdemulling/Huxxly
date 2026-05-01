// Embedding adapter — interface is stable; swap the implementation for OpenAI, Cohere, or local models.

export interface IEmbeddingAdapter {
  embed(text: string): Promise<number[]>;
  similarity(a: number[], b: number[]): number;
}

// No-op passthrough — future: integrate vector embeddings for semantic search
export const EmbeddingAdapter: IEmbeddingAdapter = {
  async embed(_text: string): Promise<number[]> {
    return [];
  },

  similarity(_a: number[], _b: number[]): number {
    return 0;
  },
};
