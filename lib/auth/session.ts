import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '@/lib/db';

const SESSION_COOKIE = 'ag_session';
const SESSION_TTL_HOURS = 72;
// Rotate the session token after this many seconds of activity
const ROTATION_THRESHOLD_SECS = 60 * 30; // 30 minutes

export interface SessionUser {
  id: string;
  email?: string;
}

export interface Session {
  user: SessionUser;
  token: string;
  expiresAt: Date;
  rotatedToken?: string; // set when rotation occurred — caller must re-set cookie
}

export interface DeviceInfo {
  userAgent: string;
  ip: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string, device?: DeviceInfo): Promise<string> {
  const rawToken = randomBytes(32).toString('hex');
  const hashedToken = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      token: hashedToken,
      expiresAt,
      deviceUserAgent: device?.userAgent ?? null,
      deviceIp: device?.ip ?? null,
      lastActiveAt: new Date(),
    },
  });

  return rawToken;
}

export async function rotateSession(oldRawToken: string, userId: string): Promise<string> {
  const oldHashed = hashToken(oldRawToken);
  await prisma.session.deleteMany({ where: { token: oldHashed } });
  return createSession(userId);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function getSession(request?: NextRequest): Promise<Session | null> {
  let rawToken: string | undefined;

  if (request) {
    rawToken = request.cookies.get(SESSION_COOKIE)?.value;
  } else {
    const cookieStore = await cookies();
    rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  }

  if (!rawToken) return null;

  const hashedToken = hashToken(rawToken);
  const session = await prisma.session.findUnique({
    where: { token: hashedToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    }
    return null;
  }

  // Update lastActiveAt
  const now = new Date();
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActiveAt: now },
  }).catch(() => {});

  // Rotate if token is older than threshold
  const lastActive = session.lastActiveAt ?? session.createdAt;
  const ageSecs = (now.getTime() - lastActive.getTime()) / 1000;
  let rotatedToken: string | undefined;
  if (ageSecs > ROTATION_THRESHOLD_SECS) {
    rotatedToken = await rotateSession(rawToken, session.userId).catch(() => undefined);
  }

  return {
    user: { id: session.user.id, email: session.user.email ?? undefined },
    token: rotatedToken ?? rawToken,
    expiresAt: session.expiresAt,
    rotatedToken,
  };
}

export function setSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_HOURS * 60 * 60,
    path: '/',
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}

export async function deleteSession(token: string): Promise<void> {
  const hashedToken = hashToken(token);
  await prisma.session.deleteMany({ where: { token: hashedToken } });
}

export async function requireSession(request: NextRequest): Promise<Session | NextResponse> {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return session;
}

export async function getOrCreateAnonymousSession(): Promise<{ userId: string; token: string }> {
  const user = await prisma.user.create({ data: {} });
  const token = await createSession(user.id);
  return { userId: user.id, token };
}

export function validateCsrfToken(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}
