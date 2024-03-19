import type { Config } from 'drizzle-kit';

export default {
  schema: '../../packages/shared/src/db/schemas.ts',
  out: './src/drizzle',
  driver: 'better-sqlite',
} satisfies Config;
