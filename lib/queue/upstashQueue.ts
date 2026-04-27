import { Client } from '@upstash/qstash';
import { createJobRecord, emitJobEvent } from './eventQueue';

function getQStashClient() {
  const token = process.env.QSTASH_TOKEN || '';
  if (!token) console.warn('[upstashQueue] QStash disabled: QSTASH_TOKEN not set.');
  return new Client({ token });
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
  const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/worker/flow`;

  if (!process.env.QSTASH_TOKEN || !process.env.NEXT_PUBLIC_APP_URL) {
    console.warn('[upstashQueue] Skipping QStash dispatch: missing QSTASH_TOKEN or NEXT_PUBLIC_APP_URL.');
    return jobId;
  }

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
