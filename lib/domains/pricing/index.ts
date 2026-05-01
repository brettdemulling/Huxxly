// All price math lives here. No other module may compute costs.

export interface PriceStore {
  priceMultiplier: number;
}

export interface PricedItem {
  name: string;
  basePrice: number;
  adjustedCost: number;
}

export function applyPricing(
  items: { name: string; price: number }[],
  store: PriceStore,
): PricedItem[] {
  return items.map((item) => ({
    name: item.name,
    basePrice: item.price,
    adjustedCost: parseFloat((item.price * store.priceMultiplier).toFixed(2)),
  }));
}

export function servingAdjustedPrice(
  price: number,
  baseServings: number,
  targetServings: number,
): number {
  if (baseServings === targetServings) return price;
  return parseFloat(((price / baseServings) * targetServings).toFixed(2));
}

export function sumTotal(items: { adjustedCost: number }[]): number {
  return parseFloat(items.reduce((sum, i) => sum + i.adjustedCost, 0).toFixed(2));
}
