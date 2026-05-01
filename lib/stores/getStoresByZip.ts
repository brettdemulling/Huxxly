// ─── Store types ──────────────────────────────────────────────────────────────

export type StoreType = 'walmart' | 'kroger' | 'target' | 'local';

export interface GroceryStore {
  id: string;
  name: string;
  type: StoreType;
  address: string;
  priceMultiplier: number;
}

// ─── Mock store dataset keyed by ZIP prefix ───────────────────────────────────
// priceMultiplier: 1.0 = baseline (Walmart), higher = premium

const STORE_CATALOG: Record<string, GroceryStore[]> = {
  // Tennessee — 37xxx (Franklin / Nashville area)
  '37': [
    { id: 'wmt-tn-1', name: 'Walmart Supercenter', type: 'walmart', address: '1000 Murfreesboro Rd, Franklin, TN 37067', priceMultiplier: 1.0 },
    { id: 'krg-tn-1', name: 'Kroger', type: 'kroger', address: '4016 Hillsboro Pike, Nashville, TN 37215', priceMultiplier: 1.08 },
    { id: 'tgt-tn-1', name: 'Target', type: 'target', address: '2000 Mallory Ln, Franklin, TN 37067', priceMultiplier: 1.12 },
    { id: 'loc-tn-1', name: 'The Fresh Market', type: 'local', address: '5000 Maryland Way, Brentwood, TN 37027', priceMultiplier: 1.25 },
  ],
  // New York — 10xxx
  '10': [
    { id: 'wmt-ny-1', name: 'Walmart', type: 'walmart', address: '40-75 Junction Blvd, Queens, NY 10001', priceMultiplier: 1.05 },
    { id: 'krg-ny-1', name: 'Whole Foods Market', type: 'local', address: '270 Greenwich St, New York, NY 10007', priceMultiplier: 1.45 },
    { id: 'tgt-ny-1', name: 'Target', type: 'target', address: '112 W 34th St, New York, NY 10120', priceMultiplier: 1.18 },
    { id: 'loc-ny-1', name: 'Trader Joe\'s', type: 'local', address: '142 E 14th St, New York, NY 10003', priceMultiplier: 1.15 },
  ],
  // California — 90xxx (Los Angeles area)
  '90': [
    { id: 'wmt-ca-1', name: 'Walmart Supercenter', type: 'walmart', address: '3550 S La Cienega Blvd, Los Angeles, CA 90016', priceMultiplier: 1.02 },
    { id: 'krg-ca-1', name: 'Ralph\'s (Kroger)', type: 'kroger', address: '757 N La Brea Ave, Hollywood, CA 90038', priceMultiplier: 1.10 },
    { id: 'tgt-ca-1', name: 'Target', type: 'target', address: '7100 Santa Monica Blvd, West Hollywood, CA 90046', priceMultiplier: 1.14 },
    { id: 'loc-ca-1', name: 'Erewhon Market', type: 'local', address: '7660 Beverly Blvd, Los Angeles, CA 90036', priceMultiplier: 1.55 },
  ],
  // Texas — 78xxx (Austin area)
  '78': [
    { id: 'wmt-tx-1', name: 'Walmart Supercenter', type: 'walmart', address: '9300 N Lamar Blvd, Austin, TX 78753', priceMultiplier: 1.0 },
    { id: 'krg-tx-1', name: 'H-E-B', type: 'kroger', address: '6900 Woodrow Ave, Austin, TX 78757', priceMultiplier: 1.06 },
    { id: 'tgt-tx-1', name: 'Target', type: 'target', address: '2901 Capital of TX Hwy, Austin, TX 78746', priceMultiplier: 1.12 },
    { id: 'loc-tx-1', name: 'Whole Foods Market', type: 'local', address: '525 N Lamar Blvd, Austin, TX 78703', priceMultiplier: 1.38 },
  ],
  // Illinois — 60xxx (Chicago area)
  '60': [
    { id: 'wmt-il-1', name: 'Walmart', type: 'walmart', address: '4650 W North Ave, Chicago, IL 60639', priceMultiplier: 1.0 },
    { id: 'krg-il-1', name: 'Mariano\'s (Kroger)', type: 'kroger', address: '2021 W Chicago Ave, Chicago, IL 60622', priceMultiplier: 1.10 },
    { id: 'tgt-il-1', name: 'Target', type: 'target', address: '2656 N Elston Ave, Chicago, IL 60647', priceMultiplier: 1.13 },
    { id: 'loc-il-1', name: 'Jewel-Osco', type: 'local', address: '1224 S Wabash Ave, Chicago, IL 60605', priceMultiplier: 1.09 },
  ],
};

// Baseline stores used when no ZIP-specific data exists
const DEFAULT_STORES: GroceryStore[] = [
  { id: 'wmt-default', name: 'Walmart', type: 'walmart', address: 'Nearby Walmart Supercenter', priceMultiplier: 1.0 },
  { id: 'krg-default', name: 'Kroger', type: 'kroger', address: 'Nearby Kroger', priceMultiplier: 1.08 },
  { id: 'tgt-default', name: 'Target', type: 'target', address: 'Nearby Target', priceMultiplier: 1.12 },
  { id: 'loc-default', name: 'Local Grocery', type: 'local', address: 'Local Grocery Store', priceMultiplier: 1.18 },
];

// ─── Public helpers ───────────────────────────────────────────────────────────

export function getStoresByZip(zipCode: string): GroceryStore[] {
  const prefix = zipCode.slice(0, 2);
  return STORE_CATALOG[prefix] ?? DEFAULT_STORES;
}

export function getStoreById(storeId: string, zipCode?: string): GroceryStore | undefined {
  const stores = zipCode ? getStoresByZip(zipCode) : DEFAULT_STORES;
  return stores.find((s) => s.id === storeId);
}

export const BASELINE_STORE: GroceryStore = DEFAULT_STORES[0];
