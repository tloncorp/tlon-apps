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
    expect(violations.every((entry) => entry.severity === 'error')).toBe(true);
    // rule 5 has a behavioral half now, and a finding read off the rendered
    // DOM has no source position to carry — as with every other behavioral
    // rule. What the wrapper must not lose is the lexical half's position.
    expect(violations.some((entry) => typeof entry.line === 'number')).toBe(
      true
    );
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
      const warnings = result.warnings as { rule: string }[];

      // A warning-severity rule reaches the DOCUMENT and deliberately not
      // the exit status. Asserting that here rather than skipping it keeps
      // the loop total over the corpus: a rule that quietly stopped
      // appearing anywhere would still fail this.
      if (fixture.severity === 'warning') {
        expect(
          warnings.some((entry) => entry.rule === fixture.rule),
          `${fixture.name}: ${fixture.defect}`
        ).toBe(true);
        expect(violations, fixture.name).toEqual([]);
        expect(code, fixture.name).toBe(0);
        continue;
      }

      expect(
        violations.some((entry) => entry.rule === fixture.rule),
        `${fixture.name}: ${fixture.defect}`
      ).toBe(true);
      expect(code, fixture.name).toBe(1);
    }
  });

  it('does not fail on warnings alone', async () => {
    // Deliberately NOT the compliant fixture, which produces no findings at
    // all: "exit 0 over nothing" is not evidence that the exit status tracks
    // errors rather than findings. This one produces a warning and no
    // violation, which is the only shape that can tell the two apart.
    const fixture = RULE_FIXTURES.find((entry) => entry.severity === 'warning');
    if (!fixture) throw new Error('the gate corpus lost its warning fixture');
    const harness = setup(fixture.bundleSource, fixture.spec);
    expect(await run(['lint', BUNDLE, SPEC, '--json'], harness.deps)).toBe(0);
    const result = harness.json();
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.warnings).toHaveLength(1);
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
