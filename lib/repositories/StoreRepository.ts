import { getStoresByZip, getStoreById, BASELINE_STORE } from '@/lib/stores/getStoresByZip';
import type { IStoreRepository, StoreEntity } from '@/lib/contracts';

export const StoreRepository: IStoreRepository = {
  async findByZip(zip: string): Promise<StoreEntity[]> {
    if (!zip || !/^\d{5}$/.test(zip)) return [BASELINE_STORE];
    return getStoresByZip(zip) as StoreEntity[];
  },

  async findById(id: string): Promise<StoreEntity | null> {
    return (getStoreById(id) as StoreEntity | undefined) ?? null;
  },
};
