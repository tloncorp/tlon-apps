import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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

const packageRoot = join(fileURLToPath(import.meta.url), '..', '..');

const fixturesRoot = join(packageRoot, 'fixtures');

/**
 * The shipped authoring templates. Same three files as a fixture, with
 * `state.json` carrying a POPULATED example rather than the starting state:
 * a template's starting state is its own `initialState`, and rendering only
 * that would exercise nothing but the empty screen — every crew list, every
 * avatar and every chart in a template is behind a non-empty state.
 *
 * They live in `tlon-skill` (with the CLI verbs that publish them) and are
 * read from here so a SHELL change that breaks one turns this package red,
 * where the breakage was written. `tlon-skill`'s own suite runs the publish
 * gate over the same directories, which is what catches a change to a
 * TEMPLATE — a tlon-skill-only PR never runs this suite.
 */
const templatesRoot = join(
  packageRoot,
  '..',
  'tlon-skill',
  'skills',
  'surfaces',
  'templates'
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

/** Every shipped template, by directory name. */
export function templateNames(): string[] {
  if (!existsSync(templatesRoot)) {
    return [];
  }
  return readdirSync(templatesRoot)
    .filter(
      (entry) =>
        !entry.startsWith('.') &&
        statSync(join(templatesRoot, entry)).isDirectory()
    )
    .sort();
}

export interface ShellTemplate extends ShellFixture {
  /** the template's own `initialState` — the first member's screen */
  initialState: JsonObject;
}

export function loadTemplate(name: string): ShellTemplate {
  const dir = join(templatesRoot, name);
  const spec = JSON.parse(readFileSync(join(dir, 'spec.json'), 'utf8'));
  const statePath = join(dir, 'state.json');
  return {
    name,
    bundleSource: readFileSync(join(dir, 'app.js'), 'utf8'),
    spec,
    initialState: spec.initialState,
    state: existsSync(statePath)
      ? JSON.parse(readFileSync(statePath, 'utf8'))
      : spec.initialState,
  };
}
