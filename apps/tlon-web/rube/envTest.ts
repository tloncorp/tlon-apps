import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

/** Where `.env.test` sits, relative to `rube/`. */
export const envTestPathFor = (rubeDir: string): string =>
  path.join(rubeDir, '..', '..', '.env.test');

/**
 * Load `apps/tlon-web/.env.test` into `process.env`, without touching anything
 * already set, so a command line still wins.
 *
 * Every process that decides which ships to run has to do this before it asks —
 * rube, the dev harness, and the single-spec runner — and all three have to
 * parse the file the *same* way. They did not: a hand-rolled `split('=')` keeps
 * the quotes and any trailing comment, so `N1_SHIP="bud"` selected the N-1 pier
 * in the entrypoint that used dotenv and a ship called `"bud"` (no such ship) in
 * the ones that did not. dotenv's parser is the single one now.
 */
export function loadEnvTest(rubeDir: string): void {
  const envTestPath = envTestPathFor(rubeDir);
  if (!fs.existsSync(envTestPath)) {
    return;
  }
  const parsed = dotenv.parse(fs.readFileSync(envTestPath));
  for (const [key, value] of Object.entries(parsed)) {
    // `in`, not truthiness: an explicitly empty FOO= in the environment is a
    // decision ("unset this"), and overriding it with the file would undo it.
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
  console.log('Loaded environment variables from .env.test');
}
