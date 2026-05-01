import type { IUserRepository } from '@/lib/contracts';

// Stub — user identity is currently owned by the session layer (lib/auth/session).
// Expand when a first-party User model is added to the Prisma schema.
export const UserRepository: IUserRepository = {
  async findById(_id: string): Promise<{ id: string; email: string } | null> {
    return null;
  },
};
