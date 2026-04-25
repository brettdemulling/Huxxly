import * as cache from '@/lib/cache/cacheGateway';
import { StoreInfo, StoreProvider } from '@/lib/core/canonicalModels';

interface ZipCoords {
  lat: number;
  lon: number;
  city: string;
  state: string;
}

async function resolveZip(zip: string): Promise<ZipCoords> {
  const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
  if (!res.ok) throw new Error(`Could not resolve ZIP ${zip}`);
  const data = await res.json();
  return {
    lat: parseFloat(data.places[0]['latitude']),
    lon: parseFloat(data.places[0]['longitude']),
    city: data.places[0]['place name'],
    state: data.places[0]['state abbreviation'],
  };
}

function computeCompositeScore(
  distanceMiles: number,
  availabilityConfidence: number,
  deliveryCoverageScore: number,
  priceEfficiency: number,
): number {
  const proximityScore = Math.max(0, 1 - distanceMiles / 20);
  return (
    0.4 * proximityScore +
    0.3 * availabilityConfidence +
    0.2 * deliveryCoverageScore +
    0.1 * priceEfficiency
  );
}

function buildMockStores(zip: string, coords: ZipCoords): StoreInfo[] {
  const stores: StoreInfo[] = [
    {
      id: `instacart-${zip}-001`,
      name: 'Kroger (via Instacart)',
      provider: 'instacart' as StoreProvider,
      address: `123 Main St, ${coords.city}, ${coords.state} ${zip}`,
      zipCode: zip,
      distanceMiles: 1.2,
      availabilityConfidence: 0.92,
      deliveryCoverageScore: 0.95,
      pickupAvailable: true,
      deliveryAvailable: true,
      compositeScore: 0,
    },
    {
      id: `walmart-${zip}-001`,
      name: 'Walmart Supercenter',
      provider: 'walmart' as StoreProvider,
      address: `456 Commerce Blvd, ${coords.city}, ${coords.state} ${zip}`,
      zipCode: zip,
      distanceMiles: 3.5,
      availabilityConfidence: 0.88,
      deliveryCoverageScore: 0.82,
      pickupAvailable: true,
      deliveryAvailable: true,
      compositeScore: 0,
    },
    {
      id: `kroger-${zip}-001`,
      name: 'Kroger',
      provider: 'kroger' as StoreProvider,
      address: `789 Grocery Ln, ${coords.city}, ${coords.state} ${zip}`,
      zipCode: zip,
      distanceMiles: 2.1,
      availabilityConfidence: 0.85,
      deliveryCoverageScore: 0.88,
      pickupAvailable: true,
      deliveryAvailable: true,
      compositeScore: 0,
    },
  ];

  return stores
    .map((s) => ({
      ...s,
      compositeScore: computeCompositeScore(
        s.distanceMiles,
        s.availabilityConfidence,
        s.deliveryCoverageScore,
        0.8,
      ),
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore);
}

export async function findNearbyStores(zip: string): Promise<StoreInfo[]> {
  const cached = await cache.getStoreLookup(zip);
  if (cached) {
    return JSON.parse(cached as string) as StoreInfo[];
  }

  let coords: ZipCoords;
  try {
    coords = await resolveZip(zip);
  } catch {
    coords = { lat: 36.0, lon: -86.7, city: 'Nashville', state: 'TN' };
  }

  const stores = buildMockStores(zip, coords);
  await cache.setStoreLookup(zip, stores);
  return stores;
}

export async function getBestStore(zip: string): Promise<StoreInfo> {
  const stores = await findNearbyStores(zip);
  return stores[0];
}
