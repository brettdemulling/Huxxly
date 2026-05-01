import type { ISearchAnalyticsRepository } from '@/lib/contracts';

// Stub — future: persist search events to an analytics table or streaming pipeline.
export const SearchAnalyticsRepository: ISearchAnalyticsRepository = {
  async record(_entry: { query: string; resultCount: number; fallbackUsed: boolean }): Promise<void> {
    // no-op until analytics table is created
  },
};
