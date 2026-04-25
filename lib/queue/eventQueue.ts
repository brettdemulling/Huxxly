import { prisma } from '@/lib/db';

export type JobEventType =
  | 'INTENT_RECEIVED'
  | 'JOB_QUEUED'
  | 'JOB_STARTED'
  | 'JOB_COMPLETED'
  | 'JOB_FAILED';

export interface JobEvent {
  jobId: string;
  type: JobEventType;
  userId: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
}

export async function emitJobEvent(
  jobId: string,
  type: JobEventType,
  userId: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  await prisma.event.create({
    data: {
      type: `job.${type.toLowerCase()}`,
      userId,
      payload: { jobId, ...(payload ?? {}) } as object,
    },
  });
}

export async function createJobRecord(
  flowType: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const job = await prisma.job.create({
    data: {
      type: flowType,
      status: 'pending',
      payload: payload as object,
    },
  });
  await emitJobEvent(job.id, 'JOB_QUEUED', userId, { flowType, ...payload });
  return job.id;
}

export async function markJobStarted(jobId: string, userId: string): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'running', attempts: { increment: 1 } },
  });
  await emitJobEvent(jobId, 'JOB_STARTED', userId);
}

export async function markJobCompleted(
  jobId: string,
  userId: string,
  result: Record<string, unknown>,
): Promise<void> {
  await prisma.job.update({
    where: { id: jobId },
    data: { status: 'completed', payload: result as object },
  });
  await emitJobEvent(jobId, 'JOB_COMPLETED', userId, { result });
}

export async function markJobFailed(
  jobId: string,
  userId: string,
  error: string,
  attempt: number,
  maxAttempts: number,
): Promise<void> {
  const willRetry = attempt < maxAttempts;
  const backoffMs = Math.pow(2, attempt) * 30_000;
  const runAt = willRetry ? new Date(Date.now() + backoffMs) : undefined;

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: willRetry ? 'pending' : 'failed',
      lastError: error,
      ...(runAt ? { runAt } : {}),
    },
  });
  await emitJobEvent(jobId, 'JOB_FAILED', userId, { error, willRetry, attempt });
}

export async function getJobResult(
  jobId: string,
): Promise<{ status: string; result?: Record<string, unknown>; error?: string }> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { status: 'not_found' };

  if (job.status === 'completed') {
    return { status: 'completed', result: job.payload as Record<string, unknown> };
  }
  if (job.status === 'failed') {
    return { status: 'failed', error: job.lastError ?? 'unknown error' };
  }
  return { status: job.status };
}
