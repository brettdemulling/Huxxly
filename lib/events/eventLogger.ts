import { prisma } from '@/lib/db';
import { EventType } from '@/lib/core/canonicalModels';

export interface LoggedEvent {
  id: string;
  type: EventType;
  userId: string;
  zipCode?: string;
  payload: Record<string, unknown>;
  timestamp: Date;
}

// Prisma 7 InputJsonValue doesn't accept Record<string,unknown> directly
type PrismaJson = Parameters<typeof prisma.event.create>[0]['data']['payload'];

export async function logEvent(
  type: EventType,
  userId: string,
  payload: Record<string, unknown>,
  zipCode?: string,
): Promise<string> {
  const event = await prisma.event.create({
    data: { type, userId, zipCode: zipCode ?? null, payload: payload as unknown as PrismaJson },
  });
  return event.id;
}

export async function logBatch(
  events: Array<{ type: EventType; userId: string; payload: Record<string, unknown>; zipCode?: string }>,
): Promise<void> {
  await prisma.event.createMany({
    data: events.map((e) => ({
      type: e.type,
      userId: e.userId,
      zipCode: e.zipCode ?? null,
      payload: e.payload as unknown as PrismaJson,
    })),
  });
}

export async function getEvents(userId: string, limit = 50): Promise<LoggedEvent[]> {
  const rows = await prisma.event.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type as EventType,
    userId: r.userId,
    zipCode: r.zipCode ?? undefined,
    payload: r.payload as Record<string, unknown>,
    timestamp: r.timestamp,
  }));
}
