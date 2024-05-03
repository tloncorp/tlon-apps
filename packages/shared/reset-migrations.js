import { spawnSync } from 'child_process';
import { readdirSync, rmSync, watch } from 'fs';
import path from 'path';

/**
 * reset-migrations
 * Remove all current migrations and use drizzle-kit to recreate them.
 * Takes an option --watch flag to watch for changes in the schema file.
 */

const migrationsFolder = import.meta.dirname + '/src/db/migrations';
const shouldWatch = process.argv.includes('--watch');

reset();

if (shouldWatch) {
  watch(
    './src/db/schema.ts',
    debounce(() => {
      console.log('schema change detected');
      reset();
    }, 1000)
  );
}

function reset() {
  console.log('checking for schema changes');
  // Bail if nothing has changed
  const initialGenerateResult = spawnSync('pnpm', [
    'exec',
    'drizzle-kit',
    'generate:sqlite',
    '--config',
    './drizzle.config.ts',
  ]);
  if (initialGenerateResult.stdout.toString().includes('No schema changes')) {
    console.log('No schema changes detected');
    return;
  }

  console.log('schema has changed, migrating');

  // Remove all current migrations. Eventually we'll want to actually think
  // about which to keep or not, but as we're starting out it simplifies things
  // to just wipe and reset.
  const ignore = ['migrations.d.ts', 'index.ts'];
  const files = readdirSync(migrationsFolder);
  for (const file of files) {
    if (!ignore.includes(file)) {
      console.log('removing', path.join(migrationsFolder, file));
      rmSync(path.join(migrationsFolder, file), {
        recursive: true,
        force: true,
      });
    }
  }

  // Spawn drizzle kit to reset migrations
  spawnSync('pnpm', [
    'exec',
    'drizzle-kit',
    'generate:sqlite',
    '--config',
    './drizzle.config.ts',
  ]);
  console.log('schema regenerated');
}

function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}
