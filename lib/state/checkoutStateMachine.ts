export type CheckoutState = 'IDLE' | 'VALIDATING' | 'PROVIDER_HANDOFF' | 'COMPLETE' | 'ERROR';

export type CheckoutEvent =
  | { type: 'BEGIN_CHECKOUT' }
  | { type: 'VALIDATION_PASSED' }
  | { type: 'VALIDATION_FAILED'; reason: string }
  | { type: 'PROVIDER_READY' }
  | { type: 'CHECKOUT_COMPLETE' }
  | { type: 'CHECKOUT_ERROR' }
  | { type: 'RESET' };

export function checkoutTransition(state: CheckoutState, event: CheckoutEvent): CheckoutState {
  switch (event.type) {
    case 'BEGIN_CHECKOUT':      return 'VALIDATING';
    case 'VALIDATION_PASSED':   return 'PROVIDER_HANDOFF';
    case 'VALIDATION_FAILED':   return 'ERROR';
    case 'PROVIDER_READY':      return 'PROVIDER_HANDOFF';
    case 'CHECKOUT_COMPLETE':   return 'COMPLETE';
    case 'CHECKOUT_ERROR':      return 'ERROR';
    case 'RESET':               return 'IDLE';
    default:                    return state;
  }
}
