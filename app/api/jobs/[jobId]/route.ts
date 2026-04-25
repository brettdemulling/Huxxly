import { NextRequest, NextResponse } from 'next/server';
import { IS_SIM_MODE } from '@/lib/dev/simMode';
import { getSimJob } from '@/lib/dev/inMemoryJobStore';
import { getJobResult } from '@/lib/queue/eventQueue';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
  }

  if (IS_SIM_MODE) {
    return NextResponse.json(getSimJob(jobId));
  }

  const result = await getJobResult(jobId);
  return NextResponse.json(result);
}
