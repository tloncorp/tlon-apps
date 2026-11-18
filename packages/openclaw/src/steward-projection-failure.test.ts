import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  StewardAutomationReconciliationExhaustedError,
  reportStewardProjectionFailure,
} from './steward-automation-reconciliation.js';
import { reportTelemetryError } from './telemetry.js';

vi.mock('./telemetry.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./telemetry.js')>()),
  reportTelemetryError: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());

describe('reportStewardProjectionFailure', () => {
  it('reports a projection whose retries ran out, once', () => {
    const warn = vi.fn();
    reportStewardProjectionFailure(
      new StewardAutomationReconciliationExhaustedError(3, new Error('down')),
      warn
    );
    expect(reportTelemetryError).toHaveBeenCalledTimes(1);
    expect(reportTelemetryError).toHaveBeenCalledWith(
      expect.objectContaining({ sourceEventName: 'projection_exhausted' })
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('reports without a logger', () => {
    reportStewardProjectionFailure(new Error('steward unreachable'));
    expect(reportTelemetryError).toHaveBeenCalledWith(
      expect.objectContaining({ sourceEventName: 'projection_failed' })
    );
  });
});
