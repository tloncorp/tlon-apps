import { describe, expect, it } from 'bun:test';

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
