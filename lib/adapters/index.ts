import { StoreAdapter } from './types';
import { InstacartAdapter } from './instacartAdapter';
import { WalmartAdapter } from './walmartAdapter';
import { KrogerAdapter } from './krogerAdapter';
import { StoreProvider } from '@/lib/core/canonicalModels';

const adapters: Record<StoreProvider, StoreAdapter> = {
  instacart: new InstacartAdapter(),
  walmart: new WalmartAdapter(),
  kroger: new KrogerAdapter(),
};

export function getAdapter(provider: StoreProvider): StoreAdapter {
  return adapters[provider];
}

// Priority order for failover
export const PROVIDER_PRIORITY: StoreProvider[] = ['instacart', 'kroger', 'walmart'];

export { InstacartAdapter, WalmartAdapter, KrogerAdapter };
