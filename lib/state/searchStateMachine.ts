export type SearchState = 'IDLE' | 'INPUT' | 'LOADING' | 'SUCCESS' | 'EMPTY' | 'ERROR';

export type SearchEvent =
  | { type: 'USER_TYPED' }
  | { type: 'SEARCH_SUBMITTED' }
  | { type: 'SEARCH_SUCCESS'; count: number }
  | { type: 'SEARCH_ERROR' }
  | { type: 'RESET' };

export function transition(state: SearchState, event: SearchEvent): SearchState {
  switch (event.type) {
    case 'USER_TYPED':
      return state === 'IDLE' ? 'INPUT' : state;
    case 'SEARCH_SUBMITTED':
      return 'LOADING';
    case 'SEARCH_SUCCESS':
      return event.count > 0 ? 'SUCCESS' : 'EMPTY';
    case 'SEARCH_ERROR':
      return 'ERROR';
    case 'RESET':
      return 'IDLE';
    default:
      return state;
  }
}
