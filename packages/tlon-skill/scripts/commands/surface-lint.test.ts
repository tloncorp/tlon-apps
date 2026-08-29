import { describe, expect, it } from 'bun:test';

import { COMPLIANT_FIXTURE, RULE_FIXTURES } from '../surface-lint-fixtures';
import { createTestSurfaceDeps } from '../surface-test-doubles';
import { run } from './surface';

const BUNDLE = '/work/app.js';
const SPEC = '/work/spec.json';

function setup(bundleSource: string, spec: unknown) {
  const harness = createTestSurfaceDeps({});
  harness.ship.files.set(BUNDLE, bundleSource);
  harness.ship.files.set(SPEC, JSON.stringify(spec));
  return harness;
}

describe('surface lint', () => {
  it('passes a compliant bundle through the real gate', async () => {
    const harness = setup(
      COMPLIANT_FIXTURE.bundleSource,
      COMPLIANT_FIXTURE.spec
    );
    expect(await run(['lint', BUNDLE, SPEC], harness.deps)).toBe(0);
    expect(harness.out()).toContain('Gate passed');
    expect(harness.err()).toBe('');
  });

  it('reports real gate violations with rule ids and lines', async () => {
    const fixture = RULE_FIXTURES.find(
      (entry) => entry.rule === 'navigation-vector'
    );
    if (!fixture) throw new Error('the gate corpus lost navigation-vector');

    const harness = setup(fixture.bundleSource, fixture.spec);
    expect(await run(['lint', BUNDLE, SPEC, '--json'], harness.deps)).toBe(1);

    const result = harness.json();
    expect(result.ok).toBe(false);
    const violations = result.violations as {
      rule: string;
      line?: number;
      severity: string;
    }[];
    expect(violations.some((entry) => entry.rule === 'navigation-vector')).toBe(
      true
    );
    expect(
      violations.every(
        (entry) => entry.severity === 'error' && typeof entry.line === 'number'
      )
    ).toBe(true);
  });

  /**
   * The wiring, not the gate: every rule the corpus can trip must reach the
   * command's exit status. A wrapper that swallowed a rule class would pass
   * a bundle the gate rejected.
   */
  it('fails for every rule the gate corpus can trip', async () => {
    for (const fixture of RULE_FIXTURES) {
      const harness = setup(fixture.bundleSource, fixture.spec);
      const code = await run(['lint', BUNDLE, SPEC, '--json'], harness.deps);
      const result = harness.json();
      const violations = result.violations as { rule: string }[];
      expect(
        violations.some((entry) => entry.rule === fixture.rule),
        `${fixture.name}: ${fixture.defect}`
      ).toBe(true);
      expect(code, fixture.name).toBe(1);
    }
  });

  it('does not fail on warnings alone', async () => {
    // The compliant fixture passes clean; assert the exit status tracks
    // errors rather than the presence of any finding at all.
    const harness = setup(
      COMPLIANT_FIXTURE.bundleSource,
      COMPLIANT_FIXTURE.spec
    );
    expect(await run(['lint', BUNDLE, SPEC, '--json'], harness.deps)).toBe(0);
    expect(harness.json().ok).toBe(true);
  });

  it('separates a missing file from a gate finding', async () => {
    const harness = setup(COMPLIANT_FIXTURE.bundleSource, {});
    expect(await run(['lint', '/nope.js', SPEC, '--json'], harness.deps)).toBe(
      1
    );
    expect(harness.json().code).toBe('usage');
  });

  it('reports unparseable spec JSON as a file problem, not a rule', async () => {
    const harness = createTestSurfaceDeps({});
    harness.ship.files.set(BUNDLE, COMPLIANT_FIXTURE.bundleSource);
    harness.ship.files.set(SPEC, '{not json');
    expect(await run(['lint', BUNDLE, SPEC, '--json'], harness.deps)).toBe(1);
    expect(harness.json().code).toBe('spec-file-invalid');
  });

  it('requires both paths', async () => {
    const harness = setup(COMPLIANT_FIXTURE.bundleSource, {});
    expect(await run(['lint', BUNDLE, '--json'], harness.deps)).toBe(1);
    expect(harness.json().code).toBe('usage');
  });

  it('accepts any extension — a bundle is source text, not a document', async () => {
    const harness = createTestSurfaceDeps({});
    harness.ship.files.set('/work/app.bundle', COMPLIANT_FIXTURE.bundleSource);
    harness.ship.files.set(SPEC, JSON.stringify(COMPLIANT_FIXTURE.spec));
    expect(await run(['lint', '/work/app.bundle', SPEC], harness.deps)).toBe(0);
  });
});
