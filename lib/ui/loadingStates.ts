export type LoadingStep =
  | 'analyzing_request'
  | 'building_cart'
  | 'pricing_items'
  | 'selecting_store'
  | 'validating_inventory'
  | 'securing_checkout'
  | 'complete'
  | 'error';

export const LOADING_STEP_LABELS: Record<LoadingStep, string> = {
  analyzing_request: 'Analyzing your request...',
  building_cart: 'Building your cart...',
  pricing_items: 'Pricing items across stores...',
  selecting_store: 'Selecting best store...',
  validating_inventory: 'Validating inventory...',
  securing_checkout: 'Securing checkout...',
  complete: 'Done',
  error: 'Something went wrong',
};

export const LOADING_STEP_ORDER: LoadingStep[] = [
  'analyzing_request',
  'building_cart',
  'pricing_items',
  'selecting_store',
  'validating_inventory',
  'securing_checkout',
];

export function getStepProgress(step: LoadingStep): number {
  const idx = LOADING_STEP_ORDER.indexOf(step);
  if (idx === -1) return step === 'complete' ? 100 : 0;
  return Math.round(((idx + 1) / LOADING_STEP_ORDER.length) * 100);
}
