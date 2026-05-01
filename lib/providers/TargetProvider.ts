import type { IStoreProvider, StoreEntity } from '@/lib/contracts';

// Stub — integrate Target Circle API when credentials are available.
export const TargetProvider: IStoreProvider = {
  async getStores(_zip: string): Promise<StoreEntity[]> {
    return [];
  },

  async getPricing(_items: string[], _storeId: string): Promise<Record<string, number>> {
    return {};
  },
};
