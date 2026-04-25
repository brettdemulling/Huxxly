// ─── In-Memory Job Store ──────────────────────────────────────────────────────
// Used in simulation mode. No DB required.
// Jobs auto-complete after SIM_DELAY_MS with a mock FlowResult.

import { buildMockFlowResult } from './mockFlowResult';

const SIM_DELAY_MS = 2200; // realistic "processing" feel

interface SimJob {
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: number;
}

const store = new Map<string, SimJob>();

export function createSimJob(jobId: string): void {
  store.set(jobId, { status: 'running', createdAt: Date.now() });

  setTimeout(() => {
    const job = store.get(jobId);
    if (!job) return;
    store.set(jobId, {
      ...job,
      status: 'completed',
      result: buildMockFlowResult(),
    });
  }, SIM_DELAY_MS);
}

export function getSimJob(jobId: string): {
  status: string;
  result?: unknown;
  error?: string;
} {
  const job = store.get(jobId);
  if (!job) return { status: 'not_found', error: 'Job not found' };
  return { status: job.status, result: job.result, error: job.error };
}
