import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { IS_SIM_MODE } from '@/lib/dev/simMode';
import { createSimJob } from '@/lib/dev/inMemoryJobStore';
import { getSession, getOrCreateAnonymousSession, setSessionCookie } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { validateAndParse, sanitizeUserInput, validateRequestSize } from '@/lib/security/sanitize';
import { IntentInputSchema } from '@/lib/core/canonicalModels';
import { dispatchFlowJob } from '@/lib/queue/upstashQueue';
import { metrics } from '@/lib/monitoring/metrics';

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, 'intent');
  if (rateLimitResponse) return rateLimitResponse;

  const rawBody = await request.text();
  if (!validateRequestSize(rawBody)) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  let parsed: { input: string; zipCode: string };
  try {
    parsed = validateAndParse(IntentInputSchema, body);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Validation failed' }, { status: 422 });
  }

  const sanitizedInput = sanitizeUserInput(parsed.input);

  // ── Simulation mode bypass ──────────────────────────────────────────────────
  // Skip DB, session, and QStash entirely. Return a mock jobId immediately.
  if (IS_SIM_MODE) {
    const jobId = uuidv4();
    createSimJob(jobId);
    return NextResponse.json({ ok: true, jobId });
  }
  // ───────────────────────────────────────────────────────────────────────────

  let session = await getSession(request);
  let newToken: string | null = null;

  if (!session) {
    const { userId, token } = await getOrCreateAnonymousSession();
    session = { user: { id: userId }, token, expiresAt: new Date(Date.now() + 72 * 3600 * 1000) };
    newToken = token;
  }

  const flowId = uuidv4();

  try {
    const jobId = await dispatchFlowJob(sanitizedInput, parsed.zipCode, session.user.id, flowId);

    const response = NextResponse.json({ ok: true, jobId });
    if (newToken) {
      setSessionCookie(response, newToken);
    }
    return response;
  } catch (err) {
    metrics.failure('/api/intent', err instanceof Error ? err.message : 'unknown');
    console.error('[/api/intent] dispatch error:', err);
    return NextResponse.json({ error: 'Failed to queue request. Please try again.' }, { status: 500 });
  }
}
