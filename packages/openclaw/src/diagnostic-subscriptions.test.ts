import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearTlonDiagnosticSubscriptionsForTest,
  installTlonDiagnosticSubscriptions,
  shouldInstallTlonDiagnosticSubscriptions,
} from './diagnostic-subscriptions.js';

describe('diagnostic subscriptions', () => {
  afterEach(() => {
    clearTlonDiagnosticSubscriptionsForTest();
  });

  it('installs only during full registration', () => {
    expect(shouldInstallTlonDiagnosticSubscriptions('full')).toBe(true);
    expect(shouldInstallTlonDiagnosticSubscriptions('tool-discovery')).toBe(
      false
    );
    expect(shouldInstallTlonDiagnosticSubscriptions('discovery')).toBe(false);
    expect(shouldInstallTlonDiagnosticSubscriptions('cli-metadata')).toBe(
      false
    );
    expect(shouldInstallTlonDiagnosticSubscriptions(undefined)).toBe(false);
  });

  it('replaces an existing process-global subscription instead of stacking', () => {
    const firstUnsubscribe = vi.fn();
    const secondUnsubscribe = vi.fn();

    const cleanupFirst = installTlonDiagnosticSubscriptions(
      () => firstUnsubscribe
    );
    const cleanupSecond = installTlonDiagnosticSubscriptions(
      () => secondUnsubscribe
    );

    expect(firstUnsubscribe).toHaveBeenCalledTimes(1);
    expect(secondUnsubscribe).not.toHaveBeenCalled();

    cleanupFirst();
    expect(secondUnsubscribe).not.toHaveBeenCalled();

    cleanupSecond();
    expect(secondUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('keeps cleanup idempotent', () => {
    const unsubscribe = vi.fn();
    const cleanup = installTlonDiagnosticSubscriptions(() => unsubscribe);

    cleanup();
    cleanup();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
