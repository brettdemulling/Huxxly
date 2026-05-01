export type CartState = 'IDLE' | 'LOADING' | 'READY' | 'STORE_SWITCHING' | 'CHECKOUT' | 'ERROR';

export type CartEvent =
  | { type: 'GENERATE_CART' }
  | { type: 'CART_LOADED'; itemCount: number }
  | { type: 'SWITCH_STORE' }
  | { type: 'STORE_SWITCHED' }
  | { type: 'BEGIN_CHECKOUT' }
  | { type: 'CART_ERROR' }
  | { type: 'RESET' };

export function cartTransition(state: CartState, event: CartEvent): CartState {
  switch (event.type) {
    case 'GENERATE_CART':   return 'LOADING';
    case 'CART_LOADED':     return event.itemCount > 0 ? 'READY' : 'IDLE';
    case 'SWITCH_STORE':    return state === 'READY' ? 'STORE_SWITCHING' : state;
    case 'STORE_SWITCHED':  return 'READY';
    case 'BEGIN_CHECKOUT':  return state === 'READY' ? 'CHECKOUT' : state;
    case 'CART_ERROR':      return 'ERROR';
    case 'RESET':           return 'IDLE';
    default:                return state;
  }
}
