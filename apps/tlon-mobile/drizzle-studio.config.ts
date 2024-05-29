import type { Config } from 'drizzle-kit';

export default {
  schema: '../../packages/shared/src/db/schema.ts',
  driver: 'better-sqlite',
  dialect: 'sqlite',
  dbCredentials: {
    url: (process.env as any).DB_URL ?? '',
  },
} satisfies Config;
