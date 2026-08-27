import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { JsonObject, ShellSurfaceSpec } from '../src/protocol/types';

/**
 * Generic fixture loader: any directory holding app.js + spec.json +
 * state.json can run through the shell. This is the seed of the CI
 * template-render job — templates land as more directories, not more
 * runner code.
 */
export interface ShellFixture {
  name: string;
  bundleSource: string;
  spec: ShellSurfaceSpec;
  state: JsonObject;
}

const fixturesRoot = join(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  'fixtures'
);

export function loadFixture(name: string): ShellFixture {
  const dir = join(fixturesRoot, name);
  return {
    name,
    bundleSource: readFileSync(join(dir, 'app.js'), 'utf8'),
    spec: JSON.parse(readFileSync(join(dir, 'spec.json'), 'utf8')),
    state: JSON.parse(readFileSync(join(dir, 'state.json'), 'utf8')),
  };
}
