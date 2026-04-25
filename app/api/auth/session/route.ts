import { NextRequest, NextResponse } from 'next/server';
import { getSession, getOrCreateAnonymousSession, setSessionCookie } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const session = await getSession(request);

  if (session) {
    return NextResponse.json({ userId: session.user.id, authenticated: true });
  }

  // Auto-create anonymous session so flow always has a userId
  const { userId, token } = await getOrCreateAnonymousSession();
  const response = NextResponse.json({ userId, authenticated: false });
  return setSessionCookie(response, token);
}
