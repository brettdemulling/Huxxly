import { NextRequest, NextResponse } from 'next/server';
import { getSession, setSessionCookie, Session } from './session';
import { normalizeError } from '@/lib/errors/errorHandler';

export interface AuthContext {
  session: Session;
  userId: string;
}

type AuthedHandler = (request: NextRequest, ctx: AuthContext) => Promise<NextResponse>;

/**
 * Wraps an API route handler with session validation.
 * Attaches user context, handles session rotation automatically,
 * and rejects any request without a valid non-expired session.
 */
export function withAuth(handler: AuthedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    let session: Session | null;
    try {
      session = await getSession(request);
    } catch (err) {
      const normalized = normalizeError(err, 'auth');
      return NextResponse.json({ error: normalized.message }, { status: 500 });
    }

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ctx: AuthContext = { session, userId: session.user.id };

    let response: NextResponse;
    try {
      response = await handler(request, ctx);
    } catch (err) {
      const normalized = normalizeError(err, 'api');
      return NextResponse.json(
        { error: normalized.message, type: normalized.type },
        { status: normalized.recoverable ? 503 : 500 },
      );
    }

    // Propagate rotated token if rotation occurred
    if (session.rotatedToken) {
      setSessionCookie(response, session.rotatedToken);
    }

    return response;
  };
}

/**
 * Like withAuth but creates an anonymous session if none exists,
 * so the flow always has a userId without requiring login.
 */
export function withOptionalAuth(handler: AuthedHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    let session = await getSession(request).catch(() => null);
    let newToken: string | null = null;

    if (!session) {
      const { getOrCreateAnonymousSession } = await import('./session');
      const anon = await getOrCreateAnonymousSession();
      session = {
        user: { id: anon.userId },
        token: anon.token,
        expiresAt: new Date(Date.now() + 72 * 3600 * 1000),
      };
      newToken = anon.token;
    }

    const ctx: AuthContext = { session, userId: session.user.id };
    let response: NextResponse;
    try {
      response = await handler(request, ctx);
    } catch (err) {
      const normalized = normalizeError(err, 'api');
      return NextResponse.json(
        { error: normalized.message, type: normalized.type },
        { status: normalized.recoverable ? 503 : 500 },
      );
    }

    if (newToken) setSessionCookie(response, newToken);
    if (session.rotatedToken) setSessionCookie(response, session.rotatedToken);

    return response;
  };
}
