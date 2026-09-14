import * as fs from 'fs';
import * as path from 'path';

/**
 * Load `apps/tlon-web/.env.test` into `process.env`, without overriding
 * anything already set, so a command line still wins.
 *
 * Every process that decides which ships to run has to do this before it asks:
 * rube reads the file, and a caller that does not would compute a different
 * selection from its own child and then wait on a port nothing is serving.
 */
export function loadEnvTest(rubeDir: string): void {
  const envTestPath = path.join(rubeDir, '..', '..', '.env.test');
  if (!fs.existsSync(envTestPath)) {
    return;
  }
  const envContent = fs.readFileSync(envTestPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    // Skip comments and empty lines
    if (line && !line.startsWith('#') && line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      // Only set if not already set (allow command-line overrides)
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
  console.log('Loaded environment variables from .env.test');
}
