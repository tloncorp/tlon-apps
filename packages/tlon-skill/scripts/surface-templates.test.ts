import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

import { createHash } from 'crypto';
import { tmpdir } from 'os';

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

      /**
       * Who owns which half of the `bundle` block, pinned per template.
       *
       * The countdown's note said the whole `bundle` block was placeholders
       * publish overwrites. It is not: publish owns `assetRef`, `sha256` and
       * `size`, and PRESERVES the author's `shellVersion`
       * (`surface-publish.ts`, and `SKILL.md`'s own table). A bot revising
       * from that note omits or resets the field, publish defaults an absent
       * one to 1, and old clients then run a bundle that needs shell 2 — the
       * one field in the block whose loss is not repaired by the next
       * publish. The note is the only thing standing between an author and
       * that, so it is pinned rather than trusted (D195).
       *
       * Every template, not just the one that drifted: the wording was
       * copied between templates, so the next drift will be too. Three
       * templates carried no bundle note at all when this was written, which
       * is the same defect with nothing to read.
       */
      it('says publish owns assetRef/sha256/size and NOT shellVersion', () => {
        const notes = fs.readFileSync(path.join(dir, 'NOTES.md'), 'utf-8');
        for (const owned of ['assetRef', 'sha256', 'size']) {
          expect(notes).toContain(`bundle.${owned}`);
        }
        // Named, and named as the author's — an omission reads to a bot the
        // same way the countdown's "the whole block" did.
        expect(notes).toContain('bundle.shellVersion');
        expect(notes).toMatch(
          /`bundle\.shellVersion` is not one\s+of them — it is yours, and publish preserves it exactly as written\./
        );
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
        //
        // The ship requirement is waived for a DECLARED display-only app, and
        // the waiver is narrow on purpose. A countdown has no per-member state
        // to hold, so requiring a ship in its example would push it to invent
        // people — which is the same pressure the `memberInteraction` marker
        // exists to relieve, applied by a test instead of by a lint. Only the
        // marker earns the waiver: an app that merely happens to have no
        // actions still has to show somebody, because "no actions" is also
        // what a forgotten action looks like.
        const statePath = path.join(dir, 'state.json');
        expect(fs.existsSync(statePath)).toBe(true);
        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        const spec = JSON.parse(
          fs.readFileSync(path.join(dir, 'spec.json'), 'utf-8')
        );
        if (spec?.memberInteraction?.mode !== 'none') {
          expect(JSON.stringify(state)).toMatch(/~[a-z]+/);
        }
      });
    });
  }
});

/**
 * Every shipped template, through real Chromium, scored by the machine pass.
 *
 * The gate above reads the bundle and the spec. It cannot see geometry, and
 * geometry is where a template's defects live: `workout-tracker` shipped with
 * "All reps" and "Missed" 0px apart on the same row — under the 6px tap-target
 * minimum, in all twelve cells — and it lints clean, passes the checks above,
 * and passes the shell-side render test. THREE separate agents authoring other
 * templates found it independently, each by running preview by hand, because
 * `workout-tracker` is the template whose idiom a new author copies first.
 *
 * So the defect pass runs over every template here. This is the leg that
 * catches a template teaching a geometric mistake to everything copied from
 * it, and its absence is why that one shipped.
 *
 * **One template per SUBPROCESS, and that is not a style choice.** Several
 * sequential `chromium.launch()` calls in one process wedge in this
 * environment — the launch never returns and Playwright times out at 180s.
 * Measured here rather than taken on report: seven templates in one process
 * failed on `leaderboard`, and `leaderboard` alone passes in under ten
 * seconds. The determinism control in `surface-preview.test.ts` spawns
 * subprocesses for the same reason, and this reuses its shape.
 *
 * Browser-gated the same way that file is: opt-in via TLON_PREVIEW_BROWSER so
 * the suite stays runnable without browser binaries, and CI sets it after
 * installing Chromium.
 */
const browserTest = process.env.TLON_PREVIEW_BROWSER === '1' ? it : it.skip;

/** Renders one template in its own process and returns what the pass found. */
async function machinePassInSubprocess(name: string): Promise<{
  shellErrors: unknown[];
  unprobedCells: unknown[];
  defects: unknown[];
}> {
  const dir = path.join(TEMPLATES_ROOT, name);
  const statePath = path.join(dir, 'state.json');
  const outDir = fs.mkdtempSync(path.join(tmpdir(), `tpl-${name}-`));
  const runnerPath = path.join(outDir, 'run.ts');
  fs.writeFileSync(
    runnerPath,
    [
      `import { createHash } from 'node:crypto';`,
      `import { readFileSync } from 'node:fs';`,
      `import { renderSurfacePreview } from ${JSON.stringify(
        path.join(process.cwd(), 'scripts', 'surface-preview.ts')
      )};`,
      `const source = readFileSync(${JSON.stringify(
        path.join(dir, 'app.js')
      )}, 'utf8');`,
      `const outcome = await renderSurfacePreview({`,
      `  bundleSource: source,`,
      `  bundleSha256: createHash('sha256').update(source).digest('hex'),`,
      `  spec: JSON.parse(readFileSync(${JSON.stringify(
        path.join(dir, 'spec.json')
      )}, 'utf8')),`,
      // The populated example, not the mechanical fold: `state.json` is what
      // the shell-side render job draws, and it is the board a reviewer would
      // actually be looking at.
      fs.existsSync(statePath)
        ? `  stateOverride: JSON.parse(readFileSync(${JSON.stringify(
            statePath
          )}, 'utf8')),`
        : ``,
      `  outDir: ${JSON.stringify(outDir)},`,
      `});`,
      `process.stdout.write(JSON.stringify({`,
      `  shellErrors: outcome.manifest.shellErrors ?? [],`,
      `  unprobedCells: outcome.manifest.unprobedCells ?? [],`,
      `  defects: outcome.manifest.defects ?? [],`,
      `}));`,
      ``,
    ].join('\n')
  );
  const proc = Bun.spawn(['bun', 'run', runnerPath], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`${name}: preview subprocess exited ${code}: ${stderr}`);
  }
  return JSON.parse(stdout);
}

describe('shipped surface templates — the machine pass', () => {
  for (const name of names) {
    browserTest(
      `${name} paints without a machine-checked defect`,
      async () => {
        const outcome = await machinePassInSubprocess(name);
        // Shell errors first: a template that threw has no geometry worth
        // reporting, and "no defects" over a blank page is the vacuous pass.
        expect(outcome.shellErrors).toEqual([]);
        expect(outcome.unprobedCells).toEqual([]);
        expect(outcome.defects).toEqual([]);
      },
      180_000
    );
  }
});
