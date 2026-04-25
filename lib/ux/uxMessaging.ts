// ─── UX Messaging ─────────────────────────────────────────────────────────────
// Single source of truth for all user-facing strings.
// NEVER use: medical language, legal certainty, clinical terms.
// Terminology rules applied globally via applyTerminology().

import type { FlowState } from './stateMachine';

// ─── Terminology replacement map ─────────────────────────────────────────────
const TERM_REPLACEMENTS: Record<string, string> = {
  'safe':                  'aligned',
  'restricted':            'excluded',
  'guaranteed':            'designed to',
  'dietary restrictions':  'preferences',
  'allergy-safe':          'aligned with your preferences',
  'gluten-free certified': 'designed to be gluten-aligned',
  'cart':                  'order',
  'build':                 'prepare',
  'optimize':              'refine',
  'cheap':                 'value',
};

export function applyTerminology(text: string): string {
  let result = text;
  for (const [find, replace] of Object.entries(TERM_REPLACEMENTS)) {
    result = result.replace(new RegExp(`\\b${find}\\b`, 'gi'), replace);
  }
  return result;
}

// ─── State-aware status line ──────────────────────────────────────────────────

export interface MessageContext {
  hasDietaryConstraints?: boolean;
  failoverApplied?: boolean;
  liteMode?: boolean;
  partialSuccess?: boolean;
}

export function getStatusMessage(state: FlowState, ctx: MessageContext = {}): string {
  if (state === 'checkout_ready' || state === 'cart_review') {
    if (ctx.hasDietaryConstraints) return 'Aligned with your preferences.';
    if (ctx.failoverApplied) return 'Adjusted based on availability and preferences.';
    if (ctx.liteMode) return 'Quick checkout mode enabled.';
    return 'Your order is ready.';
  }

  if (state === 'order_complete') return "You're all set.";
  if (state === 'cart_optimized') return 'Prepared based on your preferences.';
  if (state === 'cart_building') return 'Preparing your order';
  if (state === 'intent_detected') return 'Understanding your request';
  return 'Preparing your order';
}

export function getRecommendationLine(ctx: MessageContext): string {
  if (ctx.partialSuccess) return 'Refine your order';
  if (ctx.failoverApplied) return 'Adjusted for availability.';
  if (ctx.hasDietaryConstraints) return 'Aligned with your preferences.';
  return '';
}
