import { defineConfig } from '@prisma/config';

export default defineConfig({
  migrations: {
    seed: 'node_modules/.bin/jiti prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
