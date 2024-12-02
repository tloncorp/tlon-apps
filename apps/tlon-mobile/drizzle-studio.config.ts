import type { Config } from 'drizzle-kit';

export default {
  schema: '../../packages/shared/src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: (process.env as any).DB_URL ?? '',
  },
} satisfies Config;
