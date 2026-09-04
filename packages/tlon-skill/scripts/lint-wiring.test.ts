import { afterEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The lint wiring, held to two separate claims.
 *
 * For three sessions `packages/tlon-skill` shipped no `lint` script, so
 * `pnpm -r lint` — which silently skips a package that has none — skipped it
 * entirely and every repo-wide oxlint rule was unenforced here. Verbatim,
 * with a deliberate two-file import cycle sitting in `scripts/` and the
 * script absent:
 *
 *     $ pnpm -r --no-bail lint
 *     … apps/tlon-mobile, apps/tlon-web, packages/api, packages/app,
 *       packages/editor, packages/openclaw, packages/shared,
 *       packages/surface-shell, packages/ui …
 *     (no line mentioning tlon-skill; the cycle is not reported)
 *
 * and with the script present, the same tree:
 *
 *     packages/tlon-skill lint: scripts/cycle-b.ts:1:19: error
 *       import(no-cycle): Dependency cycle detected
 *     packages/tlon-skill lint: Failed
 *
 * The two claims, because each can fail without the other:
 *
 *  1. **The script exists and CI reaches it.** `pnpm -r lint` runs only in
 *     the `test-build` job, which a tlon-skill-only PR SKIPS —
 *     `packages/tlon-skill/**` is excluded from ci.yml's `app` filter. On
 *     those PRs `bot-checks` runs instead, and the only tlon-skill thing it
 *     runs is `pnpm --filter '@tloncorp/tlon-skill' check`. So `check` has
 *     to run lint, or the guard sits exactly where CI does not look — on
 *     precisely the PRs that change this package.
 *  2. **The rules it enforces are the repo's.** oxlint invoked with this
 *     package as its working directory must resolve the ROOT `.oxlintrc.json`
 *     — otherwise the script runs, passes, and enforces oxlint's built-in
 *     defaults rather than `import/no-cycle` and the rest. That is the
 *     vacuous-guard shape this whole item is about, so it is asserted by
 *     running the real binary over a real cycle rather than by reading the
 *     config file.
 *
 * FULCRUM (claim 1): `package.json`'s `scripts` object, which the test reads
 * off disk. FULCRUM (claim 2): the resolved oxlint configuration — moved in
 * this test's world by the working directory the linter is spawned in, which
 * is what the assertion varies. Point the spawn at a directory outside the
 * repo, or set `import/no-cycle` to "off" at the root, and it fails.
 *
 * What it does NOT cover: it cannot prove CI's runner behaves like this one.
 * The ci.yml reading above is a reading of a file, not an observation of a
 * run.
 */

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const OXLINT = path.join(REPO_ROOT, 'node_modules', '.bin', 'oxlint');

describe('lint wiring — the script exists and CI reaches it', () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf-8')
  ) as { scripts: Record<string, string> };

  it('declares a lint script, so `pnpm -r lint` stops skipping the package', () => {
    expect(manifest.scripts.lint).toBe('oxlint .');
  });

  it('runs lint from `check`, which is what bot-checks invokes', () => {
    // A tlon-skill-only PR never runs `pnpm -r lint`. This is the only path
    // to the linter on those PRs.
    expect(manifest.scripts.check).toContain('pnpm lint');
  });
});

describe('lint wiring — the rules it enforces are the repo-wide ones', () => {
  let probe: string | null = null;

  // The probe directory sits INSIDE the package and is deliberately not
  // gitignored: oxlint honours .gitignore, so an ignored probe would be
  // skipped by the very run that is supposed to lint it. The cost is that a
  // hard-killed run can leave one behind, where `pnpm lint` would then find
  // its cycle — hence the sweep, which clears any leftover before the
  // assertions rather than leaving the next reader to explain a phantom.
  for (const entry of fs.readdirSync(PACKAGE_ROOT)) {
    if (entry.startsWith('lint-probe-')) {
      fs.rmSync(path.join(PACKAGE_ROOT, entry), {
        recursive: true,
        force: true,
      });
    }
  }

  afterEach(() => {
    if (probe !== null) fs.rmSync(probe, { recursive: true, force: true });
    probe = null;
  });

  it('reports an import cycle as an error when run from this package', () => {
    // A directory under the package, because config resolution is what is
    // under test: oxlint has to walk up from here to the repo root and find
    // `.oxlintrc.json`. Written and removed per run, so it never sits in the
    // tree the real `pnpm lint` walks.
    probe = fs.mkdtempSync(path.join(PACKAGE_ROOT, 'lint-probe-'));
    fs.writeFileSync(
      path.join(probe, 'a.ts'),
      "import { b } from './b';\nexport const a = () => b();\n"
    );
    fs.writeFileSync(
      path.join(probe, 'b.ts'),
      "import { a } from './a';\nexport const b = () => a();\n"
    );

    const run = Bun.spawnSync([OXLINT, path.basename(probe)], {
      cwd: PACKAGE_ROOT,
    });
    const output = `${new TextDecoder().decode(run.stdout)}${new TextDecoder().decode(run.stderr)}`;

    // `import/no-cycle` is "error" in the ROOT config and absent from
    // oxlint's defaults, so both of these fail if the root config was not
    // the one that applied.
    expect(output).toContain('import(no-cycle)');
    expect(output).toContain('error');
    expect(run.exitCode).toBe(1);
  });

  it('reports nothing about the same two files without the cycle', () => {
    // The differential arm. Without it, the assertion above would pass just
    // as well against an oxlint that failed on every input it was given.
    probe = fs.mkdtempSync(path.join(PACKAGE_ROOT, 'lint-probe-'));
    fs.writeFileSync(path.join(probe, 'a.ts'), 'export const a = () => 1;\n');
    fs.writeFileSync(
      path.join(probe, 'b.ts'),
      "import { a } from './a';\nexport const b = () => a();\n"
    );

    const run = Bun.spawnSync([OXLINT, path.basename(probe)], {
      cwd: PACKAGE_ROOT,
    });
    const output = `${new TextDecoder().decode(run.stdout)}${new TextDecoder().decode(run.stderr)}`;

    expect(output).not.toContain('no-cycle');
    expect(run.exitCode).toBe(0);
  });
});
