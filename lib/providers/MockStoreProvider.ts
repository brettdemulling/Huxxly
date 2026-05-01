import { getStoresByZip } from '@/lib/stores/getStoresByZip';
import type { IStoreProvider, StoreEntity } from '@/lib/contracts';

export const MockStoreProvider: IStoreProvider = {
  async getStores(zip: string): Promise<StoreEntity[]> {
    return getStoresByZip(zip) as StoreEntity[];
  },

  async getPricing(_items: string[], _storeId: string): Promise<Record<string, number>> {
    // Mock — returns empty map; real pricing comes from priceMultiplier on the store entity
    return {};
  },
};
