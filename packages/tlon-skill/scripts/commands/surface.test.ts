import { describe, expect, it } from 'bun:test';

import { createTestSurfaceDeps } from '../surface-test-doubles';
import { SURFACE_HELP, SURFACE_SUBCOMMANDS, run } from './surface';

describe('surface dispatcher', () => {
  it('shows the group help with no subcommand', async () => {
    const harness = createTestSurfaceDeps({});
    expect(await run([], harness.deps)).toBe(0);
    expect(harness.out()).toContain('Usage: tlon surface <subcommand>');
    expect(harness.err()).toBe('');
  });

  it('shows a subcommand help without touching the ship', async () => {
    for (const subcommand of SURFACE_SUBCOMMANDS) {
      const harness = createTestSurfaceDeps({});
      expect(await run([subcommand, '--help'], harness.deps)).toBe(0);
      expect(harness.out()).toContain('Usage: tlon surface');
      expect(harness.ship.createPokes).toHaveLength(0);
      expect(harness.ship.descriptionWrites).toHaveLength(0);
    }
  });

  it('names an unknown subcommand and lists the real ones', async () => {
    const harness = createTestSurfaceDeps({});
    expect(await run(['frobnicate'], harness.deps)).toBe(1);
    expect(harness.err()).toContain('Unknown surface subcommand: frobnicate');
    expect(harness.err()).toContain(SURFACE_HELP);
  });

  it('renders a failure as one plain line with a stable code', async () => {
    const harness = createTestSurfaceDeps({});
    expect(await run(['create'], harness.deps)).toBe(1);
    expect(harness.err()).toContain('Error: [usage]');
    // The default register is prose; nothing JSON-shaped goes to stdout.
    expect(harness.out()).toBe('');
  });

  it('renders the same failure as a machine-readable document under --json', async () => {
    const harness = createTestSurfaceDeps({});
    expect(await run(['create', '--json'], harness.deps)).toBe(1);
    const result = harness.json();
    expect(result.ok).toBe(false);
    expect(result.code).toBe('usage');
    expect(typeof result.message).toBe('string');
    expect(harness.err()).toBe('');
  });

  it('keeps every subcommand reachable', () => {
    expect(SURFACE_SUBCOMMANDS).toEqual([
      'create',
      'templates',
      'lint',
      'publish',
      'show',
      'event',
      'state',
      'snapshot',
      'preview',
      'doctrine',
      'primitives',
      'rubric',
    ]);
  });
});
