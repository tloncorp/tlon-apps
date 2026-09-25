import { describe, expect, it } from 'vitest';

import {
  claimAutomaticProvisionRetry,
  clearFailedAutomaticProvision,
  isAutomaticProvisionControl,
  isComponentReachableFromRoot,
  shouldAttemptAutomaticProvision,
  trackAutomaticProvisionReceipt,
} from './autoProvision';

const ready = {
  componentId: 'auto-provision',
  actionName: 'tlon.provisionAgent',
  componentReachable: true,
  componentDisabled: false,
  selectionsPending: false,
  actionAvailable: true,
  consumed: false,
  attemptedThisMount: false,
};

describe('automatic task-plan provisioning', () => {
  it('recognizes only the reserved automatic provisioning control', () => {
    expect(isAutomaticProvisionControl(ready)).toBe(true);
    expect(
      isAutomaticProvisionControl({
        ...ready,
        componentId: 'visible-provision-button',
      })
    ).toBe(false);
    expect(
      isAutomaticProvisionControl({ ...ready, actionName: 'tlon.openAgent' })
    ).toBe(false);
  });

  it('locks retries synchronously until the active attempt releases', () => {
    const locks = new Set<string>();
    expect(claimAutomaticProvisionRetry(locks, 'surface-1')).toBe(true);
    expect(claimAutomaticProvisionRetry(locks, 'surface-1')).toBe(false);
    locks.delete('surface-1');
    expect(claimAutomaticProvisionRetry(locks, 'surface-1')).toBe(true);
  });

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
    expect(
      shouldAttemptAutomaticProvision({ ...ready, componentDisabled: true })
    ).toBe(false);
    expect(
      shouldAttemptAutomaticProvision({ ...ready, componentReachable: false })
    ).toBe(false);
  });

  it('requires the automatic button to be reachable from the rendered root', () => {
    const components = new Map([
      ['root', { component: 'Column', children: ['visible'] }],
      ['visible', { component: 'Text' }],
      ['auto-provision', { component: 'Button', child: 'label' }],
      ['label', { component: 'Text' }],
    ]);
    expect(
      isComponentReachableFromRoot('root', 'auto-provision', components)
    ).toBe(false);
    components.set('root', {
      component: 'Column',
      children: ['visible', 'auto-provision'],
    });
    expect(
      isComponentReachableFromRoot('root', 'auto-provision', components)
    ).toBe(true);
  });

  it('clears a stale failure after a successful direct retry', () => {
    expect(
      clearFailedAutomaticProvision(['surface-1', 'surface-2'], 'surface-1')
    ).toEqual(['surface-2']);
  });

  it('surfaces a retry when a confirmed optimistic receipt later fails', () => {
    const observedReceipts = new Set<string>();
    const activeAttempts = new Set(['surface-1']);
    expect(
      trackAutomaticProvisionReceipt({
        observedReceipts,
        activeAttempts,
        surfaceId: 'surface-1',
        consumed: false,
      })
    ).toBeUndefined();
    expect(
      trackAutomaticProvisionReceipt({
        observedReceipts,
        activeAttempts,
        surfaceId: 'surface-1',
        consumed: true,
      })
    ).toBe('confirmed');
    activeAttempts.clear();
    expect(
      trackAutomaticProvisionReceipt({
        observedReceipts,
        activeAttempts,
        surfaceId: 'surface-1',
        consumed: false,
      })
    ).toBe('failed');
    expect(activeAttempts.has('surface-1')).toBe(false);
    expect(
      trackAutomaticProvisionReceipt({
        observedReceipts,
        activeAttempts,
        surfaceId: 'surface-1',
        consumed: false,
      })
    ).toBeUndefined();
  });
});
