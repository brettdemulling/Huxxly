import { Client } from '@upstash/qstash';
import { createJobRecord, emitJobEvent } from './eventQueue';
import { runtime } from '@/lib/config/runtime';

function getQStashClient() {
  return new Client({ token: process.env.QSTASH_TOKEN || '' });
}

export interface FlowJobPayload {
  jobId: string;
  rawInput: string;
  zipCode: string;
  userId: string;
  flowId: string;
}

export async function dispatchFlowJob(
  rawInput: string,
  zipCode: string,
  userId: string,
  flowId: string,
): Promise<string> {
  const jobId = await createJobRecord('autopilot_flow', userId, {
    rawInput,
    zipCode,
    userId,
    flowId,
  });

  await emitJobEvent(jobId, 'INTENT_RECEIVED', userId, { rawInput, zipCode, flowId });

  const payload: FlowJobPayload = { jobId, rawInput, zipCode, userId, flowId };
  if (!runtime.isQStashEnabled) {
    console.warn('[upstashQueue] Skipping QStash dispatch: QSTASH_TOKEN or NEXT_PUBLIC_APP_URL not set.');
    return jobId;
  }

  const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/worker/flow`;

  await getQStashClient().publishJSON({
    url: workerUrl,
    body: payload,
    retries: 2,
    headers: {
      'x-job-id': jobId,
    },
  });

  return jobId;
}
