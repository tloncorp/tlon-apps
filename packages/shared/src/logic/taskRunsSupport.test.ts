import { TASK_RUNS_MIN_GROUPS_VERSION } from '@tloncorp/api/lib/deskVersion';
import { describe, expect, test } from 'vitest';

import { deskVersionSupportsTaskRuns } from './taskRunsSupport';

describe('deskVersionSupportsTaskRuns', () => {
  test('supports the minimum release and anything above it', () => {
    expect(deskVersionSupportsTaskRuns(TASK_RUNS_MIN_GROUPS_VERSION)).toBe(
      true
    );
    expect(deskVersionSupportsTaskRuns('12.5.1')).toBe(true);
    expect(deskVersionSupportsTaskRuns('13.0.0')).toBe(true);
  });

  // these desks' %steward neither pages a task's runs nor relays a test
  test('refuses the releases below it', () => {
    expect(deskVersionSupportsTaskRuns('12.4.0')).toBe(false);
    expect(deskVersionSupportsTaskRuns('12.3.1')).toBe(false);
    expect(deskVersionSupportsTaskRuns('12.2.0')).toBe(false);
  });

  test('refuses a version it cannot fully parse rather than guessing', () => {
    expect(deskVersionSupportsTaskRuns('12.5.0 dirty')).toBe(false);
    expect(deskVersionSupportsTaskRuns('')).toBe(false);
    expect(deskVersionSupportsTaskRuns(null)).toBe(false);
    expect(deskVersionSupportsTaskRuns(undefined)).toBe(false);
  });
});
