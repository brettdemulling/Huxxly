import { computeNextBestAction, type ActionContext, type NextBestAction } from '@/lib/ux/nextBestAction';
import { getStatusMessage, getRecommendationLine, type MessageContext } from '@/lib/ux/uxMessaging';
import type { FlowState } from '@/lib/ux/stateMachine';

export type ResponseStatus = 'OK' | 'PARTIAL' | 'DEGRADED' | 'ERROR';

export interface FormattedResponse<T = unknown> {
  status: ResponseStatus;
  recommendation: string;
  output: T;
  primaryAction: NextBestAction['primaryAction'];
  secondaryAction?: NextBestAction['secondaryAction'];
}

export interface FormatOptions {
  state: FlowState;
  actionContext?: ActionContext;
  messageContext?: MessageContext;
  status?: ResponseStatus;
}

export function formatResponse<T>(
  output: T,
  options: FormatOptions,
): FormattedResponse<T> {
  const { state, actionContext = {}, messageContext = {}, status = 'OK' } = options;

  const actions = computeNextBestAction(state, actionContext);
  const recommendation =
    getRecommendationLine(messageContext) || getStatusMessage(state, messageContext);

  return {
    status,
    recommendation,
    output,
    primaryAction: actions.primaryAction,
    secondaryAction: actions.secondaryAction,
  };
}

export function formatError(
  message: string,
  state: FlowState = 'intent_detected',
): FormattedResponse<{ error: string }> {
  return formatResponse(
    { error: message },
    { state, status: 'ERROR' },
  );
}

export function formatPartial<T>(
  output: T,
  state: FlowState,
  ctx: ActionContext & MessageContext = {},
): FormattedResponse<T> {
  return formatResponse(output, {
    state,
    status: 'PARTIAL',
    actionContext: { ...ctx, partialSuccess: true },
    messageContext: { ...ctx, partialSuccess: true },
  });
}
