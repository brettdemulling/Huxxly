import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/security/rateLimit';
import { validateCsrfToken } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, 'default');
  if (rateLimitResponse) return rateLimitResponse;

  if (!validateCsrfToken(request)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  // Anonymous session creation (no credentials needed for autopilot MVP)
  const user = await prisma.user.create({ data: {} });
  const token = await createSession(user.id);

  const response = NextResponse.json({ userId: user.id });
  return setSessionCookie(response, token);
}
