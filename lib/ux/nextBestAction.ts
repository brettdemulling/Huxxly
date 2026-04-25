// ─── Next Best Action Engine ──────────────────────────────────────────────────
// Every response includes exactly ONE primary action.
// Secondary and explore are optional.
// Actions are derived from state — never hardcoded per screen.

import type { FlowState } from './stateMachine';

export interface ActionItem {
  label: string;
  description?: string;
  route?: string;
  handler?: string; // client-side handler key for programmatic dispatch
}

export interface NextBestAction {
  primaryAction: ActionItem;
  secondaryAction?: ActionItem;
  exploreOption?: ActionItem;
}

export interface ActionContext {
  hasDietaryConstraints?: boolean;
  failoverApplied?: boolean;
  partialSuccess?: boolean;
  hasSubstitutions?: boolean;
  totalFormatted?: string;
}

export function computeNextBestAction(
  state: FlowState,
  context: ActionContext = {},
): NextBestAction {
  switch (state) {
    case 'intent_detected':
      return {
        primaryAction: { label: 'Continue', handler: 'submit_intent' },
      };

    case 'cart_building':
      return {
        primaryAction: { label: 'Preparing your order', handler: 'poll_status', description: 'Please wait' },
      };

    case 'cart_optimized':
      return {
        primaryAction: { label: 'Continue', route: '/meals', description: 'View your meal plan' },
        exploreOption: context.hasDietaryConstraints
          ? { label: 'Review preferences', handler: 'open_dietary' }
          : undefined,
      };

    case 'cart_review':
      return {
        primaryAction: {
          label: context.totalFormatted ? `Continue — ${context.totalFormatted}` : 'Continue',
          handler: 'initiate_checkout',
        },
        secondaryAction: context.failoverApplied
          ? { label: 'Adjusted for availability.', handler: 'view_fallback_info' }
          : undefined,
        exploreOption: context.hasSubstitutions
          ? { label: 'View substitutions', handler: 'open_substitutions' }
          : undefined,
      };

    case 'checkout_ready':
      return {
        primaryAction: { label: 'Continue', handler: 'open_checkout_url' },
        secondaryAction: context.partialSuccess
          ? { label: 'Refine your order', handler: 'go_back' }
          : undefined,
      };

    case 'order_complete':
      return {
        primaryAction: { label: 'Start a new order', route: '/' },
      };
  }
}
