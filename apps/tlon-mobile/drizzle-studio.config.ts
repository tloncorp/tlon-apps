import type { Config } from 'drizzle-kit';

export default {
  schema: '../../packages/shared/src/db/schema.ts',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DB_URL ?? '',
  },
} satisfies Config;
