import { NextRequest, NextResponse } from 'next/server';
import { getSession, deleteSession, clearSessionCookie } from '@/lib/auth/session';

export async function POST(request: NextRequest) {
  const session = await getSession(request);

  if (session) {
    await deleteSession(session.token);
  }

  const response = NextResponse.json({ ok: true });
  return clearSessionCookie(response);
}
