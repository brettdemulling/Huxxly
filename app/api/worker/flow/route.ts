import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { runAutopilotFlow } from '@/lib/orchestrator/flowEngine';
import { markJobStarted, markJobCompleted, markJobFailed, getJobResult } from '@/lib/queue/eventQueue';
import type { FlowJobPayload } from '@/lib/queue/upstashQueue';

async function verifyQStashSignature(request: NextRequest, body: string): Promise<boolean> {
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
  });
  const sig = request.headers.get('upstash-signature') ?? '';
  return receiver.verify({ signature: sig, body });
}

export async function POST(request: NextRequest) {
  const body = await request.text();

  try {
    await verifyQStashSignature(request, body);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: FlowJobPayload;
  try {
    payload = JSON.parse(body) as FlowJobPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { jobId, rawInput, zipCode, userId, flowId } = payload;

  const existing = await getJobResult(jobId);
  if (existing.status === 'completed') {
    return NextResponse.json({ ok: true, jobId, skipped: true });
  }

  const { prisma } = await import('@/lib/db');
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  const attempts = job?.attempts ?? 0;
  const maxAttempts = job?.maxAttempts ?? 3;

  await markJobStarted(jobId, userId);

  try {
    const result = await runAutopilotFlow(rawInput, zipCode, userId, flowId);
    await markJobCompleted(jobId, userId, result as unknown as Record<string, unknown>);
    return NextResponse.json({ ok: true, jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await markJobFailed(jobId, userId, message, attempts + 1, maxAttempts);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
