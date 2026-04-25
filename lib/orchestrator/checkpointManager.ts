import { prisma } from '@/lib/db';

export type CheckpointStatus = 'pending' | 'complete' | 'failed';

export interface Checkpoint<T = unknown> {
  flowId: string;
  step: string;
  status: CheckpointStatus;
  payload: T;
}

type CheckpointJson = Parameters<typeof prisma.checkpoint.create>[0]['data']['payload'];

export async function saveCheckpoint<T>(
  flowId: string,
  step: string,
  payload: T,
  status: CheckpointStatus = 'complete',
): Promise<void> {
  await prisma.checkpoint.upsert({
    where: { flowId_step: { flowId, step } },
    create: { flowId, step, status, payload: payload as unknown as CheckpointJson },
    update: { status, payload: payload as unknown as CheckpointJson },
  });
}

export async function markFailed(flowId: string, step: string, error: string): Promise<void> {
  await prisma.checkpoint.upsert({
    where: { flowId_step: { flowId, step } },
    create: { flowId, step, status: 'failed', payload: { error } as unknown as CheckpointJson },
    update: { status: 'failed', payload: { error } as unknown as CheckpointJson },
  });
}

export async function getCheckpoint<T>(flowId: string, step: string): Promise<Checkpoint<T> | null> {
  const row = await prisma.checkpoint.findUnique({
    where: { flowId_step: { flowId, step } },
  });
  if (!row) return null;
  return {
    flowId: row.flowId,
    step: row.step,
    status: row.status as CheckpointStatus,
    payload: row.payload as T,
  };
}

export async function resumeFrom<T>(flowId: string, step: string): Promise<T | null> {
  const cp = await getCheckpoint<T>(flowId, step);
  if (cp?.status === 'complete') return cp.payload;
  return null;
}

/**
 * Runs `fn` for a pipeline step. If a completed checkpoint exists, returns
 * the cached result without re-running. On failure, marks the checkpoint
 * as failed so the pipeline can resume from this step on retry.
 */
export async function runWithCheckpoint<T>(
  flowId: string,
  step: string,
  fn: () => Promise<T>,
): Promise<T> {
  const cached = await resumeFrom<T>(flowId, step);
  if (cached !== null) return cached;

  try {
    const result = await fn();
    await saveCheckpoint(flowId, step, result);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await markFailed(flowId, step, msg);
    throw err;
  }
}

export async function clearCheckpoints(flowId: string): Promise<void> {
  await prisma.checkpoint.deleteMany({ where: { flowId } });
}

export async function getFlowState(flowId: string): Promise<Checkpoint[]> {
  const rows = await prisma.checkpoint.findMany({ where: { flowId }, orderBy: { createdAt: 'asc' } });
  return rows.map((r) => ({
    flowId: r.flowId,
    step: r.step,
    status: r.status as CheckpointStatus,
    payload: r.payload,
  }));
}
