import { describe, expect, it } from 'vitest';

import { shouldAttemptAutomaticProvision } from './autoProvision';

const ready = {
  componentId: 'auto-provision',
  actionName: 'tlon.provisionAgent',
  selectionsPending: false,
  actionAvailable: true,
  consumed: false,
  attemptedThisMount: false,
};

describe('automatic task-plan provisioning', () => {
  it('attempts once per mount and stops after a durable receipt', () => {
    expect(shouldAttemptAutomaticProvision(ready)).toBe(true);
    expect(
      shouldAttemptAutomaticProvision({ ...ready, attemptedThisMount: true })
    ).toBe(false);
    expect(shouldAttemptAutomaticProvision({ ...ready, consumed: true })).toBe(
      false
    );
  });

  it('allows a remount recovery only when no durable receipt exists', () => {
    const failedMount = { ...ready, attemptedThisMount: true };
    expect(shouldAttemptAutomaticProvision(failedMount)).toBe(false);
    expect(
      shouldAttemptAutomaticProvision({
        ...failedMount,
        attemptedThisMount: false,
      })
    ).toBe(true);
  });

  it('waits for protocol receipts and action authorization', () => {
    expect(
      shouldAttemptAutomaticProvision({ ...ready, selectionsPending: true })
    ).toBe(false);
    expect(
      shouldAttemptAutomaticProvision({ ...ready, actionAvailable: false })
    ).toBe(false);
  });
});
