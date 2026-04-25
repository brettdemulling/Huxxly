// ─── UX State Machine ─────────────────────────────────────────────────────────
// All requests must follow the canonical flow state sequence.
// State is derived from flow data — never stored separately in the DB.

import type { FlowResult } from '@/lib/core/canonicalModels';

export type FlowState =
  | 'intent_detected'
  | 'cart_building'
  | 'cart_optimized'
  | 'cart_review'
  | 'checkout_ready'
  | 'order_complete';

const STATE_ORDER: FlowState[] = [
  'intent_detected',
  'cart_building',
  'cart_optimized',
  'cart_review',
  'checkout_ready',
  'order_complete',
];

// Valid transitions — each state may only move forward
const TRANSITIONS: Record<FlowState, FlowState[]> = {
  intent_detected: ['cart_building'],
  cart_building:   ['cart_optimized', 'cart_review'],
  cart_optimized:  ['cart_review'],
  cart_review:     ['checkout_ready'],
  checkout_ready:  ['order_complete'],
  order_complete:  [],
};

export function canTransition(from: FlowState, to: FlowState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextState(current: FlowState): FlowState {
  const idx = STATE_ORDER.indexOf(current);
  return STATE_ORDER[Math.min(idx + 1, STATE_ORDER.length - 1)];
}

// Derive state from a (possibly partial) flow result
export function detectState(flow: Partial<FlowResult> | null): FlowState {
  if (!flow) return 'intent_detected';
  if (!flow.meals?.length) return 'cart_building';
  if (!flow.primaryCart) return 'cart_building';
  if (!flow.priceBreakdown && !flow.confidenceScore) return 'cart_optimized';
  if (!flow.primaryCart.checkoutUrl) return 'cart_review';
  return 'checkout_ready';
}

export function isTerminal(state: FlowState): boolean {
  return state === 'order_complete';
}

export function stateLabel(state: FlowState): string {
  const labels: Record<FlowState, string> = {
    intent_detected: 'Understanding your request',
    cart_building:   'Preparing your order',
    cart_optimized:  'Refining selections',
    cart_review:     'Ready for review',
    checkout_ready:  'Your order is ready.',
    order_complete:  "You're all set.",
  };
  return labels[state];
}
