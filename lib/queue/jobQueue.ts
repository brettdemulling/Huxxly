import { prisma } from '@/lib/db';
import { normalizeError } from '@/lib/errors/errorHandler';

export type JobType =
  | 'meal_generation'
  | 'product_matching'
  | 'inventory_validation'
  | 'cart_build'
  | 'checkout_generation';

export type JobStatus = 'pending' | 'running' | 'complete' | 'failed' | 'dead';

export interface JobPayload {
  userId: string;
  intentId?: string;
  zipCode?: string;
  data?: Record<string, unknown>;
}

export interface EnqueuedJob {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: JobPayload;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
}

type JobJson = Parameters<typeof prisma.job.create>[0]['data']['payload'];

export async function enqueue(
  type: JobType,
  payload: JobPayload,
  options: { maxAttempts?: number; delayMs?: number } = {},
): Promise<EnqueuedJob> {
  const runAt = new Date(Date.now() + (options.delayMs ?? 0));
  const row = await prisma.job.create({
    data: {
      type,
      status: 'pending',
      payload: payload as unknown as JobJson,
      maxAttempts: options.maxAttempts ?? 3,
      runAt,
    },
  });

  return {
    id: row.id,
    type: row.type as JobType,
    status: row.status as JobStatus,
    payload: row.payload as unknown as JobPayload,
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    runAt: row.runAt,
  };
}

export async function claimNextJob(type?: JobType): Promise<EnqueuedJob | null> {
  const where = {
    status: 'pending' as const,
    runAt: { lte: new Date() },
    ...(type ? { type } : {}),
  };

  const row = await prisma.job.findFirst({ where, orderBy: { runAt: 'asc' } });
  if (!row) return null;

  await prisma.job.update({
    where: { id: row.id },
    data: { status: 'running', attempts: { increment: 1 } },
  });

  return {
    id: row.id,
    type: row.type as JobType,
    status: 'running',
    payload: row.payload as unknown as JobPayload,
    attempts: row.attempts + 1,
    maxAttempts: row.maxAttempts,
    runAt: row.runAt,
  };
}

export async function completeJob(id: string): Promise<void> {
  await prisma.job.update({ where: { id }, data: { status: 'complete' } });
}

export async function failJob(id: string, error: unknown): Promise<void> {
  const row = await prisma.job.findUnique({ where: { id } });
  if (!row) return;

  const normalized = normalizeError(error);
  const isDead = row.attempts >= row.maxAttempts;

  await prisma.job.update({
    where: { id },
    data: {
      status: isDead ? 'dead' : 'pending',
      lastError: normalized.message,
      // Exponential backoff: next attempt in 2^attempt * 30 seconds
      runAt: isDead ? undefined : new Date(Date.now() + Math.pow(2, row.attempts) * 30_000),
    },
  });
}

/**
 * Run a job function with automatic retry/failure handling.
 * Each job type runs in isolation — no shared state between steps.
 */
export async function runJob<T>(
  job: EnqueuedJob,
  fn: (payload: JobPayload) => Promise<T>,
): Promise<T> {
  try {
    const result = await fn(job.payload);
    await completeJob(job.id);
    return result;
  } catch (err) {
    await failJob(job.id, err);
    throw err;
  }
}

/**
 * Enqueue a long-running step and immediately return a job handle.
 * The caller can poll `getJobStatus` to check progress.
 */
export async function dispatchAsync(
  type: JobType,
  payload: JobPayload,
  delayMs = 0,
): Promise<string> {
  const job = await enqueue(type, payload, { delayMs });
  return job.id;
}

export async function getJobStatus(id: string): Promise<JobStatus | null> {
  const row = await prisma.job.findUnique({ where: { id }, select: { status: true } });
  return row ? (row.status as JobStatus) : null;
}

export async function getJobResult(id: string): Promise<JobPayload | null> {
  const row = await prisma.job.findUnique({ where: { id } });
  if (!row || row.status !== 'complete') return null;
  return row.payload as unknown as JobPayload;
}
