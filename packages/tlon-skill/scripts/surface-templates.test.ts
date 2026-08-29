import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

import { lintSurfaceBundle } from './surface-lint';

/**
 * The shipped templates, held to the gate they teach.
 *
 * A template is what an authoring bot copies, so a template that would not
 * pass `surface publish` teaches every generated app to fail the same way.
 * This is the tlon-skill half of the template render job: it catches a
 * change to a TEMPLATE, on a tlon-skill-only PR, which never runs the app
 * suite. The shell half (`packages/surface-shell/test/templates.test.ts`)
 * renders the same directories through the harness and catches a change to
 * the SHELL.
 *
 * Warnings are held to zero deliberately. The gate's one warning here would
 * be a computed `invoke()` argument, and a template using one turns off the
 * gate's action cross-reference for every app copied from it — a template is
 * exactly where that is not acceptable.
 */

const TEMPLATES_ROOT = path.join(
  __dirname,
  '..',
  'skills',
  'surfaces',
  'templates'
);

function templateNames(): string[] {
  return fs
    .readdirSync(TEMPLATES_ROOT)
    .filter(
      (entry) =>
        !entry.startsWith('.') &&
        fs.statSync(path.join(TEMPLATES_ROOT, entry)).isDirectory()
    )
    .sort();
}

const names = templateNames();

describe('shipped surface templates', () => {
  it('ships at least one template', () => {
    // A loop over an empty list is a green suite that checks nothing, which
    // is how a moved or renamed templates directory would slip past.
    expect(names.length).toBeGreaterThan(0);
  });

  for (const name of names) {
    describe(name, () => {
      const dir = path.join(TEMPLATES_ROOT, name);

      it('ships app.js, spec.json and NOTES.md', () => {
        for (const file of ['app.js', 'spec.json', 'NOTES.md']) {
          expect(fs.existsSync(path.join(dir, file))).toBe(true);
        }
      });

      it('passes the publish gate with no violations and no warnings', () => {
        const result = lintSurfaceBundle({
          bundleSource: fs.readFileSync(path.join(dir, 'app.js'), 'utf-8'),
          spec: JSON.parse(
            fs.readFileSync(path.join(dir, 'spec.json'), 'utf-8')
          ),
        });
        expect(result.violations).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(result.skipped).toEqual([]);
        expect(result.ok).toBe(true);
      });

      it('ships a populated example state for the render job', () => {
        // `state.json` is what the shell-side render job draws: a populated
        // example, because a template's own initialState is empty and an
        // empty screen exercises no crew list, avatar or chart.
        const statePath = path.join(dir, 'state.json');
        expect(fs.existsSync(statePath)).toBe(true);
        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        expect(JSON.stringify(state)).toMatch(/~[a-z]+/);
      });
    });
  }
});
