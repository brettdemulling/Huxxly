export type MobileFlowStep = 'input' | 'cart' | 'checkout';

export const MOBILE_FLOW_STEPS: MobileFlowStep[] = ['input', 'cart', 'checkout'];

export interface MobileFlowState {
  step: MobileFlowStep;
  jobId?: string;
  canUndo: boolean;
  undoToken?: string;
}

export function nextStep(current: MobileFlowStep): MobileFlowStep {
  const idx = MOBILE_FLOW_STEPS.indexOf(current);
  return MOBILE_FLOW_STEPS[Math.min(idx + 1, MOBILE_FLOW_STEPS.length - 1)];
}

export const MAX_MOBILE_WIDTH = 480;
