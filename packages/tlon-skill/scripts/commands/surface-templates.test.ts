import { afterEach, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// `@tloncorp/api` is mocked by `tloncorp-api-mock`, which bunfig.toml
// preloads for every `bun test` run — see that module's doc for why.
import { createSurfaceDeps } from '../surface-runtime';
import { createTestSurfaceDeps } from '../surface-test-doubles';
import type { SurfaceTemplateDetail } from './surface-common';
import { run } from './surface';

function template(
  name: string,
  overrides: Partial<SurfaceTemplateDetail> = {}
): SurfaceTemplateDetail {
  return {
    name,
    title: `The ${name}`,
    files: {
      bundle: `/fake/templates/${name}/app.js`,
      spec: `/fake/templates/${name}/spec.json`,
      notes: `/fake/templates/${name}/NOTES.md`,
    },
    bundleAbsence: null,
    spec: { actions: { vote: { ops: [] } } },
    specText: '{}',
    notes: 'Customize the question.',
    bundleBytes: 2048,
    ...overrides,
  };
}

describe('surface templates — an empty catalogue is an answer', () => {
  it('lists nothing without failing when the directory is empty', async () => {
    const harness = createTestSurfaceDeps({ templates: [] });
    expect(await run(['templates', 'list', '--json'], harness.deps)).toBe(0);
    const result = harness.json();
    expect(result.ok).toBe(true);
    expect(result.templates).toEqual([]);
    expect(result.installed).toBe(true);
  });

  it('lists nothing without failing when the directory is absent', async () => {
    const harness = createTestSurfaceDeps({ templates: null });
    expect(await run(['templates', 'list'], harness.deps)).toBe(0);
    expect(harness.out()).toContain('No dashboard templates are installed');
    expect(harness.err()).toBe('');
  });

  it('says the catalogue is empty rather than "no such template"', async () => {
    const harness = createTestSurfaceDeps({ templates: [] });
    expect(
      await run(['templates', 'show', 'poll', '--json'], harness.deps)
    ).toBe(1);
    expect(harness.json().code).toBe('template-catalogue-empty');
  });
});

describe('surface templates — a populated catalogue', () => {
  it('lists what is installed', async () => {
    const harness = createTestSurfaceDeps({
      templates: [template('poll'), template('rsvp')],
    });
    expect(await run(['templates', 'list', '--json'], harness.deps)).toBe(0);
    const templates = harness.json().templates as { name: string }[];
    expect(templates.map((entry) => entry.name)).toEqual(['poll', 'rsvp']);
  });

  it('defaults to list', async () => {
    const harness = createTestSurfaceDeps({ templates: [template('poll')] });
    expect(await run(['templates'], harness.deps)).toBe(0);
    expect(harness.out()).toContain('poll');
  });

  it('flags an incomplete template instead of hiding or rejecting it', async () => {
    const harness = createTestSurfaceDeps({
      templates: [
        template('half', {
          files: { bundle: '/fake/half/app.js', spec: null, notes: null },
        }),
      ],
    });
    await run(['templates', 'list'], harness.deps);
    expect(harness.out()).toContain('incomplete — no spec, notes');
  });

  it('shows a template with its declared actions and notes', async () => {
    const harness = createTestSurfaceDeps({ templates: [template('poll')] });
    expect(
      await run(['templates', 'show', 'poll', '--json'], harness.deps)
    ).toBe(0);
    const result = harness.json();
    expect(result.name).toBe('poll');
    expect(result.actions).toEqual(['vote']);
    expect(result.notes).toBe('Customize the question.');
  });

  it('names the available templates when one is missing', async () => {
    const harness = createTestSurfaceDeps({
      templates: [template('poll'), template('rsvp')],
    });
    expect(
      await run(['templates', 'show', 'potluck', '--json'], harness.deps)
    ).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('template-not-found');
    expect((result.details as Record<string, unknown>).available).toEqual([
      'poll',
      'rsvp',
    ]);
  });

  it('survives a template whose spec does not parse', async () => {
    const harness = createTestSurfaceDeps({
      templates: [template('broken', { spec: null, title: null })],
    });
    expect(
      await run(['templates', 'show', 'broken', '--json'], harness.deps)
    ).toBe(0);
    expect(harness.json().actions).toEqual([]);
  });

  it('rejects an unknown subcommand', async () => {
    const harness = createTestSurfaceDeps({ templates: [] });
    expect(await run(['templates', 'delete', '--json'], harness.deps)).toBe(1);
    expect(harness.json().code).toBe('usage');
  });
});

/**
 * The malformed-template control, against the REAL catalogue store.
 *
 * The defect it holds shut: when a template directory carried none of
 * `app.js` / `bundle.js` / `index.js`, `readTemplateSummary` fell through to
 * `readdirSync(dir).filter('.js')[0]` and returned an arbitrary file in
 * `files.bundle`. `surface templates show` then printed that path as the
 * template's bundle and exited 0, and `templates list` reported the
 * directory as a complete template. Verbatim, before the fix, against the
 * directory built below:
 *
 *     scoreboard — Scoreboard
 *       bundle: …/scoreboard/notes.js (17 bytes)
 *
 * FULCRUM: `files.bundle` is moved by exactly one thing — the lookup in
 * `readTemplateSummary`. What moves it in this test's world is the CONTENTS
 * of the directory `TLON_SURFACE_TEMPLATES_DIR` names, which the test writes
 * itself. Restore the `?? readdirSync(...)` fallback and `refuses a template
 * directory that ships no bundle` fails on the exit code, because the
 * refusal it asserts is reached only when the lookup returns null.
 *
 * These run through `createSurfaceDeps().templates` — the real filesystem
 * store — and not through `fakeTemplateStore`, deliberately: the double is
 * handed `files.bundle` ready-made, so it can represent the AFTERMATH of the
 * defect but can never produce it. A control whose double cannot express the
 * defect is bounded by the double.
 */
describe('surface templates — a failed bundle lookup is a failed lookup', () => {
  let saved: string | undefined;
  let root: string | null = null;

  function catalogue(name: string, files: Record<string, string>): void {
    saved ??= process.env.TLON_SURFACE_TEMPLATES_DIR;
    root ??= fs.mkdtempSync(path.join(os.tmpdir(), 'surface-templates-'));
    const dir = path.join(root, name);
    fs.mkdirSync(dir, { recursive: true });
    for (const [file, contents] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, file), contents);
    }
    process.env.TLON_SURFACE_TEMPLATES_DIR = root;
  }

  /** The real store, driving the real command. */
  function harnessOverRealStore(): ReturnType<typeof createTestSurfaceDeps> {
    return createTestSurfaceDeps({
      overrides: { templates: createSurfaceDeps().templates },
    });
  }

  afterEach(() => {
    if (saved === undefined) delete process.env.TLON_SURFACE_TEMPLATES_DIR;
    else process.env.TLON_SURFACE_TEMPLATES_DIR = saved;
    saved = undefined;
    if (root !== null) fs.rmSync(root, { recursive: true, force: true });
    root = null;
  });

  it('refuses a template directory that ships no bundle', async () => {
    catalogue('scoreboard', {
      'helper.js': 'const helper = 1;\n',
      'notes.js': 'const notes = 2;\n',
      'spec.json': '{"title":"Scoreboard","actions":{}}\n',
      'NOTES.md': '# Scoreboard\n',
    });
    const harness = harnessOverRealStore();

    expect(
      await run(['templates', 'show', 'scoreboard', '--json'], harness.deps)
    ).toBe(1);
    const result = harness.json();
    expect(result.code).toBe('template-bundle-missing');
    // Which template, what was expected, what was found — all three, because
    // a refusal a bot cannot act on sends it back to guessing filenames.
    expect(result.message).toContain('"scoreboard"');
    const details = result.details as Record<string, unknown>;
    expect(details.expected).toEqual(['app.js', 'bundle.js', 'index.js']);
    expect(details.found).toEqual([
      'NOTES.md',
      'helper.js',
      'notes.js',
      'spec.json',
    ]);
    // The thing the fallback used to do: hand back one of these anyway.
    expect(JSON.stringify(result)).not.toContain('/scoreboard/helper.js');
    expect(JSON.stringify(result)).not.toContain('/scoreboard/notes.js');
  });

  it('lists the same directory as incomplete rather than as a template', async () => {
    catalogue('scoreboard', {
      'helper.js': 'const helper = 1;\n',
      'spec.json': '{"title":"Scoreboard"}\n',
    });
    const harness = harnessOverRealStore();

    expect(await run(['templates', 'list', '--json'], harness.deps)).toBe(0);
    const listed = harness.json().templates as {
      name: string;
      files: { bundle: string | null };
    }[];
    expect(listed).toHaveLength(1);
    expect(listed[0].files.bundle).toBeNull();
    // list stays tolerant — an incomplete catalogue is an answer — but it
    // must not report the incompleteness as completeness.
    harness.stdout.length = 0;
    expect(await run(['templates', 'list'], harness.deps)).toBe(0);
    expect(harness.out()).toContain('(incomplete — no bundle, notes)');
  });

  it('shows a template whose bundle is present under an expected name', async () => {
    // The differential arm. Same command, same store, same directory shape —
    // one file renamed. Without it, `refuses …` above would pass just as well
    // against a store that refused everything.
    catalogue('scoreboard', {
      'app.js': 'const app = 1;\n',
      'helper.js': 'const helper = 2;\n',
      'spec.json': '{"title":"Scoreboard","actions":{"add":{"ops":[]}}}\n',
      'NOTES.md': '# Scoreboard\n',
    });
    const harness = harnessOverRealStore();

    expect(
      await run(['templates', 'show', 'scoreboard', '--json'], harness.deps)
    ).toBe(0);
    const result = harness.json();
    expect(
      String(result.files && (result.files as { bundle: string }).bundle)
    ).toEndWith('/scoreboard/app.js');
    expect(result.actions).toEqual(['add']);
  });
});
