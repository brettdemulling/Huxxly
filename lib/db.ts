import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const IS_SIM = process.env.DEV_SIMULATION === 'true';

// Default return values by Prisma method — prevents null-iteration errors in sim mode
const MOCK_RETURNS: Record<string, unknown> = {
  findMany:   [],
  findFirst:  null,
  findUnique: null,
  create:     {},
  update:     {},
  upsert:     {},
  delete:     {},
  deleteMany: { count: 0 },
  count:      0,
  aggregate:  {},
};

function createMockClient(): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, model) {
      return new Proxy({}, {
        get(_t, method) {
          const methodName = String(method);
          return (..._args: unknown[]) => {
            if (IS_SIM) {
              return Promise.resolve(MOCK_RETURNS[methodName] ?? null);
            }
            throw new Error(
              `[db] Cannot call prisma.${String(model)}.${methodName}() — DATABASE_URL is not configured.`,
            );
          };
        },
      });
    },
  });
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || IS_SIM) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[db] DATABASE_URL not configured — using mock client (simulation mode).');
    }
    return createMockClient();
  }
  try {
    const adapter = new PrismaPg(connectionString);
    return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
  } catch (err) {
    console.warn('[db] Failed to create Prisma client:', err);
    return createMockClient();
  }
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
