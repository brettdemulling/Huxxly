export type EventPayload = Record<string, unknown>;

// Structural type for Prisma partial-select results ({ select: { payload: true } }).
// Uses `unknown` so JsonValue is assignable without widening to any.
export type EventRow = { payload: unknown };
